import {defineComponent,ref,computed} from 'vue';
import {data,today,remove,restore,execute,safe,notify,changeTaskReminder} from '../services/store.js';
import {alive,clone,type StoreName} from '../domain/model.js';
import {taxonomyName,tagNames} from '../domain/taxonomy.js';
import {tasksOn} from '../domain/tasks.js';
import {reminderNodes} from '../domain/reminders.js';
import {stampAt} from '../domain/time.js';
import {open,current,close} from '../ui.js';
import {t} from '../i18n.js';import TaskRow from './TaskRow.js';
export default defineComponent({name:'UtilitiesDialog',components:{TaskRow},setup(){
 const kind=current().name;const query=ref(''),filter=ref('all');const prefs=ref(clone(data.value.settings[0]));
 const results=computed(()=>{const q=query.value.trim().toLowerCase();if(!q)return [];const rows:any[]=[];
  for(const name of ['tasks','goals','transactions','drafts'] as const)for(const item of alive(data.value[name] as any[]) as any[]){const text=[item.title,item.raw,item.date,item.amount?(item.amount/100).toFixed(2):'',taxonomyName(data.value,item.categoryId),...tagNames(data.value,item.tagIds||[])].join(' ').toLowerCase();
   if(text.includes(q))rows.push({store:name,id:item.id,title:item.title||item.raw,date:item.date,kind:name==='transactions'?'ledger':name==='goals'?'goals':name==='drafts'?'inbox':'task'});}
  return rows.slice(0,60);
 });
 const showResult=(r:any)=>r.store==='drafts'?open('capture',{raw:data.value.drafts.find(x=>x.id===r.id)?.raw,inboxId:r.id}):open(r.store==='transactions'?'transaction':r.store==='goals'?'goal':'task',{id:r.id});
 const trash=computed(()=>{const rows:any[]=[];for(const store of ['tasks','goals','transactions','sessions','drafts'] as const)for(const r of data.value[store])if(r.deletedAt)rows.push({store,id:r.id,title:(r as any).title||(r as any).taskTitle||(r as any).raw,date:r.deletedAt.slice(0,10)});return rows.sort((a,b)=>b.date.localeCompare(a.date));});
 const drafts=computed(()=>alive(data.value.drafts));
 const taskList=computed(()=>tasksOn(data.value,current().payload.date||today()).filter(x=>filter.value==='all'||(filter.value==='required'?x.required:x.status==='done')));
 const nodes=computed(()=>reminderNodes(data.value.tasks,prefs.value).slice(0,16));
 const muted=computed(()=>alive(data.value.tasks).filter(x=>x.reminders.mode==='off'||!!x.reminders.snoozedUntil&&x.reminders.snoozedUntil>stampAt(Date.now(),prefs.value.timezone)));
 const savePrefs=()=>safe(async()=>{
  if(!Number.isFinite(prefs.value.capacity)||prefs.value.capacity<0||prefs.value.capacity>1440)throw Error('INVALID_DURATION');
  if(!Number.isInteger(prefs.value.repeatCount)||prefs.value.repeatCount!<1||prefs.value.repeatCount!>5)throw Error('INVALID_DURATION');
  if(!Number.isInteger(prefs.value.repeatMinutes)||prefs.value.repeatMinutes!<5||prefs.value.repeatMinutes!>240)throw Error('INVALID_DURATION');
  await execute(s=>Object.assign(s.settings[0],{timezone:prefs.value.timezone,capacity:prefs.value.capacity,farDays:prefs.value.farDays,nearHours:prefs.value.nearHours,repeatCount:prefs.value.repeatCount,repeatMinutes:prefs.value.repeatMinutes,startAlerts:prefs.value.startAlerts,overdue:prefs.value.overdue,quiet:prefs.value.quiet}));
  close();notify('提醒规则已保存（系统通知需安装安卓版后接入）');
 });
 const rule=(id:string,action:'stop'|'snooze15'|'snooze60'|'resume')=>safe(async()=>{
  await changeTaskReminder(id,action);
  notify(action==='stop'?'已关闭该任务后续提醒':action==='resume'?'已恢复提醒':'已暂时延后提醒');
 });
 return {t,kind,query,filter,results,showResult,trash,drafts,taskList,open,close,prefs,nodes,muted,stampAt,savePrefs,rule,restore:(s:StoreName,id:string)=>safe(()=>restore(s,id)),remove:(s:StoreName,id:string)=>safe(()=>remove(s,id))};
 },template:`
 <template v-if="kind==='search'"><input v-model="query" autofocus :placeholder="t('searchPlaceholder')" :aria-label="t('search')"/><button v-for="r in results" :key="r.store+r.id" class="search-row" @click="showResult(r)"><strong>{{r.title}}</strong><small>{{t(r.kind)}} · {{r.date}}</small></button><p v-if="query&&!results.length" class="empty">{{t('noResults')}}</p></template>
 <template v-if="kind==='trash'"><div v-for="r in trash" :key="r.store+r.id" class="recovery-row"><span class="grow"><strong>{{r.title}}</strong><small>{{r.date}}</small></span><button class="link" @click="restore(r.store,r.id)">{{t('restore')}}</button></div><p v-if="!trash.length" class="empty">{{t('noTrash')}}</p></template>
 <template v-if="kind==='inbox'"><div v-for="d in drafts" :key="d.id" class="inbox-row"><p>{{d.raw}}</p><small class="amber">{{t(d.reason)}} · 尚未入账或创建任务</small><div class="row"><button class="link" @click="open('capture',{raw:d.raw,mode:d.mode,inboxId:d.id})">补充并正式保存</button><button class="text-button danger" @click="remove('drafts',d.id)">{{t('delete')}}</button></div></div><p v-if="!drafts.length" class="empty">{{t('noInbox')}}</p></template>
 <template v-if="kind==='allTasks'"><div class="tabs"><button v-for="key in ['all','required','done']" :key="key" :class="{active:filter===key}" @click="filter=key">{{t(key)}}</button></div><TaskRow v-for="task in taskList" :key="task.id" :task="task"/><p v-if="!taskList.length" class="empty">{{t('noTasks')}}</p></template>
 <template v-if="kind==='reminders'"><form @submit.prevent="savePrefs">
  <p class="small muted">截止提醒：例如截止时间为周五 20:00，提前 3 天即周二 20:00；提前 4 小时即周五 16:00。</p>
  <div class="form-grid"><label>远期提前多少天<select v-model.number="prefs.farDays"><option v-for="n in [3,4,5]" :key="n" :value="n">{{n}} 天</option></select></label><label>临近提前多少小时<select v-model.number="prefs.nearHours"><option v-for="n in [3,4,5]" :key="n" :value="n">{{n}} 小时</option></select></label>
  <label>每个节点最多提醒几次<select v-model.number="prefs.repeatCount"><option v-for="n in [1,2,3,4,5]" :key="n" :value="n">{{n}} 次（含首次）</option></select></label><label>再次提醒间隔<select v-model.number="prefs.repeatMinutes"><option v-for="n in [5,10,15,30,60,120]" :key="n" :value="n">{{n}} 分钟</option></select></label></div>
  <label v-for="key in ['startAlerts','overdue','quiet']" :key="key" class="checkbox"><input type="checkbox" v-model="prefs[key]"/>{{t(key)}}</label>
  <label>计划时区<select v-model="prefs.timezone"><option>Asia/Shanghai</option><option>Asia/Tokyo</option><option>UTC</option><option>America/Los_Angeles</option></select></label>
  <label>每日可用时间 · 分钟<input type="number" min="0" max="1440" v-model.number="prefs.capacity"/></label>
  <details open><summary>接下来将提醒的任务</summary><p class="small muted">目前为提醒预览，非后台系统通知。每个任务都可单独暂停、恢复或永久关闭提醒。</p>
   <div class="reminder-row" v-for="n in nodes" :key="n.key"><div class="grow"><strong>{{n.title}}</strong><small>{{stampAt(n.at,prefs.timezone).replace('T',' ')}}</small></div><div class="row wrap"><button type="button" class="small-link" @click="rule(n.taskId,'snooze15')">稍后 15 分</button><button type="button" class="small-link" @click="rule(n.taskId,'snooze60')">稍后 1 小时</button><button type="button" class="small-link" @click="rule(n.taskId,'stop')">本任务不再提醒</button></div></div>
   <p v-if="!nodes.length" class="empty">没有即将到来的提醒</p></details>
  <details><summary>已暂停或关闭的任务 · {{muted.length}}</summary><div class="reminder-row" v-for="task in muted" :key="task.id"><div class="grow"><strong>{{task.title}}</strong><small>{{task.reminders.mode==='off'?'已关闭':'暂停至 '+task.reminders.snoozedUntil}}</small></div><button type="button" class="small-link" @click="rule(task.id,'resume')">恢复提醒</button></div></details>
  <footer class="form-footer"><button class="primary grow">保存提醒规则</button></footer>
 </form></template>
 <template v-if="kind==='about'"><h3>{{t('app')}} · 0.3.2</h3><p class="muted about-line">Vue 3 · TypeScript · IndexedDB</p><p class="about-line">云端 AI 与手机系统级后台提醒待接入</p><button class="link" @click="open('backup')">{{t('backup')}}</button></template>`});
