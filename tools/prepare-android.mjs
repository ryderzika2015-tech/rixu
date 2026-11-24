import {reminderSound} from './make-reminder-sound.mjs';
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
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
if(!xml.includes('android.permission.SCHEDULE_EXACT_ALARM'))xml=xml.replace('<application','<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/><application');
if(!xml.includes('android.permission.VIBRATE'))xml=xml.replace('<application','<uses-permission android:name="android.permission.VIBRATE"/><application');
writeFileSync(manifest,xml);
const javaDir='android/app/src/main/java/tech/rixu/app';
mkdirSync(javaDir,{recursive:true});copyFileSync('android-native/RixuSettingsPlugin.java',javaDir+'/RixuSettingsPlugin.java');
const activity=javaDir+'/MainActivity.java';
if(!existsSync(activity))throw Error('Use a fresh checkout for the fixed tech.rixu.app identity; existing generated project uses another package');
writeFileSync(activity,`package tech.rixu.app;\nimport android.os.Bundle;\nimport com.getcapacitor.BridgeActivity;\npublic class MainActivity extends BridgeActivity {@Override public void onCreate(Bundle savedInstanceState){super.onCreate(savedInstanceState);registerPlugin(RixuSettingsPlugin.class);}}\n`);
mkdirSync('android/app/src/main/res/raw',{recursive:true});writeFileSync('android/app/src/main/res/raw/rixu_reminder.wav',reminderSound());
const gradle='android/app/build.gradle';let build=readFileSync(gradle,'utf8');build=build.replace(/versionCode \d+/,'versionCode 3006').replace(/versionName \"[^\"]+\"/,'versionName "0.3.6"');writeFileSync(gradle,build);
console.log('Android project ready. Build with android/gradlew assembleRelease.');
