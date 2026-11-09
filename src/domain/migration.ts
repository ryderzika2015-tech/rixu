import {emptySnapshot,initialSettings,meta,clone,STORES,SCHEMA,type Snapshot,type Task,type Transaction,type Goal,type FocusSession} from './model.js';
import {ensureTaxon,tagsFromNames,DEFAULT_CATEGORIES} from './taxonomy.js';
import {newTask,validateTask} from './tasks.js';
import {validDay,dayAt,instant} from './time.js';
export function baseSnapshot():Snapshot{const s=emptySnapshot();s.settings.push(initialSettings());for(const scope of ['task','expense','income'] as const)for(const name of DEFAULT_CATEGORIES[scope])ensureTaxon(s,scope,name);return s}
function recordId(x:any):string{if(typeof x?.id!=='string'||!x.id||x.id.length>160)throw Error('INVALID_ID');return x.id}
function finite(x:any,fallback=0){if(x===undefined)return fallback;if(!Number.isFinite(x)||x<0)throw Error('INVALID_NUMBER');return x}
function date(x:any){if(!validDay(x))throw Error('INVALID_DATE');return x}
export function validateSnapshot(s:Snapshot):Snapshot{
 if(!s||typeof s!=='object')throw Error('INVALID_BACKUP');for(const store of STORES){if(!Array.isArray(s[store]))throw Error('INVALID_BACKUP');const ids=new Set();for(const x of s[store]){recordId(x);if(ids.has(x.id))throw Error('DUPLICATE_ID');ids.add(x.id);if(!Number.isInteger(x.version)||x.version<0)throw Error('INVALID_VERSION')}}
 if(s.settings.length!==1||s.settings[0].schemaVersion!==SCHEMA)throw Error('SCHEMA_MISMATCH');new Intl.DateTimeFormat('en',{timeZone:s.settings[0].timezone});
 for(const t of s.tasks){validateTask(t);finite(t.actualLegacySeconds)}for(const x of s.transactions){date(x.date);if(!x.title||!['expense','income'].includes(x.type)||!Number.isSafeInteger(x.amount)||x.amount<=0||x.currency!=='CNY')throw Error('INVALID_MONEY')}
 for(const g of s.goals){date(g.date);if(!g.title||!['habit','milestone'].includes(g.kind)||!Array.isArray(g.checkins)||g.checkins.some(x=>!validDay(x)))throw Error('INVALID_GOAL')}
 for(const f of s.sessions){finite(f.seconds);if(!Array.isArray(f.segments)||f.segments.some(x=>!validDay(x.date)||!Number.isFinite(x.seconds)||x.seconds<0))throw Error('INVALID_SESSION');if(Math.abs(f.segments.reduce((n,x)=>n+x.seconds,0)-f.seconds)>.01)throw Error('INVALID_SESSION')}
 return s;
}
export function fromBackup(raw:any):Snapshot{
 if(raw?.format==='rixu.backup.v3')return validateSnapshot(clone(raw.data));
 if(!raw||!Array.isArray(raw.tasks)||!Array.isArray(raw.transactions)||!Array.isArray(raw.goals))throw Error('INVALID_BACKUP');
 const s=baseSnapshot();const settings=s.settings[0];settings.extra={legacy:clone(raw.prefs||{}),legacyFocusPreferences:clone(raw.focusPrefs||{})};
 settings.timezone=raw.prefs?.timezone||'Asia/Shanghai';new Intl.DateTimeFormat('en',{timeZone:settings.timezone});settings.capacity=finite(raw.prefs?.capacity,360);settings.farDays=finite(raw.prefs?.farDays,3);settings.nearHours=finite(raw.prefs?.nearHours,4);settings.repeatCount=1;settings.repeatMinutes=30;settings.startAlerts=raw.prefs?.startAlerts??true;settings.quiet=raw.prefs?.quiet??true;settings.overdue=!!raw.prefs?.overdue;
 const budget=raw.prefs?.budget;if(Number.isSafeInteger(budget)&&budget>=0)settings.budgets[(validDay(raw.seedDate)?raw.seedDate:dayAt()).slice(0,7)]=budget;
 for(const [k,v] of Object.entries(raw.budgets||{}))if(/^\d{4}-\d{2}$/.test(k)&&Number.isSafeInteger(v)&&Number(v)>=0)settings.budgets[k]=Number(v);
 for(const scope of ['task','expense','income'] as const)for(const name of raw.categories?.[scope]||[])ensureTaxon(s,scope,String(name));
 for(const label of raw.labels||[])ensureTaxon(s,'tag',String(label));
 const sessions=[...(raw.focusSessions||[]),...(raw.focusActive?[raw.focusActive]:[])];
 const oldFocusByTask=new Map<string,number>();for(const f of sessions)oldFocusByTask.set(f.taskId,(oldFocusByTask.get(f.taskId)||0)+finite(f.elapsedMs)/1000);
 const seen=new Set();
 const addTask=(t:any,deletedAt?:string)=>{
 const id=recordId(t);if(seen.has('t'+id))throw Error('DUPLICATE_ID');seen.add('t'+id);const categoryId=ensureTaxon(s,'task',String(t.category||''));
 const x:Task={...newTask(date(t.date),categoryId),...meta(id),title:String(t.title||''),estimate:finite(t.estimate),quantity:finite(t.quantity,1),unit:String(t.unit||'\u9879'),progress:finite(t.progress),required:t.required!==false,status:t.status||'pending',type:t.type==='memo'?'memo':'task',tagIds:tagsFromNames(s,t.tags||[]),note:String(t.note||''),start:t.start||'',end:t.end||'',deadline:t.deadline||'',planId:t.planId||(t.source==='cet33'?'cet33':''),source:t.source||'legacy',stage:t.stage||'',knowledge:t.knowledge||'',actualLegacySeconds:Math.max(0,finite(t.actual)*60-(oldFocusByTask.get(id)||0)),carriedFrom:t.carriedFrom||t.continuedFrom||undefined,reminders:{mode:t.reminderMode==='off'?'off':t.reminderMode==='custom'?'custom':'default',custom:t.customReminder?[t.customReminder]:[]},extra:clone(t),deletedAt};validateTask(x);s.tasks.push(x);
 };
 const addTransaction=(t:any,deletedAt?:string)=>{const id=recordId(t);if(seen.has('x'+id))throw Error('DUPLICATE_ID');seen.add('x'+id);if(!['expense','income'].includes(t.type)||!Number.isSafeInteger(t.amount)||t.amount<=0)throw Error('INVALID_MONEY');const x:Transaction={...meta(id),title:String(t.title||''),date:date(t.date),type:t.type,amount:t.amount,currency:'CNY',categoryId:ensureTaxon(s,t.type,String(t.category||'')),tagIds:tagsFromNames(s,t.tags||[]),note:String(t.note||''),extra:clone(t),deletedAt};s.transactions.push(x)};
 const addGoal=(g:any,deletedAt?:string)=>{const id=recordId(g);if(seen.has('g'+id))throw Error('DUPLICATE_ID');seen.add('g'+id);s.goals.push({...meta(id),title:String(g.title||''),date:date(g.date),kind:g.kind==='habit'?'habit':'milestone',categoryId:ensureTaxon(s,'task',g.category||''),tagIds:tagsFromNames(s,g.tags||[]),note:g.note||'',planId:g.planId||g.plan||'',done:!!g.done,checkins:[...new Set(g.checkins||[])] as string[],extra:clone(g),deletedAt})};
 for(const t of raw.tasks)addTask(t);for(const t of raw.transactions)addTransaction(t);for(const g of raw.goals)addGoal(g);
 for(const bin of raw.trash||[]){if(!bin.record)continue;const removed=bin.deletedAt||bin.at||new Date().toISOString();if(bin.kind==='task')addTask(bin.record,removed);else if(bin.kind==='transaction')addTransaction(bin.record,removed);else if(bin.kind==='goal')addGoal(bin.record,removed)}
 for(const p of raw.plans||[]){s.plans.push({...meta(recordId(p)),name:p.name||p.id,externalId:p.externalId||p.id,note:'',extra:clone(p)})}
 if(s.tasks.some(t=>t.planId==='cet33')&&!s.plans.some(p=>p.id==='cet33'))s.plans.push({...meta('cet33'),name:'\u516d\u7ea7 33 \u5929\u8ba1\u5212',externalId:'cet33',note:''});
 for(const f of sessions){const t=s.tasks.find(x=>x.id===f.taskId);const seconds=finite(f.elapsedMs)/1000;const segments=(f.segments||[]).map((seg:any)=>{const d=date(seg.date),sec=finite(seg.ms)/1000,from=instant(d+'T00:00',settings.timezone);return {date:d,from,to:from+sec*1000,seconds:sec}});if(Math.abs(segments.reduce((n:number,x:any)=>n+x.seconds,0)-seconds)>.01)throw Error('INVALID_SESSION');s.sessions.push({...meta(recordId(f)),taskId:f.taskId,taskTitle:f.taskTitle||t?.title||'',categoryId:t?.categoryId||ensureTaxon(s,'task',f.category||''),tagIds:t?.tagIds||[],startedAt:f.startedAt||'',endedAt:f.endedAt||'',targetSeconds:finite(f.targetMs)/1000,seconds,segments,mode:f.mode==='strict'?'strict':'learning',audit:f.adjustments||[],completed:f.status==='completed',extra:clone(f)});}
 for(const [d,text] of Object.entries(raw.reviews||{})){if(!validDay(d))continue;s.reviews.push({...meta('review-'+d),date:d,text:String(text),capacity:raw.dayPlans?.[d]?.capacity||settings.capacity})}
 for(const x of raw.inbox||[]){s.drafts.push({...meta(recordId(x)),raw:x.raw||x.text||'',mode:x.mode||'auto',reason:x.reason||'NEEDS_CONFIRMATION',date:validDay(x.date)?x.date:dayAt(),extra:clone(x)})}
 // Preserve all unknown data, old restoration points and paused timers in the original recovery object.
 s.recovery.push({...meta(),reason:'legacy-import',raw:clone(raw)});
 for(const a of raw.taxonomyAliases||[]){const target=s.taxa.find(c=>c.scope===a.scope&&c.name===a.to&&!c.deletedAt);if(target&&!target.aliases.includes(a.from))target.aliases.push(a.from)}
 return validateSnapshot(s);
}
export function backup(s:Snapshot){return {format:'rixu.backup.v3',schemaVersion:SCHEMA,exportedAt:new Date().toISOString(),data:clone(s)}}

