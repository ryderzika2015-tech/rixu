import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
async function load(){
  const source=readFileSync(new URL('../src/platform/native-export.ts',import.meta.url),'utf8').replace("Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')])",'Promise.resolve(globalThis.__nativeExportPlugins)');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
test('browser export does not call native plugins',async()=>{
  delete globalThis.Capacitor;globalThis.__nativeExportPlugins=null;
  assert.equal(await (await load()).exportNativeFile('backup.json','{}'),false);
});
test('phone backup writes UTF-8 cache file and asks user to share that file',async()=>{
  const calls=[];globalThis.Capacitor={isNativePlatform:()=>true};
  globalThis.__nativeExportPlugins=[{Directory:{Cache:'CACHE'},Encoding:{UTF8:'utf8'},Filesystem:{writeFile:async x=>{calls.push(x);return {uri:'file:///cache/backup.json'};}}},{Share:{share:async x=>calls.push(x)}}];
  try {
    assert.equal(await (await load()).exportNativeFile('../备份.json','{"备注":"午餐"}'),true);
    assert.equal(calls[0].directory,'CACHE');assert.equal(calls[0].data,'{"备注":"午餐"}');
    assert.match(calls[0].path,/^exports\/\d+-.._备份.json$/);
    assert.deepEqual(calls[1].files,['file:///cache/backup.json']);
  }finally{delete globalThis.Capacitor;delete globalThis.__nativeExportPlugins;}
});
test('failed native file write is reported and is never treated as exported',async()=>{
  globalThis.Capacitor={isNativePlatform:()=>true};
  globalThis.__nativeExportPlugins=[{Directory:{Cache:'CACHE'},Encoding:{UTF8:'utf8'},Filesystem:{writeFile:async()=>{throw Error('disk full');}}},{Share:{share:async()=>assert.fail('must not share missing file')}}];
  try{await assert.rejects((await load()).exportNativeFile('backup.json','{}'),/disk full/);}finally{delete globalThis.Capacitor;delete globalThis.__nativeExportPlugins;}
});
