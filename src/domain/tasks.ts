import {meta,alive,type Task,type Snapshot} from './model.js';
import {validDay,validStamp,shiftDay} from './time.js';
export function newTask(date:string,categoryId:string):Task {return {...meta(),title:'',date,categoryId,tagIds:[],estimate:25,quantity:1,unit:'\u9879',progress:0,required:true,status:'pending',type:'task',note:'',start:'',end:'',deadline:'',planId:'',source:'manual',knowledge:'',stage:'',actualLegacySeconds:0,reminders:{mode:'default',custom:[]}}}
export function validateTask(t:Task):void{
 if(typeof t.title!=='string'||!t.reminders||!Array.isArray(t.reminders.custom)||!t.title.trim()||t.title.length>500||!validDay(t.date))throw Error('INVALID_TASK');
 if(!Number.isFinite(t.estimate)||t.estimate<0||t.estimate>1440||!Number.isFinite(t.quantity)||t.quantity<=0||!Number.isFinite(t.progress)||t.progress<0||t.progress>t.quantity)throw Error('INVALID_QUANTITY');
 for(const x of [t.start,t.end,t.deadline,...t.reminders.custom,t.reminders.snoozedUntil||''])if(x&&!validStamp(x))throw Error('INVALID_TIME');
 if(!['task','memo'].includes(t.type)||!['default','custom','off'].includes(t.reminders.mode))throw Error('INVALID_TYPE');if(t.start&&t.end&&t.start>=t.end)throw Error('INVALID_RANGE');if(t.type==='memo'&&!t.deadline)throw Error('DEADLINE_REQUIRED');
 if(t.deadline&&(t.type==='memo'||t.source==='memo'))t.date=t.deadline.slice(0,10);
 t.status=t.status==='cancelled'?'cancelled':t.progress>=t.quantity?'done':t.progress>0?'partial':'pending';
}
export const done=(t:Task)=>t.status==='done'||t.progress>=t.quantity;
export function tasksOn(s:Snapshot,day:string):Task[]{return alive(s.tasks).filter(t=>t.status!=='cancelled'&&(t.type==='memo'?t.deadline.slice(0,10):t.date)===day)}
export function futureMemos(s:Snapshot,day:string,range=7){return alive(s.tasks).filter(t=>t.type==='memo'&&!done(t)&&t.status!=='cancelled'&&t.deadline.slice(0,10)>day&&(!range||t.deadline.slice(0,10)<=shiftDay(day,range))).sort((a,b)=>a.deadline.localeCompare(b.deadline))}
export function continueTask(s:Snapshot,id:string,date:string):Task{
 if(!validDay(date))throw Error('INVALID_DATE');const old=s.tasks.find(x=>x.id===id&&!x.deletedAt);if(!old)throw Error('NOT_FOUND');
 if(done(old))throw Error('ALREADY_DONE');if(date<=old.date)throw Error('INVALID_DATE');
 const existing=alive(s.tasks).find(x=>x.carriedFrom===id&&x.date===date);if(existing)return existing;
 const next={...old,...meta(),date,quantity:old.quantity-old.progress,progress:0,status:'pending' as const,actualLegacySeconds:0,carriedFrom:id,type:'task' as const,start:'',end:'',deadline:'',source:'continuation'};s.tasks.push(next);return next;
}
export function calendarStatus(s:Snapshot,day:string,today:string):'green'|'yellow'|'red'|'gray'{
 if(day>today)return 'gray';const tasks=tasksOn(s,day);if(!tasks.length)return 'gray';const required=tasks.filter(t=>t.required);
 if(required.length&&required.every(done))return 'green';
 const activity=tasks.some(t=>t.progress>0||t.actualLegacySeconds>0)||s.sessions.some(x=>!x.deletedAt&&x.segments.some(seg=>seg.date===day&&seg.seconds>0));
 if(day===today||activity||s.settings[0]?.activeFocus?.segments.some(seg=>seg.date===day&&seg.seconds>0))return 'yellow';return required.length?'red':'gray';
}
