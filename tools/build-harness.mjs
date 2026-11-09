// Test only: managed Chromium disallows all URL navigation in this environment.
// Run real Vue plus compiled modules on about:blank with an injected in-memory
// Repository. This does NOT test IndexedDB persistence or OS integration.
import {execFileSync} from 'node:child_process';import fs from 'node:fs';import path from 'node:path';
const config=JSON.parse(fs.readFileSync('tsconfig.offline.json','utf8'));config.compilerOptions={...config.compilerOptions,module:'CommonJS',moduleResolution:'Node',outDir:'.test-build'};fs.writeFileSync('tsconfig.harness.json',JSON.stringify(config));execFileSync('tsc',['-p','tsconfig.harness.json'],{stdio:'inherit'});
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
let code='const __modules={}; const __cache={};\n';for(const f of walk('.test-build').filter(f=>f.endsWith('.js'))){code+=`__modules[${JSON.stringify(f.replace('.test-build/',''))}]=function(require,module,exports){\n${fs.readFileSync(f,'utf8')}\n};\n`}
code+=`function __require(id,from=''){if(id==='vue')return Vue;let segments=(id.startsWith('.')?from.split('/').slice(0,-1).join('/')+'/'+id:id).split('/'),out=[];for(const x of segments){if(x==='..')out.pop();else if(x&&x!=='.')out.push(x)}id=out.join('/');if(__cache[id])return __cache[id].exports;if(!__modules[id])throw Error('MISSING_MODULE '+id);let m={exports:{}};__cache[id]=m;__modules[id](n=>__require(n,id),m,m.exports);return m.exports}
if(!crypto.randomUUID)crypto.randomUUID=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
const __clone=x=>JSON.parse(JSON.stringify(x));
let __state=window.__fixture||__require('domain/model.js').emptySnapshot();let __ops=[];let __tail=Promise.resolve();
const __repo={load:async()=>__clone(__state),close:()=>{},commit(changes){const p=__tail.then(()=>{let next=__clone(__state);for(const c of changes){let arr=next[c.store],old=arr.find(x=>x.id===c.value.id);if(c.expected===null?!!old:(!old||old.version!==c.expected))throw new (__require('storage/repository.js').ConflictError)();let val={...__clone(c.value),version:(old?.version||0)+1,updatedAt:new Date().toISOString()};if(old)arr[arr.findIndex(x=>x.id===val.id)]=val;else arr.push(val);__ops.push(c)}__state=next});__tail=p.catch(()=>{});return p;}};
const __store=__require('services/store.js');__store.configureRepositoryFactory(async()=>__repo);
window.__test={store:__store,module:__require,read:()=>__clone(__state),operations:()=>__ops,notice:()=>__store.notice.value};
__require('main.js');`;
fs.mkdirSync('qa',{recursive:true});let html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+fs.readFileSync('src/styles/app.css','utf8')+'</style></head><body><div id="app"></div><script>'+fs.readFileSync('vendor/vue.global.js','utf8')+'\n'+code.replaceAll('</script','<\\/script')+'</script></body></html>';fs.writeFileSync('qa/test-harness.html',html);console.log('UI test harness compiled (memory Repository, not IndexedDB)');
