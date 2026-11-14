import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
test('authentication is read-only and does not alter local data',()=>{
  const auth=text('../src/services/neon-auth.ts');
  assert.match(auth,/api\.me\(\)/);
  assert.doesNotMatch(auth,/api\.push\(|api\.pull\(/);
});
test('settings has a visible account panel and explicit sign-in',()=>{
  assert.match(text('../src/pages/SettingsPage.ts'),/<AuthPanel\/>/);
  assert.match(text('../src/components/AuthPanel.ts'),/验证 API 身份/);
  assert.match(text('../src/components/AuthPanel.ts'),/退出账号/);
});
test('backend pins origin issuer and verifies against JWKS',()=>{
  const worker=text('../api/src/index.mjs');
  assert.match(worker,/auth\.origin/);
  assert.match(worker,/createRemoteJWKSet/);
  assert.match(worker,/allowedUser\(payload\.sub,env\)/);
});
