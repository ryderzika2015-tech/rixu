import {ref,shallowRef} from 'vue';
import {STORES,clone,meta,alive,uid,type Snapshot,type Task,type Goal,type Transaction,type Taxon,type Entity,type StoreName,type Change,type Review} from '../domain/model.js';
import {IndexedDbRepository,type Repository,ConflictError} from '../storage/repository.js';
import {baseSnapshot,fromBackup,validateSnapshot,backup,mergeBackup} from '../domain/migration.js';
import {parsePlan,applyPlan,type PlanPreview} from '../domain/plans.js';
import {newTask,validateTask,continueTask} from '../domain/tasks.js';
import {ensureTaxon,tagsFromNames,renameTaxon,removeTaxon} from '../domain/taxonomy.js';
import {dayAt,shiftDay,stampAt} from '../domain/time.js';
import * as Focus from '../domain/focus.js';
import {cet33} from '../data/cet33.js';
import type {Candidate,CaptureMode} from '../domain/capture.js';

export const data=shallowRef<Snapshot>(baseSnapshot());
export const ready=ref(false),busy=ref(false),storageError=ref(''),notice=ref('');
let repositoryFactory:()=>Promise<Repository>=()=>IndexedDbRepository.open();
export function configureRepositoryFactory(factory:()=>Promise<Repository>){if(ready.value)throw Error("ALREADY_INITIALIZED");repositoryFactory=factory}
let repository:Repository;let queue:Promise<unknown>=Promise.resolve();let noticeTimer:ReturnType<typeof setTimeout>;let channel:BroadcastChannel|null=null;
export function notify(message:string){notice.value=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.value='',5000)}
export async function initialize(){
 try{
 repository?.close();channel?.close();repository=await repositoryFactory();let loaded=await repository.load();
 if(!loaded.settings.length){
 let raw:string|null=null;try{raw=localStorage.getItem('rixu.v22.main')}catch(_){}
 let seed:Snapshot;if(raw){try{seed=fromBackup(JSON.parse(raw))}catch(_){throw Error('LEGACY_CORRUPT')}}
 else {seed=baseSnapshot();applyPlan(seed,parsePlan(JSON.stringify(cet33),'cet33.json',seed));}
 const changes:Change[]=[];for(const key of STORES)for(const item of seed[key])changes.push({store:key,value:item,expected:null});
 try{await repository.commit(changes)}catch(e){if(!(e instanceof ConflictError))throw e}loaded=await repository.load();
 }
 validateSnapshot(loaded);data.value=loaded;ready.value=true;storageError.value='';
 if(loaded.settings[0].activeFocus)await execute(s=>{s.settings[0].activeFocus=Focus.recover(s.settings[0].activeFocus!)});
 channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('rixu-change-v3'):null;
 if(channel)channel.onmessage=()=>{queue=queue.then(async()=>{data.value=await repository.load()}).catch(reportError)};
 }catch(e){storageError.value=e instanceof Error?e.message:'STORAGE_UNAVAILABLE';ready.value=false;throw e}
}
export function reportError(e:unknown){notify(e instanceof Error?e.message:'SAVE_FAILED')}
function changesBetween(before:Snapshot,after:Snapshot):Change[]{
 const changes:Change[]=[];for(const name of STORES){const old=new Map((before[name] as Entity[]).map(x=>[x.id,x]));
 for(const item of after[name]){const previous=old.get(item.id);if(!previous||JSON.stringify(previous)!==JSON.stringify(item))changes.push({store:name,value:item,expected:previous?.version??null});}
 // Hard deletion is forbidden here; use tombstones so sync and recycle stay consistent.
 for(const item of before[name])if(!(after[name] as Entity[]).some(x=>x.id===item.id))throw Error('HARD_DELETE_FORBIDDEN');
 }return changes;
}
export function execute<T>(mutate:(s:Snapshot)=>T):Promise<T>{
 const job=queue.then(async()=>{busy.value=true;try{
 const before=await repository.load();const next=clone(before);const result=mutate(next);validateSnapshot(next);await repository.commit(changesBetween(before,next));data.value=await repository.load();channel?.postMessage('changed');return result;
 }finally{busy.value=false}});queue=job.catch(()=>{});return job;
}
export async function safe<T>(work:()=>Promise<T>):Promise<T|undefined>{try{return await work()}catch(e){reportError(e);return undefined}}
export const settings=()=>data.value.settings[0];
export const today=()=>dayAt(Date.now(),settings().timezone);
export function saveTask(task:Task,category:string,tags:string[]|string){return execute(s=>{
 const old=s.tasks.find(t=>t.id===task.id);if(old&&old.version!==task.version)throw new ConflictError();
 const next={...clone(task),categoryId:ensureTaxon(s,'task',category),tagIds:tagsFromNames(s,tags)};validateTask(next);
 if(old)Object.assign(old,next);else s.tasks.push(next);
 })}
