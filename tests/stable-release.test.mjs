import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
import {reminderSound} from '../tools/make-reminder-sound.mjs';
import {newTask} from '../.offline/domain/tasks.js';import {initialSettings} from '../.offline/domain/model.js';import {reminderNodes} from '../.offline/domain/reminders.js';
test('advance reminders start thirty minutes early, repeat fifteen minutes, finish at event',()=>{
 const task=newTask('2026-11-25','test');task.title='出门';task.reminders={mode:'default',custom:[],at:'2026-11-25T17:00',advanceMinutes:30,repeatCount:3,repeatMinutes:15};
 const nodes=reminderNodes([task],initialSettings(),Date.parse('2026-11-25T07:00:00Z'));assert.equal(nodes.length,3);
 assert.equal(new Date(nodes[0].at).toISOString(),'2026-11-25T08:30:00.000Z');assert.equal(nodes[2].at-nodes[0].at,1800000);
 delete task.reminders.advanceMinutes;assert.equal(reminderNodes([task],initialSettings(),Date.parse('2026-11-25T07:00:00Z'))[0].at,nodes[2].at);
});
test('bundled reminder is nonempty 16-bit PCM wav',()=>{const wav=reminderSound();assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.equal(wav.readUInt16LE(34),16);assert(wav.subarray(44).some(n=>n!==0));});
test('update accepts only newer stable signed-asset URLs from this repository',async()=>{
 const source=readFileSync(new URL('../src/services/app-updates.ts',import.meta.url),'utf8').replace("import {ref} from 'vue';",'const ref=value=>({value});');const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
 const {releaseUpdate}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const release={tag_name:'android-v0.3.7',draft:false,prerelease:false,assets:[{name:'rixu-0.3.7.apk',browser_download_url:'https://github.com/ryderzika2015-tech/rixu/releases/download/android-v0.3.7/rixu-0.3.7.apk'}]};
 assert.equal(releaseUpdate(release,3006).version,'0.3.7');assert.equal(releaseUpdate(release,3007),null);
 for(const r of [{...release,draft:true},{...release,prerelease:true},{...release,tag_name:'other-v9.0.0'},{...release,assets:[{...release.assets[0],browser_download_url:'https://evil.example/app.apk'}]}])assert.equal(releaseUpdate(r,3006),null);
 assert.equal(releaseUpdate(release,NaN),null);
});
