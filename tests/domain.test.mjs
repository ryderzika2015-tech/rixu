import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {baseSnapshot,fromBackup,validateSnapshot,backup,mergeBackup,mergeConflicts} from '../.offline/domain/migration.js';
import {meta,alive,clone} from '../.offline/domain/model.js';
import {parsePlan,applyPlan,exportPlan,shiftPlan,readCSV} from '../.offline/domain/plans.js';
import {validDay,validStamp,shiftDay,dayAt,stampAt,instant,splitInterval,rangeFor} from '../.offline/domain/time.js';
import {newTask,validateTask,tasksOn,futureMemos,continueTask,calendarStatus} from '../.offline/domain/tasks.js';
import {ensureTaxon,renameTaxon,removeTaxon,taxonomyName,tagsFromNames} from '../.offline/domain/taxonomy.js';
import {parseCapture,chineseMoney} from '../.offline/domain/capture.js';import {toCents} from '../.offline/domain/money.js';
import {startFocus,elapsed,pause,resume,recover,finish,checkpoint,adjustSession} from '../.offline/domain/focus.js';
import {timeGroups,financeSummary} from '../.offline/domain/statistics.js';import {reminderNodes} from '../.offline/domain/reminders.js';
const NOW=Date.parse('2026-11-09T08:00:00Z'),D='2026-11-09',ZONE='Asia/Shanghai';
const plan=JSON.parse(fs.readFileSync('public/cet33.json'));
const task=(s=baseSnapshot(),date=D,title='Test')=>{let t=newTask(date,s.taxa.find(x=>x.scope==='task').id);t.title=title;s.tasks.push(t);return t};
const preview=(tasks,s=baseSnapshot())=>parsePlan(JSON.stringify({format:'rixu.plan.v1',id:'unit',name:'Unit plan',tasks,goals:[]}), 'unit.json',s);
function tx(s,amount,id='tx'){return {...meta(id),title:'Lunch',date:D,type:'expense',currency:'CNY',amount,categoryId:ensureTaxon(s,'expense','Food'),tagIds:[],note:''}}

