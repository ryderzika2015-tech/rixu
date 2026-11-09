import {meta,alive,type Snapshot,type Scope,type Taxon} from './model.js';
export const DEFAULT_CATEGORIES:Record<Scope,string[]>={task:['\u82f1\u8bed\u5b66\u4e60','\u4e13\u4e1a\u5b66\u4e60','\u9879\u76ee\u5de5\u4f5c','\u8fd0\u52a8\u5065\u5eb7','\u65e5\u5e38\u751f\u6d3b'],expense:['\u9910\u996e','\u8d2d\u7269','\u4ea4\u901a','\u5b66\u4e60','\u533b\u7597\u5065\u5eb7','\u751f\u6d3b\u670d\u52a1','\u5a31\u4e50','\u5176\u4ed6\u652f\u51fa'],income:['\u751f\u6d3b\u8d39','\u517c\u804c','\u5956\u5b66\u91d1','\u7ea2\u5305\u793c\u91d1','\u5176\u4ed6\u6536\u5165']};
export const UNCLASSIFIED='\u672a\u5206\u7c7b';
export function ensureTaxon(s:Snapshot,scope:Scope|'tag',raw:string):string{
 const name=raw.trim()||UNCLASSIFIED;if(name.length>80)throw Error('TEXT_TOO_LONG');
 const exact=alive(s.taxa).find(c=>c.scope===scope&&(c.name===name||c.aliases.includes(name)));if(exact)return exact.id;
 // Deleted aliases deliberately route to unclassified instead of resurrecting deleted categories.
 const removed=s.taxa.find(c=>c.scope===scope&&c.deletedAt&&(c.name===name||c.aliases.includes(name)));
 if(removed&&scope==='tag')return '';
 if(removed&&name!==UNCLASSIFIED)return ensureTaxon(s,scope,UNCLASSIFIED);
 const item:Taxon={...meta(),name,scope,aliases:[]};s.taxa.push(item);return item.id;
}
export const taxonomyName=(s:Snapshot,id:string)=>s.taxa.find(c=>c.id===id)?.name||UNCLASSIFIED;
export const tagNames=(s:Snapshot,ids:string[])=>ids.map(id=>s.taxa.find(c=>c.id===id)?.name).filter(Boolean) as string[];
export function tagsFromNames(s:Snapshot,raw:string[]|string):string[]{const names=Array.isArray(raw)?raw:raw.split(/[,\uff0c;\uff1b|]/);return [...new Set(names.map(x=>String(x).trim()).filter(Boolean).map(x=>ensureTaxon(s,'tag',x)).filter(Boolean))]}
export function renameTaxon(s:Snapshot,id:string,name:string):void{
 const c=s.taxa.find(x=>x.id===id&&!x.deletedAt);if(!c)throw Error('NOT_FOUND');name=name.trim();if(!name||name.length>80)throw Error('INVALID_NAME');
 if(s.taxa.some(x=>x.id!==id&&!x.deletedAt&&x.scope===c.scope&&x.name===name))throw Error('NAME_EXISTS');
 if(!c.aliases.includes(c.name))c.aliases.push(c.name);c.name=name;
}
export function removeTaxon(s:Snapshot,id:string,target?:string):void{
 const c=s.taxa.find(x=>x.id===id&&!x.deletedAt);if(!c)throw Error('NOT_FOUND');
 if(target===id)throw Error('INVALID_TARGET');
 let replacement='';if(c.scope!=='tag'){
 if(target){const r=s.taxa.find(x=>x.id===target&&!x.deletedAt&&x.scope===c.scope);if(!r)throw Error('INVALID_TARGET');replacement=r.id}
 else {if(c.name===UNCLASSIFIED)throw Error('SELECT_REPLACEMENT');replacement=ensureTaxon(s,c.scope,UNCLASSIFIED)}
 const r=s.taxa.find(x=>x.id===replacement)!;r.aliases=[...new Set([...r.aliases,c.name,...c.aliases])];
 }
 for(const list of [s.tasks,s.transactions,s.goals,s.sessions])for(const r of list){if(c.scope==='tag')r.tagIds=r.tagIds.filter(x=>x!==id);else if(r.categoryId===id)r.categoryId=replacement}
 const active=s.settings[0]?.activeFocus;if(active){if(c.scope==='tag')active.tagIds=active.tagIds.filter(x=>x!==id);else if(active.categoryId===id)active.categoryId=replacement}
 c.deletedAt=new Date().toISOString();
}