export function changeTaskReminder(id:string,action:'stop'|'snooze15'|'snooze60'|'resume'){
 return execute(s=>{const item=s.tasks.find(x=>x.id===id&&!x.deletedAt);if(!item)throw Error('NOT_FOUND');
  if(action==='stop'){item.reminders.mode='off';delete item.reminders.snoozedUntil;}
  else if(action==='resume'){item.reminders.mode='default';delete item.reminders.snoozedUntil;}
  else{item.reminders.mode='default';const minutes=action==='snooze15'?15:60;
   item.reminders.snoozedUntil=stampAt(Date.now()+minutes*60000,s.settings[0].timezone);}
 });
}
export function toggleTask(id:string){return execute(s=>{const t=s.tasks.find(t=>t.id===id&&!t.deletedAt);if(!t)throw Error('NOT_FOUND');t.progress=t.progress>=t.quantity?0:t.quantity;validateTask(t)})}
export function remove(store:StoreName,id:string){return execute(s=>{const r=(s[store] as Entity[]).find(x=>x.id===id);if(!r)throw Error('NOT_FOUND');if(store==='tasks'&&s.settings[0].activeFocus?.taskId===id)throw Error('FOCUS_ACTIVE');r.deletedAt=new Date().toISOString()})}
export function restore(store:StoreName,id:string){return execute(s=>{const r=(s[store] as Entity[]).find(x=>x.id===id);if(!r)throw Error('NOT_FOUND');delete r.deletedAt})}
export function saveGoal(g:Goal,category:string,tags:string[]|string){return execute(s=>{const old=s.goals.find(x=>x.id===g.id);if(old&&old.version!==g.version)throw new ConflictError();const next={...clone(g),categoryId:ensureTaxon(s,'task',category),tagIds:tagsFromNames(s,tags)};if(old)Object.assign(old,next);else s.goals.push(next)})}
export function checkGoal(id:string,date=today()){return execute(s=>{const g=s.goals.find(x=>x.id===id);if(!g)throw Error('NOT_FOUND');if(!g.checkins.includes(date))g.checkins.push(date)})}
export function saveTransaction(t:Transaction,category:string,tags:string[]|string){return execute(s=>{const old=s.transactions.find(x=>x.id===t.id);if(old&&old.version!==t.version)throw new ConflictError();const next={...clone(t),categoryId:ensureTaxon(s,t.type,category),tagIds:tagsFromNames(s,tags)};if(old)Object.assign(old,next);else s.transactions.push(next)})}
export function importPlan(p:PlanPreview){return execute(s=>applyPlan(s,p))}
export function deletePlan(id:string,deleteTasks:boolean){return execute(s=>{const p=s.plans.find(x=>x.id===id);if(!p)throw Error('NOT_FOUND');if(deleteTasks&&s.tasks.some(x=>x.planId===id&&x.id===s.settings[0].activeFocus?.taskId))throw Error('FOCUS_ACTIVE');p.deletedAt=new Date().toISOString();for(const t of s.tasks.filter(x=>x.planId===id)){if(deleteTasks)t.deletedAt=new Date().toISOString();else t.planId=''}for(const g of s.goals.filter(x=>x.planId===id))g.planId=''})}
export function saveCapture(candidates:Candidate[],mode:CaptureMode,batchId=uid()){return execute(s=>{
 const prefix='capture:'+batchId+':';if([...s.tasks,...s.transactions,...s.drafts].some(x=>x.id.startsWith(prefix)))return;let idx=0;
 // A ledger entry point is a strict write boundary, even if a parser returns the wrong kind.
 if(mode==='ledger'&&candidates.some(x=>x.selected&&x.kind==='task'))throw Error('LEDGER_BOUNDARY');
 for(const c of candidates){const id=prefix+(idx++);if(c.kind==='pending'||!c.selected)continue;
 if(c.kind==='transaction'){if(!c.amount||!Number.isSafeInteger(c.amount))throw Error('INVALID_MONEY');s.transactions.push({...meta(id),title:c.title,date:c.date,type:c.type||'expense',amount:c.amount,currency:'CNY',categoryId:ensureTaxon(s,c.type||'expense',c.category||''),tagIds:tagsFromNames(s,c.tags||''),note:''})}
 else {const t=newTask(c.date,ensureTaxon(s,'task',c.category||''));t.id=id;t.title=c.title;t.estimate=0;t.deadline=c.deadline||'';t.type=c.date>today()&&!!c.deadline?'memo':'task';t.source=t.type==='memo'?'memo':'manual';validateTask(t);s.tasks.push(t)}}
 })}