test('CET plan has 171 independent unfinished unscheduled tasks and 2150 first-pass words',()=>{const s=baseSnapshot();applyPlan(s,parsePlan(JSON.stringify(plan),'cet33.json',s));assert.equal(s.tasks.length,171);assert(s.tasks.every(x=>x.progress===0&&!x.start&&!x.end));assert.equal(s.tasks.filter(x=>x.date<='2026-12-03'&&x.knowledge==='vocab').reduce((n,x)=>n+x.quantity,0),2150);assert.equal(s.transactions.length,0);assert.equal(s.tasks.at(-1).date,'2026-12-11');validateSnapshot(s)});
test('CET reimport is idempotent including its goal',()=>{const s=baseSnapshot();applyPlan(s,parsePlan(JSON.stringify(plan),'cet33.json',s));applyPlan(s,parsePlan(JSON.stringify(plan),'cet33.json',s));assert.equal(s.tasks.length,171);assert.equal(s.goals.length,1)});
test('plan preview never mutates data',()=>{const s=baseSnapshot(),before=JSON.stringify(s);preview([{title:'x',date:D,category:'New'}],s);assert.equal(JSON.stringify(s),before)});
test('plan import strips progress and actual time claims',()=>{const s=baseSnapshot();applyPlan(s,preview([{title:'x',date:D,progress:999,actual:999}],s));assert.equal(s.tasks[0].progress,0);assert.equal(s.tasks[0].actualLegacySeconds,0)});
test('invalid date is a row error and prevents entire apply',()=>{const s=baseSnapshot(),p=preview([{title:'ok',date:D},{title:'bad',date:'2026-02-30'}],s);assert.equal(p.rows.filter(x=>x.error).length,1);assert.throws(()=>applyPlan(s,p));assert.equal(s.tasks.length,0)});
test('invalid quantity and negative estimate are rejected',()=>{const p=preview([{title:'a',date:D,quantity:0},{title:'b',date:D,estimate:-2}]);assert(p.rows.every(x=>x.error))});
test('oversized title flagged instead of crashing error handling',()=>assert(preview([{title:'a'.repeat(501),date:D}]).rows[0].error));
test('memo requires deadline',()=>assert(preview([{title:'a',date:D,type:'memo'}]).rows[0].error));
test('schedule end before start flagged',()=>assert(preview([{title:'a',date:D,start:'16:00',end:'15:00'}]).rows[0].error));
test('CSV handles quotes, comma, multiline and escaped quotes',()=>{const r=readCSV('title,date,note\r\n"a,b",2026-11-09,"first\nsecond ""quote"""');assert.equal(r[0].title,'a,b');assert.equal(r[0].note,'first\nsecond "quote"')});
test('CSV unclosed quotes and duplicate columns rejected',()=>{assert.throws(()=>readCSV('title,date\n"a,2026'));assert.throws(()=>readCSV('title,title\na,b'))});
test('Chinese CSV headers and hours supported',()=>{const p=parsePlan('\u65e5\u671f,\u4efb\u52a1\u540d\u79f0,\u9884\u8ba1\u65f6\u957f,\u5fc5\u505a\n2026-11-10,Study,1\u5c0f\u65f6,\u5426','x.csv',baseSnapshot());assert.equal(p.rows[0].data.estimate,60);assert.equal(p.rows[0].data.required,false)});
test('TSV is supported',()=>assert.equal(parsePlan('date\ttitle\testimate\n2026-11-10\tStudy\t20','x.tsv',baseSnapshot()).rows[0].data.estimate,20));
test('nested days inherit date and stage',()=>{const p=parsePlan(JSON.stringify({days:[{date:D,stage:'Stage A',tasks:[{title:'x'}]}]}),'x.json',baseSnapshot());assert.equal(p.rows[0].date,D);assert(p.rows[0].data.tags.includes('Stage A'))});
test('duplicate entries inside one import detected',()=>assert.equal(preview([{date:D,title:'x'},{date:D,title:'x'}]).rows[1].status,'duplicate'));
test('backup cannot enter plan importer',()=>assert.throws(()=>parsePlan(JSON.stringify({tasks:[],transactions:[],goals:[]}),'x.json',baseSnapshot())));
test('file size limit enforced by UTF-8 bytes',()=>assert.throws(()=>parsePlan('x'.repeat(5000001),'x.json',baseSnapshot())));
test('date shifting moves deadline and goal together',()=>{const s=baseSnapshot(),p=parsePlan(JSON.stringify({tasks:[{date:D,title:'x',type:'memo',deadline:D+'T20:00'}],goals:[{title:'g',date:'2026-11-12'}]}),'x.json',s);const q=shiftPlan(p,'2026-12-01',s);assert.equal(q.rows[0].data.deadline,'2026-12-01T20:00');assert.equal(q.rows[1].date,'2026-12-04')});
test('exported plan can be imported without identity or progress leakage',()=>{const s=baseSnapshot();applyPlan(s,preview([{date:D,title:'x',quantity:3}],s));s.tasks[0].progress=2;const raw=exportPlan(s,s.plans[0].id);assert(!('progress' in raw.tasks[0]));const s2=baseSnapshot();applyPlan(s2,parsePlan(JSON.stringify(raw),'x.json',s2));assert.equal(s2.tasks[0].quantity,3);assert.equal(s2.tasks[0].progress,0)});

