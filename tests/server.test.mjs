import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {once} from 'node:events';

test('preview server serves the fixed project even from another working directory',async()=>{
 const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');
 const port=probe.address().port;await new Promise(r=>probe.close(r));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../tools/serve.mjs',import.meta.url))],{cwd:tmpdir(),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 try {
  await Promise.race([once(child.stdout,'data'),once(child,'error').then(([e])=>{throw e}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),5000);t.unref()})]);
  const base=`http://127.0.0.1:${port}`;
  const page=await fetch(base);assert.equal(page.status,200);const html=await page.text();assert(html.includes('boot-status'));
  const adapter=await fetch(base+'/vendor/vue.mjs');assert.equal(adapter.status,200);assert.match(adapter.headers.get('content-type'),/javascript/);assert((await adapter.text()).includes('globalThis.Vue = runtime'));
  const missing=await fetch(base+'/missing-file.js');assert.equal(missing.status,404);
 } finally {child.kill();await once(child,'exit')}
});
