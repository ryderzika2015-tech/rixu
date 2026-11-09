import {defineComponent,ref,computed,onMounted,onUnmounted} from 'vue';
import {data,today,saveReview,safe,notify,adjustFocus} from '../services/store.js';
import {alive} from '../domain/model.js';
import {rangeFor,minutesLabel,clock,shiftDay,dayDiff} from '../domain/time.js';
import {timeGroups,financeSummary,financeGroups} from '../domain/statistics.js';
import {taxonomyName} from '../domain/taxonomy.js';
import {money} from '../domain/money.js';import {t} from '../i18n.js';
import Ring from '../components/Ring.js';import RangeSelect from '../components/RangeSelect.js';
export default defineComponent({name:'ReviewPage',components:{Ring,RangeSelect},setup(){
 const mode=ref('time'),range=ref('month'),from=ref(today()),to=ref(today()),tab=ref('distribution');
 const now=ref(Date.now());let timer:ReturnType<typeof setInterval>;
 onMounted(()=>{timer=setInterval(()=>now.value=Date.now(),1000)});
 onUnmounted(()=>clearInterval(timer));
 const note=ref(data.value.reviews.find(x=>x.date===today())?.text||'');
 const dates=computed<[string,string]>(()=>range.value==='custom'?[from.value,to.value]:rangeFor(range.value,today()));
 const validRange=computed(()=>dates.value[0]<=dates.value[1]);
 const groups=computed(()=>validRange.value?timeGroups(data.value,dates.value[0],dates.value[1],now.value):[]);
 const displayDuration=(seconds:number)=>seconds>0&&seconds<60?`${Math.ceil(seconds)}s`:minutesLabel(seconds/60);
 const rows=computed(()=>groups.value.map(x=>({label:taxonomyName(data.value,x.id),value:x.seconds,formatted:displayDuration(x.seconds)})));
 const seconds=computed(()=>groups.value.reduce((n,x)=>n+x.seconds,0));
 const sessions=computed(()=>alive(data.value.sessions).filter(x=>x.segments.some(g=>g.date>=dates.value[0]&&g.date<=dates.value[1])).slice().reverse());
 const activeSession=computed(()=>{const f=data.value.settings[0]?.activeFocus;return f&&groups.value.some(x=>x.id===f.categoryId)?f:null});
 const comparisons=computed(()=>alive(data.value.taxa).filter(x=>x.scope==='task').map(x=>({name:x.name,
  estimate:alive(data.value.tasks).filter(y=>y.categoryId===x.id&&y.date>=dates.value[0]&&y.date<=dates.value[1]).reduce((n,y)=>n+y.estimate,0),
  actual:(groups.value.find(y=>y.id===x.id)?.seconds||0)/60})).filter(x=>x.estimate||x.actual));
 const finance=computed(()=>validRange.value?financeSummary(data.value,dates.value[0],dates.value[1]):{rows:[],income:0,expense:0,balance:0});
 const frows=computed(()=>validRange.value?financeGroups(data.value,dates.value[0],dates.value[1],'expense').map(x=>({label:taxonomyName(data.value,x.id),value:x.value,formatted:'¥'+money(x.value)})):[]);
 const periodName=computed(()=>({today:'今日',week:'近七天',month:'本月',quarter:'本季度',half:'本半年',year:'本年度',custom:'选定日期'} as Record<string,string>)[range.value]||'本期');
 const summary=computed(()=>{
  const ts=alive(data.value.tasks).filter(x=>x.date>=dates.value[0]&&x.date<=dates.value[1]&&x.status!=='cancelled');
  const done=ts.filter(x=>x.status==='done'||x.progress>=x.quantity).length;
  const completion=ts.length?Math.round(done/ts.length*100):null;
  const topTime=rows.value[0];const topExpense=frows.value[0];
  const lines=[`任务：${ts.length} 项计划，已完成 ${done} 项${completion===null?'':`（${completion}%）`}。`];
  lines.push(`时间：记录有效投入 ${displayDuration(seconds.value)}${topTime?`，其中「${topTime.label}」最多（${topTime.formatted}）`:''}。`);
  lines.push(`财务：收入 ¥${money(finance.value.income)}，支出 ¥${money(finance.value.expense)}，收支结余 ¥${money(finance.value.balance)}${topExpense?`；支出最多的类别是「${topExpense.label}」（${topExpense.formatted}）`:''}。`);
  if(comparisons.value.length){const largest=[...comparisons.value].sort((a,b)=>Math.abs(b.actual-b.estimate)-Math.abs(a.actual-a.estimate))[0];
   if(largest&&largest.actual>largest.estimate&&largest.estimate>0)lines.push(`建议：${largest.name} 的实际投入超过计划，下一轮可以适当提高该类任务的预计时长。`);
  }
  const length=dayDiff(dates.value[1],dates.value[0])+1;
  if(length>0&&length<400){const oldEnd=shiftDay(dates.value[0],-1),oldStart=shiftDay(oldEnd,-(length-1));
   const prev=financeSummary(data.value,oldStart,oldEnd);
   if(prev.rows.length&&finance.value.rows.length){const delta=finance.value.expense-prev.expense;
    lines.push(`与前一个等长周期相比，已记录支出${delta===0?'持平':delta>0?`增加 ¥${money(delta)}`:`减少 ¥${money(-delta)}`}。`);
   }
  }
  return lines;
 });
 const save=()=>safe(async()=>{await saveReview(today(),note.value);notify(t('saved'))});
 const adjust=(id:string,seconds:number)=>{const value=window.prompt(t('adjustTime'),String(Math.round(seconds/6)/10));if(value!==null)void safe(()=>adjustFocus(id,Number(value)*60))};
 return {t,mode,range,from,to,tab,now,rows,seconds,sessions,activeSession,comparisons,minutesLabel,displayDuration,clock,finance,frows,money,note,save,adjust,dates,validRange,summary,periodName};
 },template:`
 <div class="page-heading"><h1>复盘与分析</h1><RangeSelect v-model="range"/></div>
 <p class="period-hint">{{periodName}} · {{dates[0]}} 至 {{dates[1]}}</p>
 <p v-if="!validRange" class="amber">开始日期不能晚于结束日期</p>
 <div v-if="range==='custom'" class="form-grid range-inputs"><label>{{t('from')}}<input type="date" v-model="from"/></label><label>{{t('to')}}<input type="date" v-model="to"/></label></div>
 <div v-if="validRange" class="tabs"><button :class="{active:mode==='time'}" @click="mode='time'">时间与任务</button><button :class="{active:mode==='finance'}" @click="mode='finance'">收支分析</button></div>
 <template v-if="validRange&&mode==='time'">
  <div class="tabs text-tabs"><button v-for="key in ['distribution','compare','sessions']" :key="key" :class="{active:tab===key}" @click="tab=key">{{t(key)}}</button></div>
  <section class="panel" v-if="tab==='distribution'"><Ring :rows="rows" :center="displayDuration(seconds)" caption="已记录有效投入（含进行中的专注）"/><p v-if="!rows.length" class="empty">{{t('noData')}}</p></section>
  <section class="panel" v-if="tab==='compare'"><div v-for="c in comparisons" :key="c.name" class="compare-row"><div class="row between"><strong>{{c.name}}</strong><small>{{minutesLabel(c.estimate)}} / {{minutesLabel(c.actual)}}</small></div><div class="compare-bar"><i :style="{width:(c.estimate/Math.max(c.estimate,c.actual,1)*100)+'%'}"/></div><div class="compare-bar actual"><i :style="{width:(c.actual/Math.max(c.estimate,c.actual,1)*100)+'%'}"/></div></div><p class="muted small">计划预计 / 有效投入</p></section>
  <section class="panel" v-if="tab==='sessions'"><div v-if="activeSession" class="session-row"><div class="grow"><strong>{{activeSession.taskTitle}}</strong><small>正在专注 · {{t(activeSession.mode)}} · 实时计入分布</small></div><b>{{clock(activeSession.accumulated+(activeSession.tickAt===null?0:Math.max(0,now-activeSession.tickAt)/1000))}}</b></div>
   <div v-for="f in sessions" :key="f.id" class="session-row"><div class="grow"><strong>{{f.taskTitle}}</strong><small>{{f.segments[0]?.date}} · {{t(f.mode)}}</small></div><b>{{clock(f.seconds)}}</b><button class="link" @click="adjust(f.id,f.seconds)">{{t('edit')}}</button></div><div v-if="!sessions.length&&!activeSession" class="empty">{{t('noData')}}</div></section>
 </template>
 <template v-if="validRange&&mode==='finance'"><div class="summary"><div><span>{{t('income')}}</span><b>{{money(finance.income)}}</b></div><div><span>{{t('expense')}}</span><b>{{money(finance.expense)}}</b></div><div><span>{{t('balance')}}</span><b>{{money(finance.balance)}}</b></div></div>
 <section class="panel"><Ring :rows="frows" :center="'¥'+money(finance.expense)" :caption="t('expense')"/><p class="muted">{{t('reportCount')}} {{finance.rows.length}}</p></section></template>
 <section v-if="validRange" class="panel"><div class="row between"><h2>{{periodName}}统计分析</h2><span class="badge">本地数据分析</span></div>
  <div class="report-insights"><p v-for="(line,i) in summary" :key="i">{{line}}</p></div>
  <details style="margin-top:15px"><summary>AI 深度分析</summary><p class="small muted">云端模型尚未接入，当前仅提供基于本地记录的真实统计。接入后可在这里生成月度、季度及年度分析。</p></details></section>
 <section v-if="range==='today'" class="panel reflection"><h2>{{t('reflection')}}</h2><textarea v-model="note" :aria-label="t('reflection')"/><button class="link" @click="save">{{t('save')}}</button></section>`});