test('valid leap date and invalid non-leap date distinguished',()=>{assert(validDay('2028-02-29'));assert(!validDay('2026-02-29'));assert(!validDay('2026-02-30'))});
test('invalid clock times rejected',()=>{assert(validStamp(D+'T23:59'));assert(!validStamp(D+'T24:00'));assert(!validStamp(D+'T20:60'))});
test('timezone conversion round trip',()=>{const at=instant(D+'T20:00',ZONE);assert.equal(stampAt(at,ZONE),D+'T20:00');assert.equal(stampAt(at,'Asia/Tokyo'),D+'T21:00')});
test('cross-midnight focus segments preserve both dates',()=>{const from=instant(D+'T23:59',ZONE);const parts=splitInterval(from,from+120000,ZONE);assert.deepEqual(parts.map(x=>[x.date,x.seconds]),[[D,60],['2026-11-10',60]])});
test('calendar range uses natural quarter half year and leap month',()=>{assert.deepEqual(rangeFor('quarter','2026-11-09'),['2026-10-01','2026-12-31']);assert.deepEqual(rangeFor('half','2026-11-09'),['2026-07-01','2026-12-31']);assert.equal(rangeFor('month','2028-02-01')[1],'2028-02-29')});
test('future memo becomes same due-day task without duplicating',()=>{const s=baseSnapshot(),t=task(s,'2026-11-10');t.type='memo';t.deadline='2026-11-10T20:00';validateTask(t);assert.equal(futureMemos(s,D).length,1);assert.equal(tasksOn(s,'2026-11-10')[0].id,t.id);assert.equal(futureMemos(s,'2026-11-10').length,0);assert.equal(s.tasks.length,1)});
test('seven-day memo range excludes distant and completed items',()=>{const s=baseSnapshot(),t=task(s,'2026-11-20');t.type='memo';t.deadline=t.date+'T20:00';assert.equal(futureMemos(s,D).length,0);assert.equal(futureMemos(s,D,0).length,1);t.progress=1;assert.equal(futureMemos(s,D,0).length,0)});
test('continuation preserves historical date and quantities',()=>{const s=baseSnapshot(),t=task(s);t.quantity=100;t.progress=40;t.actualLegacySeconds=1200;const next=continueTask(s,t.id,'2026-11-10');assert.equal(next.quantity,60);assert.equal(next.progress,0);assert.equal(next.actualLegacySeconds,0);assert.equal(t.date,D);assert.equal(t.progress,40);assert.equal(continueTask(s,t.id,'2026-11-10').id,next.id)});
test('calendar green only after all required tasks completed',()=>{const s=baseSnapshot(),a=task(s),b=task(s);b.required=false;a.progress=1;assert.equal(calendarStatus(s,D,D),'green')});
test('calendar yellow partial red missed gray future',()=>{const s=baseSnapshot(),a=task(s);assert.equal(calendarStatus(s,D,'2026-11-10'),'red');a.progress=.5;assert.equal(calendarStatus(s,D,'2026-11-10'),'yellow');assert.equal(calendarStatus(s,D,'2026-11-08'),'gray')});

test('money avoids binary decimal accumulation',()=>assert.equal(toCents('19.2')+toCents('28.8'),4800));
for(const value of ['-1','0','1.001','NaN','Infinity','1e3','99999999999999'])test('reject invalid money '+value,()=>assert.throws(()=>toCents(value)));
test('reported lunch medicine sentence produces two entries',()=>{const r=parseCapture('\u4eca\u5929\u4e2d\u5348\u5403\u996d\u82b1\u4e8619.2\uff0c\u7136\u540e\u5462\uff0c\u4e2d\u5348\u4e70\u4e86\u836f\uff0c\u82b1\u4e8628.8','ledger',NOW);assert.equal(r.length,2);assert(r.every(x=>x.kind==='transaction'));assert.equal(r[0].amount,1920);assert.equal(r[1].amount,2880);assert.equal(r[1].category,'\u533b\u7597\u5065\u5eb7')});
test('expense and income stay separate',()=>{const r=parseCapture('\u65e9\u996d\u82b1\u4e867.83\u5143\uff0c\u517c\u804c\u8d5a\u4e86200\u5143','ledger',NOW);assert.equal(r[0].type,'expense');assert.equal(r[1].type,'income')});
for(const text of ['\u51c6\u5907\u4e70\u836f\u5927\u698230','\u660e\u5929\u5403\u996d\u9884\u7b9720','\u9000\u6b3e50','\u4e0d\u662f28.8\u662f18.8','\u82b1\u4e86-20','\u8f6c\u8d2650'])test('ambiguous money remains pending '+text,()=>assert(parseCapture(text,'ledger',NOW).every(x=>x.kind==='pending')));
test('ledger mode cannot emit task for a non-money phrase',()=>assert(parseCapture('\u5403\u996d','ledger',NOW).every(x=>x.kind==='pending')));
test('past-date expense recorded under yesterday',()=>assert.equal(parseCapture('\u6628\u5929\u5403\u996d\u82b1\u4e8620','ledger',NOW)[0].date,'2026-11-08'));
test('tonight deadline parsed without fake estimate',()=>{const r=parseCapture('\u4eca\u665a8\u70b9\u524d\u63d0\u4ea4\u751f\u547d\u65b9\u6848\u4f5c\u4e1a','auto',NOW)[0];assert.equal(r.kind,'task');assert.equal(r.deadline,D+'T20:00');assert.equal(r.title,'\u63d0\u4ea4\u751f\u547d\u65b9\u6848\u4f5c\u4e1a')});
test('past tonight deadline does not become tomorrow silently',()=>assert.equal(parseCapture('\u4eca\u665a8\u70b9\u524d\u4ea4\u4f5c\u4e1a','auto',instant(D+'T21:00',ZONE))[0].kind,'pending'));

