import {defineComponent,ref,computed,onUnmounted} from 'vue';
import {data,today,saveCapture,saveRawDraft,execute,remove,safe,notify} from '../services/store.js';
import {parseCapture,classifyCapture,type Candidate,type CaptureMode} from '../domain/capture.js';
import {toCents,money} from '../domain/money.js';
import {alive,uid} from '../domain/model.js';
import {current,close,open} from '../ui.js';import {t} from '../i18n.js';import Icon from './Icon.js';
export default defineComponent({name:'CaptureDialog',components:{Icon},setup(){
 const payload=current().payload;const stored=data.value.settings[0].extra?.capture as any;
 const text=ref(payload.raw||stored?.text||'');const mode=ref<CaptureMode>(payload.mode||stored?.mode||'auto');
 const candidates=ref<Candidate[]>([]);const amountStrings=ref<Record<number,string>>({});
 const saved=ref(false);let batchId=uid();let recognition:any;
 const parse=()=>{try{batchId=uid();candidates.value=parseCapture(text.value,mode.value,Date.now(),data.value.settings[0].timezone);
  amountStrings.value={};candidates.value.forEach((c,i)=>{if(c.amount)amountStrings.value[i]=(c.amount/100).toFixed(2);});
 }catch(e){notify(e instanceof Error?e.message:'INVALID_PLAN')}};
 const totals=computed(()=>candidates.value.filter(x=>x.selected&&x.kind==='transaction').reduce((a,x)=>({...a,[x.type||'expense']:a[x.type||'expense']+(x.amount||0)}),{income:0,expense:0}));
 const validCount=computed(()=>candidates.value.filter(x=>x.selected&&x.kind!=='pending').length);
 const pendingCount=computed(()=>candidates.value.filter(x=>x.kind==='pending'||x.kind==='transaction'&&!x.amount).length);
 const updateAmount=(i:number)=>{const c=candidates.value[i];try{c.amount=toCents(amountStrings.value[i]);c.selected=true;}catch(_){c.amount=undefined;c.selected=false;}};
 const resolve=(i:number,type:'income'|'expense')=>{const c=candidates.value[i];c.kind='transaction';c.type=type;c.category=classifyCapture(c.raw,type);c.tags='';c.amount=undefined;c.selected=false;c.reason='AMOUNT_REQUIRED';amountStrings.value[i]='';};
 const persist=async()=>{await execute(s=>{s.settings[0].extra={...s.settings[0].extra,capture:{text:text.value,mode:mode.value}}})};
 const save=()=>safe(async()=>{
  const ready=candidates.value.filter(c=>c.selected&&c.kind!=='pending');
  if(!ready.length){notify('请先勾选有效记录；金额不明确可暂存草稿');return;}
  for(const c of ready)if(c.kind==='transaction'&&(!c.amount||!Number.isSafeInteger(c.amount)))throw Error('INVALID_MONEY');
  await saveCapture(ready,mode.value,batchId);
  if(payload.inboxId)await remove('drafts',payload.inboxId);
  const unresolved=candidates.value.filter(c=>c.kind==='pending'||(c.kind==='transaction'&&!c.amount));
  if(unresolved.length){batchId=uid();text.value=unresolved.map(c=>c.raw).join('，');candidates.value=unresolved;amountStrings.value={};await persist();
   notify(`已正式保存 ${ready.length} 条；剩余 ${unresolved.length} 条尚未入账，可修改或暂存草稿`);}
  else{text.value='';saved.value=true;await persist();close();notify(`已正式保存 ${ready.length} 条记录`);}
 });
 const draft=()=>safe(async()=>{if(!text.value.trim())return;await saveRawDraft(text.value,mode.value);if(payload.inboxId)await remove('drafts',payload.inboxId);
  text.value='';candidates.value=[];saved.value=true;await persist();close();notify('已存入待确认收件箱，未写入正式账本或计划');});
 const speechAvailable=!!((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition);
 const voice=()=>{if(!window.confirm('语音可能通过浏览器语音服务处理，是否继续？'))return;
  const Constructor=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
  recognition=new Constructor();recognition.lang='zh-CN';recognition.interimResults=false;
  recognition.onresult=(e:any)=>text.value+=(text.value?'，':'')+e.results[0][0].transcript;
  recognition.onerror=()=>notify('语音未成功，可继续键入文字');recognition.start();};
 onUnmounted(()=>{recognition?.abort();if(!saved.value)void safe(persist)});
 const cats=(type:string)=>alive(data.value.taxa).filter(x=>x.scope===type);
 return {t,text,mode,candidates,parse,totals,money,save,draft,open,amountStrings,updateAmount,resolve,cats,speechAvailable,voice,validCount,pendingCount};
 },template:`
 <div class="tabs"><button v-for="key in ['auto','ledger','task','memo']" :key="key" :class="{active:mode===key}" @click="mode=key;candidates=[]">{{t(key)}}</button></div>
 <div class="quick-area"><textarea data-testid="capture-text" v-model="text" :placeholder="t('capturePlaceholder')" maxlength="6000"/>
 <div class="row between"><button v-if="speechAvailable" class="icon-button" @click="voice" :aria-label="t('voice')"><Icon name="mic"/></button><button v-else class="link" @click="open(mode==='ledger'?'transaction':'task')">{{t('manual')}}</button>
 <button class="primary" @click="parse" :disabled="!text.trim()" data-testid="capture-parse">{{t('organize')}}<Icon name="arrow"/></button></div></div>
 <div v-if="candidates.length" class="capture-summary"><span>识别 {{candidates.length}} 条 · 可保存 {{validCount}} 条</span><b v-if="totals.expense">−¥{{money(totals.expense)}}</b><b v-if="totals.income" class="green">+¥{{money(totals.income)}}</b></div>
 <article v-for="(c,i) in candidates" :key="i" class="candidate" :class="{pending:c.kind==='pending'}">
  <div class="row"><input v-if="c.kind!=='pending'" type="checkbox" v-model="c.selected" :disabled="c.kind==='transaction'&&!c.amount" :aria-label="'保存 '+c.title"/>
   <input v-model="c.title" class="candidate-title" :aria-label="t('taskTitle')"/>
   <span v-if="c.kind==='pending'" class="badge">信息待补充</span><span v-else class="badge">{{c.kind==='transaction'?'将存入账本':'将存入计划'}}</span></div>
  <template v-if="c.kind==='pending'"><p class="amber small">{{t(c.reason||'NEEDS_CONFIRMATION')}}。不会自动入账。</p>
   <div class="row" style="margin-top:8px" v-if="mode==='ledger'||mode==='auto'"><button class="secondary" @click="resolve(i,'expense')">补成支出</button><button class="secondary" @click="resolve(i,'income')">补成收入</button></div></template>
  <div v-else-if="c.kind==='transaction'" class="form-grid">
   <label>收支类型<select v-model="c.type" @change="c.category=classifyCapture(c.raw,c.type||'expense')"><option value="expense">支出</option><option value="income">收入</option></select></label>
   <label>金额（元）<input inputmode="decimal" v-model="amountStrings[i]" @input="updateAmount(i)" placeholder="例如 7.83"/></label>
   <label>分类<select v-model="c.category"><option v-for="cat in cats(c.type||'expense')" :key="cat.id">{{cat.name}}</option></select></label>
   <label>日期<input type="date" v-model="c.date"/></label>
   <label class="span-full">标签（逗号分隔）<input v-model="c.tags" placeholder="例如 早餐, 食堂"/></label>
   <small v-if="!c.amount" class="amber">填写有效金额后才能勾选保存</small></div>
  <div v-else class="form-grid"><label>日期<input type="date" v-model="c.date"/></label><label v-if="c.deadline">截止时间<input type="datetime-local" v-model="c.deadline"/></label></div>
 </article>
 <p class="muted small" v-if="pendingCount">{{pendingCount}} 条未补齐的内容不会入账；“暂存草稿”可将原文放到“待确认收件箱”。</p>
 <footer class="form-footer"><button class="secondary" @click="draft" :disabled="!text.trim()">暂存草稿</button><button class="primary grow" @click="save" :disabled="!validCount" data-testid="capture-save">正式保存 {{validCount}} 条</button></footer>`});
