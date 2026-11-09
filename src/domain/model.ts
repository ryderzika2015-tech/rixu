export const SCHEMA = 3 as const;
export type Scope='task'|'expense'|'income';
export interface Entity {id:string;version:number;updatedAt:string;deletedAt?:string;extra?:Record<string,unknown>}
export interface Taxon extends Entity {name:string;scope:Scope|'tag';aliases:string[]}
export interface ReminderRule {mode:'default'|'custom'|'off';custom:string[];snoozedUntil?:string;repeatCount?:number;repeatMinutes?:number}
export interface Task extends Entity {
 title:string;date:string;estimate:number;quantity:number;unit:string;progress:number;
 required:boolean;status:'pending'|'partial'|'done'|'cancelled';type:'task'|'memo';
 categoryId:string;tagIds:string[];note:string;start:string;end:string;deadline:string;
 planId:string;source:string;knowledge:string;stage:string;actualLegacySeconds:number;
 carriedFrom?:string;reminders:ReminderRule;
}
export interface Goal extends Entity {title:string;date:string;kind:'milestone'|'habit';categoryId:string;tagIds:string[];note:string;planId:string;done:boolean;checkins:string[]}
export interface Transaction extends Entity {title:string;date:string;type:'expense'|'income';amount:number;currency:'CNY';categoryId:string;tagIds:string[];note:string}
export interface Plan extends Entity {name:string;externalId:string;note:string}
export interface Segment {from:number;to:number;date:string;seconds:number}
export interface FocusSession extends Entity {taskId:string;taskTitle:string;categoryId:string;tagIds:string[];startedAt:string;endedAt:string;targetSeconds:number;seconds:number;segments:Segment[];mode:'learning'|'strict';audit:unknown[];completed:boolean}
export interface ActiveFocus {id:string;taskId:string;taskTitle:string;categoryId:string;tagIds:string[];targetSeconds:number;accumulated:number;tickAt:number|null;startedAt:string;mode:'learning'|'strict';segments:Segment[];paused:boolean;sound:'off'|'rain'|'soft'|'piano'}
export interface Draft extends Entity {raw:string;mode:'auto'|'ledger'|'task'|'memo';reason:string;date:string}
export interface Review extends Entity {date:string;text:string;capacity:number}
export interface Settings extends Entity {schemaVersion:3;timezone:string;capacity:number;budgets:Record<string,number>;farDays:number;nearHours:number;repeatCount?:number;repeatMinutes?:number;startAlerts:boolean;overdue:boolean;quiet:boolean;focusPreferences:Record<string,{minutes:number;mode:'learning'|'strict';sound:string}>;initialized:boolean;activeFocus:ActiveFocus|null}
export interface Recovery extends Entity {reason:string;raw:unknown}
export interface Outbox {id:string;entity:string;entityId:string;version:number;createdAt:string;operation:'upsert'|'delete';status:'local-only';payload:unknown}
export interface RecordMap {tasks:Task;goals:Goal;transactions:Transaction;plans:Plan;taxa:Taxon;sessions:FocusSession;drafts:Draft;reviews:Review;settings:Settings;recovery:Recovery}
export type StoreName=keyof RecordMap;
export const STORES:StoreName[]=['tasks','goals','transactions','plans','taxa','sessions','drafts','reviews','settings','recovery'];
export type Snapshot={[K in StoreName]:RecordMap[K][]};
export interface Change {store:StoreName;value:Entity;expected:number|null}
export function emptySnapshot():Snapshot {return {tasks:[],goals:[],transactions:[],plans:[],taxa:[],sessions:[],drafts:[],reviews:[],settings:[],recovery:[]}}
export const alive=<T extends Entity>(items:T[])=>items.filter(i=>!i.deletedAt);
export const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
export const uid=()=>crypto.randomUUID();
export const meta=(id:string=uid()):Entity=>({id,version:0,updatedAt:new Date().toISOString()});
export function initialSettings():Settings {return {...meta('main'),schemaVersion:SCHEMA,timezone:'Asia/Shanghai',capacity:360,budgets:{},farDays:3,nearHours:4,repeatCount:1,repeatMinutes:30,startAlerts:true,overdue:false,quiet:true,focusPreferences:{},initialized:true,activeFocus:null}}
