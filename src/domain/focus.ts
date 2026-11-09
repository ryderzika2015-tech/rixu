import {clone,meta,uid,type ActiveFocus,type Task,type FocusSession} from './model.js';
import {splitInterval} from './time.js';
export function startFocus(t:Task,minutes:number,mode:'learning'|'strict',now=Date.now()):ActiveFocus{
 if(!Number.isFinite(minutes)||minutes<1||minutes>240)throw Error('INVALID_DURATION');
 return {id:uid(),taskId:t.id,taskTitle:t.title,categoryId:t.categoryId,tagIds:[...t.tagIds],targetSeconds:minutes*60,accumulated:0,tickAt:now,startedAt:new Date(now).toISOString(),mode,segments:[],paused:false,sound:'off'};
}
export function elapsed(f:ActiveFocus,now=Date.now()):number{return Math.min(f.targetSeconds,f.accumulated+(f.tickAt===null?0:Math.max(0,now-f.tickAt)/1000))}
export function checkpoint(f:ActiveFocus,zone:string,now=Date.now()):ActiveFocus{
 const r=clone(f);if(r.tickAt!==null){const delta=Math.min(Math.max(0,now-r.tickAt)/1000,Math.max(0,r.targetSeconds-r.accumulated));r.segments.push(...splitInterval(r.tickAt,r.tickAt+delta*1000,zone));r.accumulated+=delta;r.tickAt=now;}
 if(r.accumulated>=r.targetSeconds){r.tickAt=null;r.paused=true}return r;
}
export function pause(f:ActiveFocus,zone:string,now=Date.now()):ActiveFocus{const r=checkpoint(f,zone,now);r.tickAt=null;r.paused=true;return r}
export function resume(f:ActiveFocus,now=Date.now()):ActiveFocus{if(f.accumulated>=f.targetSeconds)return f;return {...f,tickAt:now,paused:false}}
export function recover(f:ActiveFocus):ActiveFocus{return {...f,tickAt:null,paused:true}}
export function finish(f:ActiveFocus,zone:string,now=Date.now()):FocusSession{const r=pause(f,zone,now);return {...meta(f.id),taskId:r.taskId,taskTitle:r.taskTitle,categoryId:r.categoryId,tagIds:r.tagIds,startedAt:r.startedAt,endedAt:new Date(now).toISOString(),targetSeconds:r.targetSeconds,seconds:r.accumulated,segments:r.segments,mode:r.mode,audit:[],completed:r.accumulated>=r.targetSeconds}}
export function adjustSession(s:FocusSession,seconds:number):FocusSession{if(!Number.isFinite(seconds)||seconds<0||seconds>s.targetSeconds)throw Error('INVALID_DURATION');const next=clone(s),ratio=s.seconds?seconds/s.seconds:0;if(!s.seconds&&seconds>0)throw Error('INVALID_DURATION');next.segments=next.segments.map(x=>({...x,seconds:x.seconds*ratio}));next.seconds=seconds;next.audit.push({at:new Date().toISOString(),before:s.seconds,after:seconds});return next}
