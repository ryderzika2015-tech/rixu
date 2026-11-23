import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {compile} from '@vue/compiler-dom';

async function setup(client) {
  globalThis.__rixuAuthTestClient=client;
  globalThis.window={location:{origin:'https://preview.example'}};
  let source=readFileSync(new URL('../src/services/neon-auth.ts',import.meta.url),'utf8');
  source=source.replace("import {ref} from 'vue';",'const ref=value=>({value});');
  source=source.replace("import {createSyncApi, SyncApiError} from './sync-api.js';",'class SyncApiError extends Error {} const createSyncApi=()=>({me:()=>{throw Error("Unexpected API access")}});');
  source=source.replace(/const browserEnv = .*?;\n/s,"const browserEnv={VITE_NEON_AUTH_URL:'https://auth.example',VITE_SYNC_API_URL:'https://api.example'};\n");
  source=source.replace(/async function loadClient\(\).*?\n/, 'async function loadClient(){return globalThis.__rixuAuthTestClient;}\n');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(js+'\n//'+Math.random()).toString('base64'));
}
const user={id:'test-user',email:'user@example.test',name:'Test',emailVerified:false};
test('unverified signup enters verification; invalid OTP stays there; valid OTP restores session',async()=>{
  let verified=false;const sent=[];
  const auth=await setup({signUp:{email:async()=>({data:{user},error:null})},getSession:async()=>({data:verified?{user:{...user,emailVerified:true}}:null,error:null}),emailOtp:{verifyEmail:async args=>{sent.push(args);if(args.otp!=='123456')return {error:{message:'Code expired'}};verified=true;return {data:{},error:null};}}});
  await auth.signUp('Test',user.email,'test-only-password');
  assert.equal(auth.verificationEmail.value,user.email);
  assert.equal(auth.authUser.value,null);
  await assert.rejects(auth.verifyEmailCode('bad'));
  assert.equal(sent.length,0);
  await assert.rejects(auth.verifyEmailCode('000000'),/expired/);
  assert.equal(auth.verificationEmail.value,user.email);
  await auth.verifyEmailCode('123456');
  assert.equal(auth.authUser.value.emailVerified,true);
  assert.equal(auth.verificationEmail.value,'');
  assert.equal(auth.authPending.value,false);
});
test('unverified sign-in offers recovery and repeated sends are throttled',async()=>{
  const sent=[];
  const auth=await setup({signIn:{email:async()=>({error:{code:'EMAIL_NOT_VERIFIED'}})},sendVerificationEmail:async args=>{sent.push(args);return {data:{},error:null};},signOut:async()=>({error:null})});
  await assert.rejects(auth.signIn(user.email,'test-only-password'),/验证邮箱/);
  assert.equal(auth.verificationEmail.value,user.email);
  await auth.sendVerification(user.email);
  assert.deepEqual(sent,[{email:user.email,callbackURL:'https://preview.example/'}]);
  await assert.rejects(auth.sendVerification(user.email),/一分钟/);
  assert.equal(sent.length,1);
  await auth.signOut();
  assert.equal(auth.verificationEmail.value,'');
});
test('failed email send can be retried and verification without auto-login returns to login',async()=>{
  let count=0;
  const auth=await setup({sendVerificationEmail:async()=>++count===1?{error:{message:'Mail unavailable'}}:{error:null},emailOtp:{verifyEmail:async()=>({error:null})},getSession:async()=>({data:null,error:null})});
  await assert.rejects(auth.sendVerification(user.email),/unavailable/);
  assert.equal(auth.verificationSentAt.value,0);
  await auth.sendVerification(user.email);
  await auth.verifyEmailCode('123456');
  assert.equal(auth.authUser.value,null);
  assert.equal(auth.verificationEmail.value,'');
});
test('account template compiles with verification forms and signed-in recovery',()=>{
  const source=readFileSync(new URL('../src/components/AuthPanel.ts',import.meta.url),'utf8');
  const template=source.match(/template:`([\s\S]*)`\s*\}\);/)[1];
  assert.doesNotThrow(()=>compile(template));
});
