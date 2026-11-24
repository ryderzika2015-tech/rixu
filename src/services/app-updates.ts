import {ref} from 'vue';
export const updateStatus=ref(''),updateBusy=ref(false),updateUrl=ref('');
export const APP_ID='tech.rixu.app';
export function releaseUpdate(value:unknown,currentBuild:number){
 if(!Number.isSafeInteger(currentBuild)||currentBuild<1)return null;
 const r=value as any;if(!r||r.draft||r.prerelease)return null;
 const version=/^android-v(\d+)\.(\d+)\.(\d+)$/.exec(r.tag_name||'');if(!version)return null;
 const [major,minor,patch]=version.slice(1).map(Number);if(minor>999||patch>999)return null;
 const build=major*1000000+minor*1000+patch;if(!Number.isSafeInteger(build)||build>2147483647||build<=currentBuild)return null;
 const filename=`rixu-${major}.${minor}.${patch}.apk`;
 const asset=r.assets?.find((a:any)=>a.name===filename);
 const expected=`https://github.com/ryderzika2015-tech/rixu/releases/download/${r.tag_name}/${filename}`;
 return asset?.browser_download_url===expected?{version:`${major}.${minor}.${patch}`,url:expected}:null;
}
export async function checkAppUpdates(){
 if(updateBusy.value)return;updateBusy.value=true;updateUrl.value='';updateStatus.value='正在检查更新…';
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),12000);
 try{
  const {App}=await import('@capacitor/app');const info=await App.getInfo();
  if(info.id!==APP_ID)throw Error('当前为旧测试包，请先迁移到固定签名版');
  const response=await fetch('https://api.github.com/repos/ryderzika2015-tech/rixu/releases/latest',{signal:control.signal,headers:{Accept:'application/vnd.github+json'}});
  if(response.status===404){updateStatus.value=`当前 ${info.version} · 暂无已发布更新`;return;}
  if(!response.ok)throw Error('更新服务暂不可用，请稍后重试');
  const release=releaseUpdate(await response.json(),Number(info.build));
  if(release){updateUrl.value=release.url;updateStatus.value=`发现新版本 ${release.version}，下载后由系统确认更新，保留本机数据。`;}
  else updateStatus.value=`当前 ${info.version} · 没有可用的新版本`;
 }catch(e){updateStatus.value=e instanceof Error&&e.name==='AbortError'?'检查超时，请检查网络后重试':e instanceof Error?e.message:'检查更新失败';}
 finally{clearTimeout(timer);updateBusy.value=false;}
}
export async function downloadAppUpdate(){if(!updateUrl.value)return;const {registerPlugin}=await import('@capacitor/core');await registerPlugin<{openDownload(args:{url:string}):Promise<void>}>('RixuSettings').openDownload({url:updateUrl.value});}
