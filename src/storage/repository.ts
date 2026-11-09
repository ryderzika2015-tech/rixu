import {emptySnapshot,STORES,clone,uid,type Snapshot,type Change,type Outbox,type Entity} from '../domain/model.js';
export interface Repository {load():Promise<Snapshot>;commit(changes:Change[]):Promise<void>;close():void}
export class ConflictError extends Error {constructor(){super('CONFLICT')}}
function request<T>(r:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function completed(tx:IDBTransaction){return new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('SAVE_FAILED'));tx.onerror=()=>reject(tx.error||Error('SAVE_FAILED'))})}
export class IndexedDbRepository implements Repository {
 constructor(private db:IDBDatabase){}
 static async open(name='rixu-engineering-v3'):Promise<IndexedDbRepository>{
 const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{const db=r.result;for(const s of [...STORES,'outbox'])if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});};
 const db=await request(r);db.onversionchange=()=>db.close();return new IndexedDbRepository(db);
 }
 async load():Promise<Snapshot>{const tx=this.db.transaction(STORES,'readonly'),done=completed(tx),data=emptySnapshot();await Promise.all(STORES.map(async name=>{(data as any)[name]=await request(tx.objectStore(name).getAll())}));await done;return data}
 async commit(changes:Change[]):Promise<void>{
 if(!changes.length)return;const dedupe=new Set<string>();for(const c of changes){const k=c.store+':'+c.value.id;if(dedupe.has(k))throw Error('DUPLICATE_CHANGE');dedupe.add(k)}
 const names=[...new Set(changes.map(x=>x.store)),'outbox'];const tx=this.db.transaction(names,'readwrite');const done=completed(tx);let failure:unknown;
 try {
 for(const c of changes){
 const os=tx.objectStore(c.store);const old=await request<Entity|undefined>(os.get(c.value.id));
 if(c.expected===null?!!old:(!old||old.version!==c.expected))throw new ConflictError();
 const value={...clone(c.value),version:(old?.version??0)+1,updatedAt:new Date().toISOString()};os.put(value);
 if(!['settings','recovery'].includes(c.store)){
 const op:Outbox={id:uid(),entity:c.store,entityId:value.id,version:value.version,createdAt:value.updatedAt,operation:value.deletedAt?'delete':'upsert',status:'local-only',payload:value};tx.objectStore('outbox').put(op);
 }
 }
 }catch(e){failure=e;try{tx.abort()}catch(_){}}
 try{await done}catch(e){throw failure||e}if(failure)throw failure;
 }
 close(){this.db.close()}
}
