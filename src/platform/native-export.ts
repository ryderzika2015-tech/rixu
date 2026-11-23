export async function exportNativeFile(name:string,content:string):Promise<boolean> {
  const native=(globalThis as typeof globalThis & {Capacitor?:{isNativePlatform():boolean}}).Capacitor;
  if(!native?.isNativePlatform())return false;
  const [{Filesystem,Directory,Encoding},{Share}]=await Promise.all([import('@capacitor/filesystem'),import('@capacitor/share')]);
  const safeName=name.replace(/[\\/]/g,'_');
  const file=await Filesystem.writeFile({path:'exports/'+Date.now()+'-'+safeName,data:content,directory:Directory.Cache,encoding:Encoding.UTF8,recursive:true});
  await Share.share({title:'日序备份',files:[file.uri],dialogTitle:'保存或分享日序备份'});
  return true;
}
