import {dayAt,shiftDay,stampAt,validDay,validStamp} from './time.js';
export function naturalTime(text:string,now:number,zone:string){
 const today=dayAt(now,zone);let date=/后天/.test(text)?shiftDay(today,2):/明天|明早|明晚/.test(text)?shiftDay(today,1):today;
 const exact=text.match(/\d{4}-\d{2}-\d{2}/),month=text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/);
 if(exact)date=exact[0];else if(month)date=`${month[1]||today.slice(0,4)}-${month[2].padStart(2,'0')}-${month[3].padStart(2,'0')}`;
 const input=text.replace(/：/g,':');
 const m=input.match(/(?:(凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明晚|晚|早|am|pm)\s*)?([0-9]{1,2}|[零〇一二两三四五六七八九十]{1,3})\s*(?:点\s*(半|一刻|三刻|[0-9]{1,2}|[零〇一二两三四五六七八九十]{1,3})?\s*分?|:\s*([0-9]{2}))(?:\s*(am|pm))?/i);
 function num(s:string){if(/^\d+$/.test(s))return +s;const d:Record<string,number>={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(s.includes('十')){const [a,b]=s.split('十');return (a?d[a]:1)*10+(b?d[b]:0);}return d[s]??NaN;}
 let deadline='';if(m){let hour=num(m[2]);const minute=m[3]==='半'?30:m[3]==='一刻'?15:m[3]==='三刻'?45:m[3]?num(m[3]):+(m[4]||0);const period=(m[1]||m[5]||input.match(/凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|今晚|明晚/)?.[0]||'').toLowerCase();
 if(hour>23||minute>59||hour<0||minute<0)return {date,deadline:'',invalid:true};
 if(/am|凌晨/.test(period)&&hour===12)hour=0;
 else if(/pm|下午|傍晚|晚上|今晚|明晚|晚/.test(period)&&hour<12)hour+=12;
 else if(period==='中午'&&hour<11)hour+=12;
 deadline=`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 }
 return {date,deadline,timeText:m?.[0]||'',invalid:!validDay(date)||!!deadline&&(!validStamp(deadline)||deadline<=stampAt(now,zone))};
}
