import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.mjs';
// Exercise actual Worker authorization without production credentials or database writes.
test('Worker rejects invalid credentials before database access', async()=>{
 const env={DATABASE_URL:'unused',NEON_AUTH_BASE_URL:'https://auth.example/db/auth',NEON_AUTH_JWKS_URL:'https://auth.example/db/auth/jwks',ALLOWED_USER_IDS:'test-user',ALLOWED_ORIGINS:'https://app.example'};
 for (const [authorization,status,code] of [['',401,'MISSING_TOKEN'],['Bearer invalid',401,'INVALID_TOKEN']]) {
  const response=await worker.fetch(new Request('https://api.example/v1/me',{headers:{Origin:'https://app.example',Authorization:authorization}}),env);
  assert.equal(response.status,status); assert.equal((await response.json()).error,code);
 }
 const response=await worker.fetch(new Request('https://api.example/v1/me',{headers:{Origin:'https://evil.example'}}),env);
 assert.equal(response.status,403);
});
import {generateKeyPair, SignJWT} from 'jose';
import {verifyAuthToken} from '../src/auth.mjs';
test('JWT verifies EdDSA signatures, origin issuer and mandatory expiry',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('EdDSA');
 const sign=(claims)=>new SignJWT(claims).setProtectedHeader({alg:'EdDSA'}).sign(privateKey);
 const now=Math.floor(Date.now()/1000);
 const valid={sub:'test-user',iss:'https://auth.example',iat:now,exp:now+900};
 assert.equal((await verifyAuthToken(await sign(valid),publicKey,valid.iss)).payload.sub,'test-user');
 for(const claims of [{...valid,iss:valid.iss+'/db/auth'},{...valid,exp:now-1},{...valid,exp:undefined},{...valid,iat:undefined}]){
  await assert.rejects(verifyAuthToken(await sign(claims),publicKey,valid.iss));
 }
 const other=await generateKeyPair('EdDSA');
 await assert.rejects(verifyAuthToken(await sign(valid),other.publicKey,valid.iss));
});
