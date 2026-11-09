import {spawnSync} from 'node:child_process';
import {mkdirSync,rmSync,cpSync,readFileSync,writeFileSync} from 'node:fs';
const command=process.platform==='win32'?'tsc.cmd':'tsc';
const run=spawnSync(command,['-p','tsconfig.offline.json'],{stdio:'inherit'});if(run.status!==0)process.exit(run.status||1);
rmSync('dist',{recursive:true,force:true});mkdirSync('dist',{recursive:true});cpSync('.offline','dist/app',{recursive:true});cpSync('public','dist',{recursive:true});cpSync('vendor','dist/vendor',{recursive:true});cpSync('src/styles','dist/styles',{recursive:true});
cpSync('tools/offline-index.html','dist/index.html');
console.log('Offline TypeScript + real Vue runtime build -> dist/ (not a Vite build)');
