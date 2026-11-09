import {toCents} from './money.js';
import {dayAt,shiftDay,stampAt,validStamp} from './time.js';
export type CaptureMode='auto'|'ledger'|'task'|'memo';
export interface Candidate {
 kind:'transaction'|'task'|'pending';title:string;date:string;amount?:number;
 type?:'income'|'expense';category?:string;deadline?:string;reason?:string;
 tags?:string;raw:string;selected:boolean;
}
const incoming=/赚|收入|收到|到账|工资|奖学金|红包|入账/;
const spending=/花|付|消费|支出|元|块|买了|用了/;
const ambiguous=/预算|准备|打算|大概|退款|退了|转账|还款|代付|垫付|AA|不是|改成|应该是|明天|后天/i;
const digits:Record<string,number>={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
const units:Record<string,number>={'十':10,'百':100,'千':1000,'万':10000};
function chineseInteger(text:string):number|null{
 if(!text||!/[零〇一二两三四五六七八九]/.test(text))return null;
 let result=0,section=0,current=0;
 for(const ch of text){if(ch in digits){current=digits[ch];continue}const unit=units[ch];if(!unit)return null;
  if(unit===10000){section=(section+current)*unit;result+=section;section=0;current=0;continue}
  section+=(current||1)*unit;current=0;
 }
 return result+section+current;
}
export function chineseMoney(text:string):string|null{
 const [whole,decimal]=text.split('点');const n=chineseInteger(whole);if(n===null)return null;
 if(decimal!==undefined){if(!decimal||decimal.length>2||![...decimal].every(x=>x in digits))return null;return `${n}.${[...decimal].map(c=>digits[c]).join('')}`;}
 return String(n);
}
function normalizeMoney(text:string):string{
 // Only replace Chinese numerals in money expressions, never the numbers in a task title.
 return text.replace(/[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二两三四五六七八九]+)?(?=\s*(?:元|块钱?|人民币))/g,s=>chineseMoney(s)??s)
  .replace(/((?:花了?|付了?|支付|消费|收入|赚了?|收了?|用了?)\s*)([零〇一二两三四五六七八九十百千万]+(?:点[零〇一二两三四五六七八九]+)?)(?=\s*(?:[，,。；;\s]|$))/g,(_m,prefix,num)=>prefix+(chineseMoney(num)??num));
}
const pending=(raw:string,date:string,reason='NEEDS_CONFIRMATION'):Candidate=>({kind:'pending',title:raw,date,raw,reason,selected:false});
export function classifyCapture(s:string,type:'income'|'expense'){
 if(type==='income')return /兼职/.test(s)?'兼职':/生活费/.test(s)?'生活费':/奖学金/.test(s)?'奖学金':'其他收入';
 return /药|医院|看病/.test(s)?'医疗健康':/饭|餐|吃|茶|咖啡|水果/.test(s)?'餐饮':/地铁|打车|公交|出租/.test(s)?'交通':/买|购|淘宝|京东/.test(s)?'购物':'其他支出';
}
export function parseCapture(text:string,mode:CaptureMode,now=Date.now(),zone='Asia/Shanghai'):Candidate[]{
 text=text.trim();if(!text)return [];if(text.length>6000)throw Error('TEXT_TOO_LONG');const today=dayAt(now,zone);
 if(mode==='ledger'||mode==='auto'&&(incoming.test(text)||spending.test(text))){
  if(ambiguous.test(text)||/[-−]\s*\d/.test(text))return [pending(text,today)];
  const parts=normalizeMoney(text).split(/[，,。；;\n]/).map(x=>x.trim()).filter(x=>x&&!/^(然后呢?|另外呢?|呢)$/.test(x));
  const out:Candidate[]=[];let context='',date=today;
  for(const part of parts){if(/昨天|昨日/.test(part))date=shiftDay(today,-1);else if(/今天|今日/.test(part))date=today;
   const matches=[...part.matchAll(/\d+(?:\.\d+)?/g)];
   if(!matches.length){context+=(context?' ':'')+part;continue;}
   if(matches.length!==1){if(context)out.push(pending(context,date));context='';out.push(pending(part,date));continue;}
   const match=matches[0],before=part.slice(0,match.index);
   if(!spending.test(part)&&!incoming.test(part)&&!/饭|餐|药|购|地铁|咖啡/.test(before)){
    out.push(pending((context+' '+part).trim(),date));context='';continue;
   }
   const full=(context+' '+part).trim();context='';
   try{const amount=toCents(match[0]);const type=incoming.test(full)?'income':'expense';
    let title=full.replace(match[0],'').replace(/今天|昨天|刚刚|刚才|然后呢?|另外|花了?|用了?|赚了?|付了?|元|块钱?|收入/g,'').trim();
    title=title||classifyCapture(full,type);
    out.push({kind:'transaction',title,date,amount,type,category:classifyCapture(full,type),tags:'',raw:full,selected:true});
   }catch(_){out.push(pending(full,date,'INVALID_MONEY'));}
  }
  if(context)out.push(pending(context,date,'AMOUNT_REQUIRED'));
  return out.length?out:[pending(text,today,'AMOUNT_REQUIRED')];
 }
 let date=/后天/.test(text)?shiftDay(today,2):/明天|明晚/.test(text)?shiftDay(today,1):today;
 const exact=text.match(/\d{4}-\d{2}-\d{2}/);if(exact)date=exact[0];
 const m=text.match(/(\d{1,2})[点:](?:(\d{1,2})分?)?/);let deadline='';
 if(m){let hour=+m[1];if(/晚|下午/.test(text)&&hour<12)hour+=12;if(/中午/.test(text)&&hour<11)hour+=12;
  deadline=`${date}T${String(hour).padStart(2,'0')}:${String(m[2]||0).padStart(2,'0')}`;
  if(!validStamp(deadline)||deadline<=stampAt(now,zone))return [pending(text,date,'PAST_OR_INVALID_TIME')];}
 if(/下周|周末|未来|之后/.test(text)||mode==='memo'&&!deadline)return [pending(text,date,'TIME_REQUIRED')];
 const title=text.replace(/今晚|明晚|今天|明天|后天|下午|上午|晚上|中午/g,'').replace(/\d{4}-\d{2}-\d{2}/,'').replace(/\d{1,2}[点:](?:\d{1,2}分?)?(?:以?前)?/,'').trim();
 return [{kind:'task',title:title||text,date,deadline,category:/作业|报告|复习/.test(text)?'专业学习':'日常生活',raw:text,selected:true}];
}