export function saveRawDraft(text:string,mode:CaptureMode){return execute(s=>{s.drafts.push({...meta(),raw:text,mode,reason:'DRAFT',date:today()})})}
export function renameCategory(id:string,name:string){return execute(s=>renameTaxon(s,id,name))}
export function deleteCategory(id:string,target?:string){return execute(s=>removeTaxon(s,id,target))}
export function addCategory(name:string,scope:Taxon['scope']){return execute(s=>ensureTaxon(s,scope,name))}
export function beginFocus(task:Task,minutes:number,mode:'learning'|'strict'){return execute(s=>{if(s.settings[0].activeFocus)throw Error('FOCUS_ACTIVE');const current=s.tasks.find(x=>x.id===task.id&&!x.deletedAt);if(!current||current.status==='done'||current.status==='cancelled')throw Error('NOT_FOUND');s.settings[0].activeFocus=Focus.startFocus(current,minutes,mode);s.settings[0].focusPreferences[task.categoryId]={minutes,mode,sound:'off'}})}
export function updateFocus(action:'pause'|'resume'|'checkpoint',now=Date.now()){return execute(s=>{const p=s.settings[0],f=p.activeFocus;if(!f)return;p.activeFocus=action==='pause'?Focus.pause(f,p.timezone,now):action==='resume'?Focus.resume(f,now):Focus.checkpoint(f,p.timezone,now)})}
export function finishFocus(progress?:number,now=Date.now()){return execute(s=>{const p=s.settings[0],f=p.activeFocus;if(!f)return;const session=Focus.finish(f,p.timezone,now);if(session.seconds>0&&!s.sessions.some(x=>x.id===session.id))s.sessions.push(session);if(progress!==undefined){const t=s.tasks.find(x=>x.id===f.taskId);if(t){t.progress=progress;validateTask(t)}}p.activeFocus=null;return session})}
export function adjustFocus(id:string,seconds:number){return execute(s=>{const f=s.sessions.find(x=>x.id===id);if(!f)throw Error('NOT_FOUND');Object.assign(f,Focus.adjustSession(f,seconds))})}
export function planTomorrow(from:string,ids:string[],extra:Task|null,reflection:string,capacity:number){return execute(s=>{
 const to=shiftDay(from,1);for(const id of ids)continueTask(s,id,to);if(extra){validateTask(extra);s.tasks.push(extra)}
 const old=s.reviews.find(x=>x.id==='review-'+from);if(old){old.text=reflection}else s.reviews.push({...meta('review-'+from),date:from,text:reflection,capacity:s.settings[0].capacity});
 const next=s.reviews.find(x=>x.id==='review-'+to);if(next)next.capacity=capacity;else s.reviews.push({...meta('review-'+to),date:to,text:'',capacity});
 })}
export function saveReview(day:string,text:string){return execute(s=>{const r=s.reviews.find(x=>x.id==='review-'+day);if(r)r.text=text;else s.reviews.push({...meta('review-'+day),date:day,text,capacity:s.settings[0].capacity})})}
export function importBackup(incoming:Snapshot,replace=false){return execute(s=>{
 if(s.settings[0].activeFocus)throw Error('FOCUS_ACTIVE');const recovery={...meta(),reason:replace?'before-replace':'before-merge',raw:backup({...s,recovery:[]})};
 if(replace){for(const store of STORES){if(['settings','recovery'].includes(store))continue;for(const x of s[store])x.deletedAt=new Date().toISOString();}
 for(const store of STORES){if(store==='recovery')continue;for(const x of incoming[store]){const list=s[store] as Entity[],old=list.find(y=>y.id===x.id);if(old){const version=old.version;list[list.findIndex(y=>y.id===x.id)]={...clone(x),version}}else list.push(clone(x))}}}
 else {const merged=mergeBackup(s,incoming);for(const store of STORES)(s as any)[store]=merged[store]}
 s.recovery.push(recovery);s.settings[0].activeFocus=null;
 })}
export const exportBackup=()=>backup(data.value);
export function download(name:string,value:unknown,type='application/json;charset=utf-8'){
 const content=typeof value==='string'?value:JSON.stringify(value,null,2),url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
