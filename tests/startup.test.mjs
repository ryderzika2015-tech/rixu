import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('vendored ESM adapter exposes global Vue for the runtime compiler',async()=>{
 const {createApp}=await import('../vendor/vue.mjs');
 assert.equal(typeof createApp,'function');
 assert.equal(globalThis.Vue,globalThis.__RIXU_VUE);
 const render=globalThis.Vue.compile('<section>{{ title }}</section>');
 assert.equal(typeof render,'function');
 assert.equal(render({title:'Rixu'},[]).children,'Rixu');
});
test('distributed adapter also compiles templates without a classic script tag',async()=>{
 await import('../dist/vendor/vue.mjs');
 const render=globalThis.Vue.compile('<div>offline preview</div>');
 assert.equal(render({},[]).children,'offline preview');
});
test('dist startup guard precedes application module and needs no framework',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert(html.includes('id="boot-status"'));
 assert(html.indexOf('src="./boot-guard.js"')<html.indexOf('src="./app/main.js"'));
 const guard=await readFile(new URL('../dist/boot-guard.js',import.meta.url),'utf8');
 assert(guard.includes('unhandledrejection'));
 assert(!guard.includes('localStorage.clear'));
 assert(!guard.includes('deleteDatabase'));
});
