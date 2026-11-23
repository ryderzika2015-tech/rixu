import {ref,watch} from 'vue';
import {data,ready,changeTaskReminder,notify} from './store.js';
import {reminderNodes,type ReminderNode} from '../domain/reminders.js';
export const notificationStatus=ref('尚未启用手机通知');
export const nativeAlert=ref<ReminderNode|null>(null);
const native=()=>!!(globalThis as any).Capacitor?.isNativePlatform();
let api:typeof import('@capacitor/local-notifications').LocalNotifications;
let queue:Promise<unknown>=Promise.resolve();let started=false;
export function notificationId(key:string){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%2147483646+1;}
async function reconcile(){
 if(!ready.value||!api)return;
 if((await api.checkPermissions()).display!=='granted'){notificationStatus.value='通知权限未开启，后台提醒不可用';return;}
 const nodes=reminderNodes(data.value.tasks,data.value.settings[0]);
 if(nodes.length>500)throw Error('待提醒数量超过 500，请减少提醒次数或事项');
 const ids=new Set<number>();const planned=nodes.map(n=>{let id=notificationId(n.key);while(ids.has(id))id=id%2147483646+1;ids.add(id);return {id,title:'日序提醒',body:n.title,actionTypeId:'RIXU_REMINDER',channelId:'rixu-reminders',schedule:{at:new Date(n.at),allowWhileIdle:true},extra:{rixu:true,key:n.key,signature:n.key+'|'+n.title,taskId:n.taskId,at:n.at}};});
 const pending=(await api.getPending()).notifications.filter(n=>n.extra?.rixu);
 const cancel=pending.filter(p=>!planned.some(n=>n.id===p.id&&n.extra.signature===p.extra?.signature));
 if(cancel.length)await api.cancel({notifications:cancel.map(n=>({id:n.id}))});
 const add=planned.filter(n=>!pending.some(p=>p.id===n.id&&p.extra?.signature===n.extra.signature));
 if(add.length)await api.schedule({notifications:add});
 const exact=await api.checkExactNotificationSetting();
 notificationStatus.value=exact.exact_alarm==='granted'?`系统提醒已就绪 · 待提醒 ${planned.length} 次`:'通知已开启；未允许精确闹钟，提醒可能延迟';
}
function sync(){queue=queue.catch(()=>{}).then(reconcile).catch(e=>{notificationStatus.value='提醒未能安排：'+(e instanceof Error?e.message:'请检查权限');});}
export async function startNativeReminders(){
 if(!native()||started)return;started=true;
 try{
  api=(await import('@capacitor/local-notifications')).LocalNotifications;
  await api.createChannel({id:'rixu-reminders',name:'计划与备忘提醒',importance:5,visibility:1,vibration:true});
  await api.registerActionTypes({types:[{id:'RIXU_REMINDER',actions:[{id:'continue',title:'继续提醒',foreground:true},{id:'stop',title:'不再提醒',foreground:true}]}]});
  await api.addListener('localNotificationReceived',n=>{if(n.extra?.rixu)nativeAlert.value={key:n.extra.key,taskId:n.extra.taskId,at:n.extra.at,title:n.body||'',kind:'repeat'};});
  await api.addListener('localNotificationActionPerformed',event=>{void (async()=>{
   const n=event.notification;if(!n.extra?.rixu)return;
   if(!ready.value)await new Promise<void>(resolve=>{const stop=watch(ready,()=>{if(ready.value){stop();resolve();}});});
   if(event.actionId==='stop'){await changeTaskReminder(n.extra.taskId,'stop');nativeAlert.value=null;notify('已停止这条事项的后续提醒');}
   else if(event.actionId==='continue')nativeAlert.value=null;
   else nativeAlert.value={key:n.extra.key,taskId:n.extra.taskId,at:n.extra.at,title:n.body||'',kind:'repeat'};
   sync();
  })().catch(()=>notify('提醒操作未保存，请重试'));});
  watch([data,ready],sync,{immediate:true});
  const {App}=await import('@capacitor/app');await App.addListener('appStateChange',s=>{if(s.isActive)sync();});
 }catch(e){started=false;notificationStatus.value='通知初始化失败，请重新打开应用';}
}
export async function enableNativeReminders(){
 await startNativeReminders();if(!api)return;
 try{await api.requestPermissions();sync();}catch{notificationStatus.value='通知授权未完成，请在系统设置中开启';}
}
export async function enableExactReminders(){if(api)await api.changeExactNotificationSetting();}
export async function respondNativeReminder(stop:boolean){
 const alert=nativeAlert.value;if(!alert)return;
 if(stop)await changeTaskReminder(alert.taskId,'stop');
 nativeAlert.value=null;sync();
}
