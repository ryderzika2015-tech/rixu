// Repository protocol tests against a deliberately small event-driven IDB double.
// This is not a browser IndexedDB conformance or durability test.
import test from 'node:test';import assert from 'node:assert/strict';
import {IndexedDbRepository,ConflictError} from '../.offline/storage/repository.js';
import {meta,STORES} from '../.offline/domain/model.js';
class EventDb {
 constructor(){this.stores=Object.fromEntries([...STORES,'outbox'].map(k=>[k,new Map()]));this.failWrites=false}
 transaction(names,mode){return new EventTx(this,names,mode)}close(){this.closed=true}
}
class EventTx {
 constructor(db,names,mode){this.db=db;this.names=names;this.mode=mode;this.pending=0;this.aborted=false;this.done=false;this.shadow=Object.fromEntries(names.map(k=>[k,new Map([...db.stores[k]].map(([id,v])=>[id,structuredClone(v)]))]));this.schedule()}
 schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>{if(this.pending||this.done)return;if(this.aborted){this.done=true;this.onabort?.();return}if(this.mode==='readwrite')for(const k of this.names)this.db.stores[k]=this.shadow[k];this.done=true;this.oncomplete?.()},0)}
 request(value){this.pending++;const r={};queueMicrotask(()=>{r.result=structuredClone(value);r.onsuccess?.();this.pending--;this.schedule()});return r}
 objectStore(name){if(!this.shadow[name])throw Error('Missing store');return {get:id=>this.request(this.shadow[name].get(id)),getAll:()=>this.request([...this.shadow[name].values()]),put:value=>{if(this.db.failWrites)throw new DOMException('Simulated quota','QuotaExceededError');this.shadow[name].set(value.id,structuredClone(value));this.schedule()}}}
 abort(){this.aborted=true;this.schedule()}
}
function setup(){const db=new EventDb();return {db,repo:new IndexedDbRepository(db)}}
test('repository saves entity and outbox in one transaction',async()=>{const {db,repo}=setup();await repo.commit([{store:'tasks',value:{...meta('a'),title:'A'},expected:null}]);assert.equal(db.stores.tasks.get('a').version,1);assert.equal(db.stores.outbox.size,1)});
test('repository loading returns independent cloned arrays',async()=>{const {repo}=setup();await repo.commit([{store:'tasks',value:{...meta('a'),title:'A'},expected:null}]);const s=await repo.load();s.tasks[0].title='Changed';assert.equal((await repo.load()).tasks[0].title,'A')});
test('stale version aborts complete multi-store write',async()=>{const {db,repo}=setup();await repo.commit([{store:'tasks',value:meta('a'),expected:null}]);await assert.rejects(repo.commit([{store:'transactions',value:meta('tx'),expected:null},{store:'tasks',value:meta('a'),expected:0}]),ConflictError);assert.equal(db.stores.transactions.size,0);assert.equal(db.stores.outbox.size,1)});
test('existing id cannot be inserted as new',async()=>{const {repo}=setup();await repo.commit([{store:'tasks',value:meta('a'),expected:null}]);await assert.rejects(repo.commit([{store:'tasks',value:meta('a'),expected:null}]),ConflictError)});
test('quota write failure rolls back without successful save',async()=>{const {db,repo}=setup();db.failWrites=true;await assert.rejects(repo.commit([{store:'tasks',value:meta('a'),expected:null}]));assert.equal(db.stores.tasks.size,0);assert.equal(db.stores.outbox.size,0)});
test('duplicate changes rejected before transaction',async()=>{const {repo}=setup();await assert.rejects(repo.commit([{store:'tasks',value:meta('a'),expected:null},{store:'tasks',value:meta('a'),expected:null}]),/DUPLICATE_CHANGE/)});
test('restore removes tombstone with replace semantics',async()=>{const {db,repo}=setup();await repo.commit([{store:'tasks',value:{...meta('a'),deletedAt:'2026-11-09'},expected:null}]);await repo.commit([{store:'tasks',value:meta('a'),expected:1}]);assert(!db.stores.tasks.get('a').deletedAt);assert.equal(db.stores.tasks.get('a').version,2)});
test('settings and recovery never enter account synchronization queue',async()=>{const {db,repo}=setup();await repo.commit([{store:'settings',value:meta('main'),expected:null},{store:'recovery',value:meta('r'),expected:null}]);assert.equal(db.stores.outbox.size,0)});
