import {type Task,type Settings} from './model.js';
import {instant,stampAt,shiftDay} from './time.js';
import {done} from './tasks.js';
export interface ReminderNode {key:string;taskId:string;at:number;kind:'start-before'|'start'|'deadline-far'|'deadline-near'|'deadline'|'end'|'snooze'|'repeat';title:string}
/** Generate reminders to be scheduled later by an OS adapter. Browser preview is not a background scheduler. */
export function reminderNodes(tasks:Task[],prefs:Settings,now=Date.now()):ReminderNode[]{
 const all:ReminderNode[]=[];
 for(const t of tasks){
  if(t.deletedAt||done(t)||t.status==='cancelled'||t.reminders.mode==='off')continue;
  const nodes:ReminderNode[]=[];
  const due=t.deadline?instant(t.deadline,prefs.timezone):Infinity;
  const snooze=t.reminders.snoozedUntil?instant(t.reminders.snoozedUntil,prefs.timezone):0;
  const add=(original:number,kind:ReminderNode['kind'])=>{
   let at=original;
   if(!Number.isFinite(at)||at<=now||at<snooze)return;
   if(prefs.quiet){const local=stampAt(at,prefs.timezone),h=+local.slice(11,13);
    if(h<8)at=instant(shiftDay(local.slice(0,10),-1)+'T21:50',prefs.timezone);
    else if(h>=22)at=instant(local.slice(0,10)+'T21:50',prefs.timezone);
    if(at<=now||at<snooze||(at>=due&&kind!=='deadline'&&kind!=='snooze'))return;
   }
   if(!nodes.some(x=>Math.abs(x.at-at)<600000))nodes.push({key:`${t.id}:${kind}:${at}`,taskId:t.id,at,kind,title:t.title});
  };
  if(t.reminders.mode==='custom')for(const value of t.reminders.custom)add(instant(value,prefs.timezone),'deadline-near');
  else if(t.deadline){
   add(due-prefs.farDays*86400000,'deadline-far');
   add(due-prefs.nearHours*3600000,'deadline-near');
   if(due>now&&!nodes.some(x=>x.kind==='deadline-near')){
    const left=due-now;add(left>1800000?due-1800000:left>300000?due-300000:now+Math.min(60000,left/2),'deadline-near');
   }
   if(prefs.overdue)add(due,'deadline');
  }
  if(prefs.startAlerts&&t.start){const start=instant(t.start,prefs.timezone);add(start-600000,'start-before');add(start,'start');}
  if(prefs.overdue&&t.end)add(instant(t.end,prefs.timezone),'end');
  if(snooze>now)add(snooze,'snooze');
  // Up to N total alerts per original reminder (one initial + N-1 follow-ups).
  const count=Math.min(5,Math.max(1,Math.floor(t.reminders.repeatCount??prefs.repeatCount??1)));
  const minutes=Math.min(240,Math.max(5,Math.floor(t.reminders.repeatMinutes??prefs.repeatMinutes??30)));
  if(count>1){const seeds=[...nodes].filter(x=>x.kind==='deadline-near'||x.kind==='start');
   for(const seed of seeds)for(let index=1;index<count;index++){
    const at=seed.at+index*minutes*60000;
    if(at<due)add(at,'repeat');
   }
  }
  all.push(...nodes);
 }
 return all.sort((a,b)=>a.at-b.at);
}
