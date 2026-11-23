import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
test('OS queue survives without timers; stop cancels only this apps pending alerts',async()=>{
 const callbacks={};let pending=[],nodes=[0,1,2].map(i=>({key:'task:cycle:'+i,taskId:'task',title:'Test',at:Date.now()+60000+i*900000,kind:'repeat'}));
 const api={createChannel:async()=>{},registerActionTypes:async()=>{},checkPermissions:async()=>({display:'granted'}),checkExactNotificationSetting:async()=>({exact_alarm:'granted'}),getPending:async()=>({notifications:pending}),cancel:async({notifications})=>{pending=pending.filter(n=>!notifications.some(c=>c.id===n.id));},schedule:async({notifications})=>pending.push(...notifications),addListener:async(name,cb)=>{callbacks[name]=cb;}};
 globalThis.Capacitor={isNativePlatform:()=>true};const foreign={id:99,extra:{other:true}};pending.push(foreign);
 globalThis.__nr={data:{value:{tasks:[],settings:[{}]}},ready:{value:true},changeTaskReminder:async(id,action)=>{assert.equal(id,'task');assert.equal(action,'stop');nodes=[];},notify:()=>{},reminderNodes:()=>nodes,api,App:{addListener:async()=>{}},watch:(_src,cb,options)=>{if(options?.immediate)cb();return ()=>{};}};
 let src=readFileSync(new URL('../src/services/native-reminders.ts',import.meta.url),'utf8');
 src=src.replace(/import .*? from 'vue';/,"const ref=value=>({value});const watch=globalThis.__nr.watch;")
 .replace(/import .*? from '\.\/store.js';/,"const {data,ready,changeTaskReminder,notify}=globalThis.__nr;")
 .replace(/import .*? from '\.\.\/domain\/reminders.js';/,"const {reminderNodes}=globalThis.__nr;")
 .replace("(await import('@capacitor/local-notifications')).LocalNotifications",'globalThis.__nr.api')
 .replace("await import('@capacitor/app')",'globalThis.__nr');
 const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
 const service=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const settle=()=>new Promise(r=>setTimeout(r,30));
 try{
  await service.startNativeReminders();await settle();assert.equal(pending.length,4);
  assert.equal(new Set(pending.map(n=>n.id)).size,4);
  callbacks.localNotificationReceived({body:'Test',extra:pending[1].extra});assert.equal(service.nativeAlert.value.taskId,'task');
  await service.respondNativeReminder(false);await settle();assert.equal(pending.length,4);
  callbacks.localNotificationActionPerformed({actionId:'stop',notification:pending[1]});await settle();assert.deepEqual(pending,[foreign]);
 }finally{delete globalThis.Capacitor;delete globalThis.__nr;}
});