export function mergeBackup(current:Snapshot,incoming:Snapshot){
 const out=clone(current),taxMap=new Map<string,string>(),planMap=new Map<string,string>(),taskMap=new Map<string,string>();
 for(const c of incoming.taxa){const same=out.taxa.find(x=>x.id===c.id||(!x.deletedAt&&!c.deletedAt&&x.scope===c.scope&&x.name===c.name));if(same){taxMap.set(c.id,same.id);same.aliases=[...new Set([...same.aliases,...c.aliases])]}else{out.taxa.push(clone(c));taxMap.set(c.id,c.id)}}
 for(const p of incoming.plans){const same=out.plans.find(x=>x.id===p.id||(!x.deletedAt&&!p.deletedAt&&p.externalId&&x.externalId===p.externalId));if(same)planMap.set(p.id,same.id);else{out.plans.push(clone(p));planMap.set(p.id,p.id)}}
 const remap=(item:any)=>{const x=clone(item);if(x.categoryId)x.categoryId=taxMap.get(x.categoryId)||x.categoryId;if(x.tagIds)x.tagIds=x.tagIds.map((id:string)=>taxMap.get(id)||id);if(x.planId)x.planId=planMap.get(x.planId)||x.planId;return x};
 // Only an untouched preloaded CET task may be replaced by its legacy identity.
 // Arbitrary equal-looking expense rows must never be deduplicated by amount/title.
 for(const t of incoming.tasks){const same=out.tasks.find(x=>x.id===t.id);if(same){taskMap.set(t.id,same.id);continue}const seed=out.tasks.find(x=>!x.deletedAt&&x.source==='cet33'&&t.source==='cet33'&&x.title===t.title&&x.date===t.date&&x.progress===0&&x.actualLegacySeconds===0&&!out.sessions.some(f=>f.taskId===x.id));if(seed){seed.deletedAt=new Date().toISOString();seed.extra={...seed.extra,mergedInto:t.id};}out.tasks.push(remap(t));taskMap.set(t.id,t.id)}
 for(const key of STORES){if(['settings','taxa','plans','tasks'].includes(key))continue;const target=(out as any)[key] as any[];for(const item of incoming[key]){if(target.some(x=>x.id===item.id))continue;const x=remap(item);if(x.taskId)x.taskId=taskMap.get(x.taskId)||x.taskId;if(key==='goals'){const same=out.goals.find(g=>!g.deletedAt&&!g.done&&g.title===x.title&&g.date===x.date&&g.planId&&g.planId===x.planId&&!g.checkins.length);if(same)same.deletedAt=new Date().toISOString()}target.push(x)}}
 const prefs=out.settings[0],other=incoming.settings[0];for(const [month,amount] of Object.entries(other.budgets))if(!(month in prefs.budgets))prefs.budgets[month]=amount;
 return validateSnapshot(out);
}
export function mergeConflicts(current:Snapshot,incoming:Snapshot):number{
 let count=0;for(const store of ['tasks','transactions','goals','sessions'] as const)for(const item of incoming[store]){const existing=(current[store] as any[]).find(x=>x.id===item.id);if(!existing)continue;const norm=(x:any)=>{const c=clone(x);delete c.version;delete c.updatedAt;return JSON.stringify(c)};if(norm(existing)!==norm(item))count++}return count;
}
