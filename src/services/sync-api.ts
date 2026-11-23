/** 日序同步 HTTP 传输层；不自行登录、不自动上传本地数据。调用者必须获得明确的首次合并授权。 */
export type RemoteRecord={type:'tasks'|'goals'|'transactions'|'plans'|'taxa'|'sessions'|'drafts'|'reviews'|'settings';id:string;version:number;data:Record<string,unknown>;deletedAt:string|null;updatedAt:string};
export type SyncMutation={mutationId:string;recordType:RemoteRecord['type'];recordId:string;expectedVersion:number;operation:'upsert'|'delete';data?:Record<string,unknown>};
export type PullPage={records:RemoteRecord[];nextCursor:string|null};
export interface SyncOptions {apiBaseUrl:string;getAccessToken:()=>Promise<string|null>}
export class SyncApiError extends Error {constructor(public status:number,public code:string){super(code)}}
export function createSyncApi(options:SyncOptions){
 const base=options.apiBaseUrl.replace(/\/+$/,'');
 if(!/^https:\/\//.test(base) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(base))throw new Error('INVALID_SYNC_API_URL');
 async function fetchJson<T>(path:string,init:RequestInit={}):Promise<T>{
  const token=await options.getAccessToken();if(!token)throw new SyncApiError(401,'LOGIN_REQUIRED');
  let res:Response;
  try {res=await fetch(base+path,{...init,headers:{...init.headers,Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});}
  catch {throw new SyncApiError(0,'API_UNREACHABLE');}
  const body=await res.json().catch(()=>({error:'INVALID_RESPONSE'}));
  if(!res.ok)throw new SyncApiError(res.status,String(body?.error||'SYNC_FAILED'));
  return body as T;
 }
 return {
  me:()=>fetchJson<{userId:string}>('/v1/me'),
  pull:(cursor:string|null=null,limit=100)=>fetchJson<PullPage>(`/v1/sync/pull?limit=${limit}${cursor?'&cursor='+encodeURIComponent(cursor):''}`),
  push:(mutation:SyncMutation)=>fetchJson<{status:'applied'|'duplicate';mutationId:string;version?:number}>('/v1/sync/push',{method:'POST',body:JSON.stringify(mutation)})
 };
}
