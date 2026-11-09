/** Read-only environment inspection. --write saves only a JSON report. */
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const root=[resolve(here,'..'),here,process.cwd()].find(p=>existsSync(resolve(p,'package.json'))&&existsSync(resolve(p,'tools/serve.mjs')))||process.cwd();
const win=process.platform==='win32';
const report={createdAt:new Date().toISOString(),platform:process.platform,architecture:process.arch,projectDetected:existsSync(resolve(root,'package.json')),checks:[],notes:[]};
function check(name,scope,ok,detail){report.checks.push({name,scope,status:ok?'OK':'CHECK',detail});console.log(`[${ok?'OK':'CHECK'}] ${scope} / ${name}: ${detail}`)}
function command(cmd,args=[]){try{
 const r=win?spawnSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',cmd+' '+args.join(' ')],{encoding:'utf8',timeout:10000,windowsHide:true}):spawnSync(cmd,args,{encoding:'utf8',timeout:10000});
 return r.status===0?String(r.stdout||r.stderr).trim().split(/\r?\n/)[0]:null;
}catch{return null}}
console.log('Rixu environment check - no installation, no deletion, no account access.');
const [major,minor]=process.versions.node.split('.').map(Number);
check('Node.js','preview',major>=18,process.version);
check('Node.js >=22.12','source development',major>22||major===22&&minor>=12,process.version+'; recommended: maintained Node 24 LTS release');
const npm=command('npm',['--version']);check('npm','source development',!!npm,npm||'Not found in PATH. Not needed for included dist preview.');
for(const file of ['dist/index.html','dist/app/main.js','dist/vendor/vue.mjs','dist/vendor/vue.global.js','dist/styles/app.css','dist/boot-guard.js'])check(file,'preview',existsSync(resolve(root,file)),existsSync(resolve(root,file))?'present':'missing - extract the complete project ZIP');
try{const adapter=readFileSync(resolve(root,'dist/vendor/vue.mjs'),'utf8');check('Vue ESM hotfix','preview',/globalThis\.Vue\s*=/.test(adapter),/globalThis\.Vue\s*=/.test(adapter)?'fixed adapter detected':'old adapter: blank-screen bug is present')}catch{}
let pkg;try{pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'))}catch{}
if(pkg){
 for(const name of ['vue','vite','typescript']){let installed='';try{installed=JSON.parse(readFileSync(resolve(root,'node_modules',name,'package.json'),'utf8')).version}catch{}
 check(name,'source development',!!installed,installed?`installed ${installed}`:`not installed; requested ${pkg.dependencies?.[name]||pkg.devDependencies?.[name]||'unspecified'}; not needed for included dist`)}
 check('package-lock.json','repeatable builds',existsSync(resolve(root,'package-lock.json')),existsSync(resolve(root,'package-lock.json'))?'present':'not generated; create via a successful npm install, never fabricate');
}
const git=command('git',['--version']);check('Git','later: version control',!!git,git||'not on PATH; optional for local preview');
const code=command('code',['--version']);check('VS Code CLI','optional editor',!!code,code||'not on PATH; does not prove editor is absent');
const java=command('java',['-version']);check('Java in PATH','later: APK',!!java,java||'not on PATH; Android Studio may have a bundled JDK');
const local=process.env.LOCALAPPDATA||'';
const sdkPaths=[process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT,local?resolve(local,'Android','Sdk'):null].filter(Boolean);
const sdk=sdkPaths.find(p=>existsSync(p));check('Android SDK','later: APK',!!sdk,sdk?'found in a standard/configured location':'not found in checked locations; not required for web preview');
if(sdk)check('Android adb','later: APK',existsSync(resolve(sdk,'platform-tools',win?'adb.exe':'adb')),existsSync(resolve(sdk,'platform-tools',win?'adb.exe':'adb'))?'present':'platform-tools missing');
check('android/ project','later: APK',existsSync(resolve(root,'android')),existsSync(resolve(root,'android'))?'present':'not yet implemented in this build; installing Android Studio alone does not create it');
report.notes.push('CHECK does not always mean missing: GUI applications may exist outside PATH.');
report.notes.push('No ChatGPT Skill, browser extension, cloud account, Python or Android Studio is needed to preview the bundled dist.');
report.notes.push('Browser Console and IndexedDB availability cannot be determined by this terminal script.');
if(process.argv.includes('--network')){
 try{const r=await fetch('https://registry.npmjs.org/-/ping',{signal:AbortSignal.timeout(6000)});check('npm registry','optional network test',r.ok,'HTTP '+r.status)}catch(e){check('npm registry','optional network test',false,e.message)}
}
if(process.argv.includes('--write')){const file=resolve(root,'environment-report.json');writeFileSync(file,JSON.stringify(report,null,2));console.log('Saved: environment-report.json (no user records or secrets read).')}
console.log('\nPreview command: node tools/serve.mjs\nSource dependencies: npm.cmd install (Windows), then npm.cmd run dev\nKeep the old data; do not clear browser storage as a troubleshooting shortcut.');
