import {mkdirSync,existsSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const [apk,out,signer]=process.argv.slice(2);
if(!apk||!out||!signer||!process.env.RIXU_JAVA_HOME||!process.env.RIXU_SIGNING_DIR)throw Error('Provide input APK, output APK, apksigner.jar, RIXU_JAVA_HOME and RIXU_SIGNING_DIR');
const dir=resolve(process.env.RIXU_SIGNING_DIR);mkdirSync(dir,{recursive:true,mode:0o700});
const key=join(dir,'rixu-personal.p12'),pass=join(dir,'signing-password.txt');
function run(binary,args,password){const p=spawnSync(join(process.env.RIXU_JAVA_HOME,'bin',binary+(process.platform==='win32'?'.exe':'')),args,{env:{...process.env,RIXU_STORE_PASSWORD:password},encoding:'utf8'});if(p.status!==0)throw Error(binary+' failed: '+p.stderr);return p.stdout;}
if(existsSync(key)!==existsSync(pass))throw Error('Incomplete signing identity: restore its matching backup; never replace one file');
if(!existsSync(key)){const password=randomBytes(36).toString('base64url');writeFileSync(pass,password,{mode:0o600,flag:'wx'});run('keytool',['-genkeypair','-keystore',key,'-storetype','PKCS12','-alias','rixu-personal','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Rixu Personal','-storepass:env','RIXU_STORE_PASSWORD','-keypass:env','RIXU_STORE_PASSWORD'],password);}
const password=readFileSync(pass,'utf8').trim();
run('java',['-jar',resolve(signer),'sign','--ks',key,'--ks-key-alias','rixu-personal','--ks-pass','env:RIXU_STORE_PASSWORD','--key-pass','env:RIXU_STORE_PASSWORD','--out',resolve(out),resolve(apk)],password);
console.log(run('java',['-jar',resolve(signer),'verify','--verbose','--print-certs',resolve(out)],password));
console.log('Signed with the existing local identity. Keep its private folder backed up securely; never commit or upload it.');
