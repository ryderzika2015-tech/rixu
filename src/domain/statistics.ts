import {alive,type Snapshot} from './model.js';
import {tasksOn,done} from './tasks.js';
import {splitInterval} from './time.js';
import {elapsed} from './focus.js';
export function taskSummary(s:Snapshot,day:string){const ts=tasksOn(s,day),required=ts.filter(t=>t.required);return {total:ts.length,required:required.length,completed:required.filter(done).length,estimate:ts.reduce((n,t)=>n+t.estimate,0),seconds:timeGroups(s,day,day).reduce((n,x)=>n+x.seconds,0)}}
export function timeGroups(s:Snapshot,a:string,b:string,now=Date.now()){
 const m=new Map<string,number>();
 for(const t of alive(s.tasks))if(t.date>=a&&t.date<=b&&t.actualLegacySeconds>0)m.set(t.categoryId,(m.get(t.categoryId)||0)+t.actualLegacySeconds);
 for(const f of alive(s.sessions)){
  const n=f.segments.filter(x=>x.date>=a&&x.date<=b).reduce((sum,x)=>sum+x.seconds,0);
  if(n>0)m.set(f.categoryId,(m.get(f.categoryId)||0)+n);
 }
 const active=s.settings[0]?.activeFocus;
 if(active){
  // Persisted checkpoints + the currently running interval. Include it immediately,
  // without requiring that the task or the focus round be marked complete.
  let n=active.segments.filter(x=>x.date>=a&&x.date<=b).reduce((sum,x)=>sum+x.seconds,0);
  if(active.tickAt!==null&&!active.paused){
   const liveSeconds=Math.max(0,elapsed(active,now)-active.accumulated);
   n+=splitInterval(active.tickAt,active.tickAt+liveSeconds*1000,s.settings[0].timezone)
    .filter(x=>x.date>=a&&x.date<=b).reduce((total,x)=>total+x.seconds,0);
  }
  if(n>0)m.set(active.categoryId,(m.get(active.categoryId)||0)+n);
 }
 return [...m].map(([id,seconds])=>({id,seconds})).filter(x=>x.seconds>0).sort((x,y)=>y.seconds-x.seconds);
}
export function financeSummary(s:Snapshot,a:string,b:string){const rows=alive(s.transactions).filter(x=>x.date>=a&&x.date<=b);const income=rows.filter(x=>x.type==='income').reduce((n,x)=>n+x.amount,0),expense=rows.filter(x=>x.type==='expense').reduce((n,x)=>n+x.amount,0);return {rows,income,expense,balance:income-expense}}
export function financeGroups(s:Snapshot,a:string,b:string,type:'income'|'expense'){const m=new Map<string,number>();for(const t of financeSummary(s,a,b).rows)if(t.type===type)m.set(t.categoryId,(m.get(t.categoryId)||0)+t.amount);return [...m].map(([id,value])=>({id,value})).sort((x,y)=>y.value-x.value)}
