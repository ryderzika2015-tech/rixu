import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
process.chdir(cwd);
function run(file,args,env=process.env){
  const result=spawnSync(process.execPath,[file,...args],{cwd,env,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status||1);
}
run('node_modules/typescript/bin/tsc',['--noEmit','-p','tsconfig.json']);
// Explicitly suppress browser Auth endpoints in the first offline personal APK.
run('node_modules/vite/bin/vite.js',['build'],{...process.env,VITE_NATIVE_APP:'1',VITE_NEON_AUTH_URL:'',VITE_SYNC_API_URL:''});
if(!existsSync('android'))run('node_modules/@capacitor/cli/bin/capacitor',['add','android']);
run('node_modules/@capacitor/cli/bin/capacitor',['sync','android']);
const manifest='android/app/src/main/AndroidManifest.xml';
let xml=readFileSync(manifest,'utf8');
// Device/cloud backup is separate from the explicit JSON backup flow.
xml=xml.replace('android:allowBackup="true"','android:allowBackup="false"');
writeFileSync(manifest,xml);
console.log('Android project ready. Build with android/gradlew assembleDebug.');