test('empty tags do not create an unclassified label',()=>{const s=baseSnapshot();assert.deepEqual(tagsFromNames(s,''),[])});
test('rename category preserves references and alias',()=>{const s=baseSnapshot(),t=task(s),id=t.categoryId;renameTaxon(s,id,'Study');assert.equal(t.categoryId,id);assert.equal(taxonomyName(s,id),'Study');assert.equal(ensureTaxon(s,'task','\u82f1\u8bed\u5b66\u4e60'),id)});
test('category deletion migrates records but never deletes money',()=>{const s=baseSnapshot(),a=tx(s,783);s.transactions.push(a);const target=ensureTaxon(s,'expense','Other');removeTaxon(s,a.categoryId,target);assert.equal(a.categoryId,target);assert.equal(financeSummary(s,D,D).expense,783);assert.equal(ensureTaxon(s,'expense','Food'),target)});
test('tag deletion removes linkage only',()=>{const s=baseSnapshot(),t=task(s);t.tagIds=tagsFromNames(s,['A','B']);removeTaxon(s,t.tagIds[0]);assert.equal(t.tagIds.length,1);assert.equal(s.tasks.length,1)});
test('category move cannot cross income expense scope',()=>{const s=baseSnapshot(),a=tx(s,1);assert.throws(()=>removeTaxon(s,a.categoryId,ensureTaxon(s,'income','Job')))});
test('duplicate rename rejected',()=>{const s=baseSnapshot(),a=ensureTaxon(s,'expense','A'),b=ensureTaxon(s,'expense','B');assert.throws(()=>renameTaxon(s,a,'B'));assert.equal(taxonomyName(s,b),'B')});

test('pause retains elapsed seconds without pause duration',()=>{const f=startFocus(task(),25,'learning',NOW),paused=pause(f,ZONE,NOW+720000);assert.equal(paused.accumulated,720);assert.equal(elapsed(paused,NOW+1500000),720);const resumed=resume(paused,NOW+1500000);assert.equal(elapsed(resumed,NOW+1560000),780)});
test('focus is capped at target even after prolonged hidden time',()=>{const f=startFocus(task(),25,'learning',NOW);assert.equal(elapsed(f,NOW+9e6),1500);assert.equal(finish(f,ZONE,NOW+9e6).seconds,1500)});
test('checkpoints do not double count elapsed time',()=>{let f=startFocus(task(),25,'learning',NOW);f=checkpoint(f,ZONE,NOW+15000);f=checkpoint(f,ZONE,NOW+30000);assert.equal(finish(f,ZONE,NOW+60000).seconds,60)});
test('early finish preserves task progress independently',()=>{const t=task(),f=startFocus(t,25,'learning',NOW);assert.equal(finish(f,ZONE,NOW+5000).seconds,5);assert.equal(t.progress,0)});
test('recovery pauses at last durable checkpoint',()=>{const f=checkpoint(startFocus(task(),25,'learning',NOW),ZONE,NOW+15000),r=recover(f);assert(r.paused);assert.equal(elapsed(r,NOW+10000000),15)});
test('session adjustment records audit and preserves total across days',()=>{const f=finish(startFocus(task(),25,'learning',NOW),ZONE,NOW+60000),r=adjustSession(f,30);assert.equal(r.seconds,30);assert.equal(r.segments.reduce((n,x)=>n+x.seconds,0),30);assert.equal(r.audit[0].before,60);assert.throws(()=>adjustSession(f,1600))});
test('zero duration session cannot fabricate extra focus',()=>{const f=finish(startFocus(task(),25,'learning',NOW),ZONE,NOW);assert.throws(()=>adjustSession(f,30))});

