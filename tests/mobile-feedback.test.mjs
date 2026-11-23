import test from 'node:test';import assert from 'node:assert/strict';
import {parseCapture} from '../.offline/domain/capture.js';
import {reminderNodes} from '../.offline/domain/reminders.js';
import {newTask} from '../.offline/domain/tasks.js';
import {initialSettings} from '../.offline/domain/model.js';
import {readFileSync} from 'node:fs';import {compile} from '@vue/compiler-dom';
const now=Date.parse('2026-11-23T08:00:00Z');
for(const [text,deadline] of [
 ['11月24日17:40到服务中心参加彩排','2026-11-24T17:40'],
 ['今天晚上 11 点前到寝室3407 拿聘书','2026-11-23T23:00'],
 ['明天上午十一点半交作业','2026-11-24T11:30'],
 ['明天 12:30 am 交作业','2026-11-24T00:30'],
 ['明天 12:30 pm 交作业','2026-11-24T12:30'],
 ['明天下午3：20交作业','2026-11-24T15:20']])test('memo time: '+text,()=>{
 const c=parseCapture(text,'memo',now)[0];assert.equal(c.kind,'task');assert.equal(c.taskType,'memo');assert.equal(c.deadline,deadline);
});
test('invalid dates, invalid clock and past times remain pending',()=>{
 for(const s of ['11月31日17:40开会','明天25:10开会','明天17:90开会','今天上午11点开会'])assert.equal(parseCapture(s,'memo',now)[0].kind,'pending');
});
test('explicit task stays task while memo stays memo even today',()=>{
 for(const mode of ['task','memo'])assert.equal(parseCapture('今天晚上11点前交作业',mode,now)[0].taskType,mode);
});
test('ledger time is not mistaken for a second amount',()=>{
 const c=parseCapture('今天晚上11点花了19.2元吃饭','ledger',now)[0];assert.equal(c.kind,'transaction');assert.equal(c.amount,1920);
 const dated=parseCapture('11月22日17:40吃饭花了八元','ledger',now)[0];assert.equal(dated.kind,'transaction');assert.equal(dated.date,'2026-11-22');assert.equal(dated.amount,800);
});
test('three reminders repeat after the chosen time and stop on completion or off',()=>{
 const task=newTask('2026-11-23','test');task.title='会议';task.reminders={mode:'default',custom:[],at:'2026-11-23T17:00',repeatCount:3,repeatMinutes:15};const prefs=initialSettings();
 const nodes=reminderNodes([task],prefs,now);assert.equal(nodes.length,3);assert.equal(nodes[1].at-nodes[0].at,900000);assert.equal(nodes[2].at-nodes[1].at,900000);
 assert.equal(reminderNodes([task],prefs,nodes[0].at+1).length,2);
 task.reminders.mode='off';assert.equal(reminderNodes([task],prefs,now).length,0);
 task.reminders.mode='default';task.progress=task.quantity;assert.equal(reminderNodes([task],prefs,now).length,0);
});
for(const file of ['TaskEditor','CaptureDialog','AgendaDialog'])test(file+' template compiles',()=>{
 const s=readFileSync(new URL('../src/components/'+file+'.ts',import.meta.url),'utf8');const template=s.match(/template:`([\s\S]*)`\s*\}\);/)[1];assert.doesNotThrow(()=>compile(template));
});
