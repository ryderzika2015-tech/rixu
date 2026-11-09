export function validDay(s:unknown):s is string {if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s}
export function validStamp(s:string):boolean {return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)&&validDay(s.slice(0,10))&&+s.slice(11,13)<24&&+s.slice(14)<60}
export function shiftDay(s:string,n:number):string {if(!validDay(s)||!Number.isInteger(n))throw Error('INVALID_DATE');return new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)}
export const dayDiff=(a:string,b:string)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
export function dayAt(at=Date.now(),zone='Asia/Shanghai'):string {const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);const g=(k:string)=>p.find(x=>x.type===k)!.value;return `${g('year')}-${g('month')}-${g('day')}`}
export function stampAt(at=Date.now(),zone='Asia/Shanghai'):string {const p=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);const g=(k:string)=>p.find(x=>x.type===k)!.value;return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`}
export function instant(local:string,zone='Asia/Shanghai'):number {
 if(!validStamp(local))throw Error('INVALID_TIME');
 let t=Date.parse(local+':00Z');const target=t;
 for(let i=0;i<4;i++){const actual=Date.parse(stampAt(t,zone)+':00Z');const delta=target-actual;if(delta===0)return t;t+=delta;}
 if(stampAt(t,zone)!==local)throw Error('AMBIGUOUS_TIME');return t;
}
export const minutesLabel=(n:number)=>{n=Math.round(n);return n>=60?`${Math.floor(n/60)}h${n%60?' '+n%60+'m':''}`:`${n}m`};
export const clock=(seconds:number)=>`${String(Math.floor(Math.max(0,seconds)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,seconds)%60)).padStart(2,'0')}`;
export const prettyDay=(s:string)=>new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));
export function splitInterval(from:number,to:number,zone:string){
 const out:{from:number;to:number;date:string;seconds:number}[]=[];if(to<=from)return out;
 let cursor=from;while(cursor<to){const date=dayAt(cursor,zone);const midnight=instant(shiftDay(date,1)+'T00:00',zone);const end=Math.min(to,midnight);out.push({from:cursor,to:end,date,seconds:(end-cursor)/1000});cursor=end;}return out;
}
export function rangeFor(type:string,day:string):[string,string]{
 const y=+day.slice(0,4),m=+day.slice(5,7);let a=day,b=day;
 const monthEnd=(yr:number,mo:number)=>new Date(Date.UTC(yr,mo,0,12)).toISOString().slice(0,10);
 if(type==='week')a=shiftDay(day,-6);
 if(type==='month'){a=day.slice(0,7)+'-01';b=monthEnd(y,m)}
 if(type==='quarter'){const q=Math.floor((m-1)/3)*3+1;a=`${y}-${String(q).padStart(2,'0')}-01`;b=monthEnd(y,q+2)}
 if(type==='half'){const h=m<=6?1:7;a=`${y}-${String(h).padStart(2,'0')}-01`;b=monthEnd(y,h+5)}
 if(type==='year'){a=`${y}-01-01`;b=`${y}-12-31`}return [a,b];
}