test('legacy conversion subtracts already included focus time',()=>{const raw={tasks:[{id:'t',title:'Legacy',date:D,quantity:1,progress:0,estimate:25,actual:20,category:'Study'}],transactions:[],goals:[],focusSessions:[{id:'f',taskId:'t',elapsedMs:600000,targetMs:1500000,segments:[{date:D,ms:600000}]}]};const s=fromBackup(raw);assert.equal(s.tasks[0].actualLegacySeconds,600);assert.equal(timeGroups(s,D,D).reduce((n,x)=>n+x.seconds,0),1200)});
test('legacy ledger amount remains cents and unknown original kept',()=>{const raw={tasks:[],transactions:[{id:'x',date:D,title:'x',type:'expense',amount:783,category:'Food'}],goals:[],unknownRoot:'keep'};const s=fromBackup(raw);assert.equal(s.transactions[0].amount,783);assert.equal(s.recovery[0].raw.unknownRoot,'keep')});
test('invalid backup rejected, not partially imported',()=>assert.throws(()=>fromBackup({tasks:[],goals:[],transactions:[{id:'x',date:D,title:'x',type:'expense',amount:1.2}]})));
test('native backup round trip preserves identifiers',()=>{const s=baseSnapshot();task(s);s.transactions.push(tx(s,783));assert.deepEqual(fromBackup(backup(s)),s)});
test('merging same backup twice is idempotent',()=>{const s=baseSnapshot();task(s);s.transactions.push(tx(s,783));const first=mergeBackup(baseSnapshot(),s),second=mergeBackup(first,s);assert.equal(second.tasks.length,1);assert.equal(second.transactions.length,1)});
test('same-looking distinct transactions are both retained',()=>{const a=baseSnapshot(),b=baseSnapshot();a.transactions.push(tx(a,783,'a'));b.transactions.push(tx(b,783,'b'));assert.equal(mergeBackup(a,b).transactions.length,2)});
test('same id differences reported and current record retained',()=>{const a=baseSnapshot();task(a);const b=clone(a);b.tasks[0].title='Changed';assert.equal(mergeConflicts(a,b),1);assert.equal(mergeBackup(a,b).tasks[0].title,'Test')});
test('merge old CET avoids duplicates of untouched preload',()=>{const a=baseSnapshot();applyPlan(a,parsePlan(JSON.stringify(plan),'cet33.json',a));const b=clone(a);b.tasks=b.tasks.map((x,i)=>({...x,id:'old'+i,progress:i===0?x.quantity:0}));const merged=mergeBackup(a,b);assert.equal(alive(merged.tasks).length,171);assert.equal(alive(merged.tasks).find(x=>x.id==='old0').progress,50)});
test('merge fills missing monthly budget but keeps present budget',()=>{const a=baseSnapshot(),b=baseSnapshot();a.settings[0].budgets['2026-11']=10000;b.settings[0].budgets={'2026-11':20000,'2026-12':30000};const c=mergeBackup(a,b);assert.deepEqual(c.settings[0].budgets,{'2026-11':10000,'2026-12':30000})});

test('default reminder uses three days and four hours',()=>{const s=baseSnapshot(),t=task(s,'2026-11-14');t.deadline='2026-11-14T20:00';const r=reminderNodes(s.tasks,s.settings[0],NOW);assert.deepEqual(r.map(x=>stampAt(x.at,ZONE)),['2026-11-11T20:00','2026-11-14T16:00'])});
test('completed task has no future reminder',()=>{const s=baseSnapshot(),t=task(s);t.deadline='2026-11-14T20:00';t.progress=1;assert.equal(reminderNodes(s.tasks,s.settings[0],NOW).length,0)});
test('custom reminder replaces default deadline nodes',()=>{const s=baseSnapshot(),t=task(s);t.deadline='2026-11-14T20:00';t.reminders={mode:'custom',custom:['2026-11-13T12:00']};assert.equal(reminderNodes(s.tasks,s.settings[0],NOW).length,1)});
test('quiet-hour near deadline moves before deadline not after',()=>{const s=baseSnapshot(),t=task(s);t.deadline='2026-11-11T08:00';const r=reminderNodes(s.tasks,s.settings[0],NOW);assert(r.some(x=>stampAt(x.at,ZONE)==='2026-11-10T21:50'));assert(r.every(x=>x.at<instant(t.deadline,ZONE)))});
test('past reminder nodes are never replayed',()=>{const s=baseSnapshot(),t=task(s);t.deadline=D+'T15:00';assert.equal(reminderNodes(s.tasks,s.settings[0],NOW).length,0)});

// 0.3.2 regressions: Chinese spoken money, live timing, reminder snooze/repeats.
test('spoken Chinese amount seven or eight yuan becomes an actual selectable expense',()=>{
 const r=parseCapture('我吃饭花了八元，刚才买药花了七元','ledger',NOW);
 assert.equal(r.length,2);assert(r.every(x=>x.kind==='transaction'&&x.selected));
 assert.deepEqual(r.map(x=>x.amount),[800,700]);assert.equal(r[0].category,'餐饮');
});
test('Chinese decimal words convert to exact integer cents',()=>{
 assert.equal(chineseMoney('七点八三'),'7.83');
 assert.equal(chineseMoney('二十八'),'28');
 assert.equal(chineseMoney('一百零三'),'103');
 assert.equal(parseCapture('今天吃饭花了七点八三元','ledger',NOW)[0].amount,783);
});
test('incomplete transaction remains pending and not selected',()=>{
 const r=parseCapture('今天吃饭花了','ledger',NOW);
 assert.equal(r.length,1);assert.equal(r[0].kind,'pending');assert.equal(r[0].selected,false);
});
test('live focus is counted in time distribution without task completion or settlement',()=>{
 const s=baseSnapshot(),x=task(s);
 const f=startFocus(x,30,'learning',NOW);s.settings[0].activeFocus=f;
 const g=timeGroups(s,D,D,NOW+25000);
 assert(Math.abs(g.reduce((n,a)=>n+a.seconds,0)-25)<.1);
 assert.equal(x.progress,0);assert.equal(s.sessions.length,0);
});
test('active focus time does not count beyond its target, paused time does not grow',()=>{
 const s=baseSnapshot(),x=task(s);let f=startFocus(x,1,'strict',NOW);
 s.settings[0].activeFocus=f;
 assert.equal(Math.round(timeGroups(s,D,D,NOW+120000)[0].seconds),60);
 s.settings[0].activeFocus=pause(f,ZONE,NOW+12000);
 assert.equal(Math.round(timeGroups(s,D,D,NOW+120000)[0].seconds),12);
});
test('reminder repeat count, snooze and stop rules are honored',()=>{
 const s=baseSnapshot(),x=task(s,'2026-11-10');x.deadline='2026-11-10T20:00';
 s.settings[0].repeatCount=3;s.settings[0].repeatMinutes=15;s.settings[0].quiet=false;
 const n=reminderNodes(s.tasks,s.settings[0],NOW);assert(n.some(x=>x.kind==='repeat'));
 x.reminders.snoozedUntil='2026-11-10T19:00';
 const later=reminderNodes(s.tasks,s.settings[0],NOW);
 assert(later.every(x=>x.at>=instant('2026-11-10T19:00',ZONE)));
 x.reminders.mode='off';assert.equal(reminderNodes(s.tasks,s.settings[0],NOW).length,0);
});
