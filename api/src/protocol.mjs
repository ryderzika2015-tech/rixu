export const RECORD_TYPES = new Set(['tasks','goals','transactions','plans','taxa','sessions','drafts','reviews','settings']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[\w.:-]{1,128}$/;
export class ProtocolError extends Error {
  constructor(status, code) {super(code); this.status=status;this.code=code;}
}
export function parseMutation(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProtocolError(400,'INVALID_BODY');
  const {mutationId,recordType,recordId,expectedVersion,operation,data}=body;
  if (!UUID.test(mutationId||'')) throw new ProtocolError(400,'INVALID_MUTATION_ID');
  if (!RECORD_TYPES.has(recordType)) throw new ProtocolError(400,'INVALID_RECORD_TYPE');
  if (typeof recordId!=='string' || !ID.test(recordId)) throw new ProtocolError(400,'INVALID_RECORD_ID');
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion<0) throw new ProtocolError(400,'INVALID_VERSION');
  if (!['upsert','delete'].includes(operation)) throw new ProtocolError(400,'INVALID_OPERATION');
  if (operation==='upsert' && (!data || Array.isArray(data) || typeof data !== 'object')) throw new ProtocolError(400,'INVALID_DATA');
  if (operation==='delete' && expectedVersion===0) throw new ProtocolError(400,'DELETE_REQUIRES_VERSION');
  const saved = operation==='delete'?{id:recordId}:structuredClone(data);
  if (saved.id!==undefined && saved.id!==recordId) throw new ProtocolError(400,'ID_MISMATCH');
  // Ownership, timestamps, versions, and tombstones are always server-owned.
  delete saved.user_id; delete saved.userId; delete saved.updatedAt; delete saved.version; delete saved.deletedAt;
  saved.id=recordId;
  return {mutationId,recordType,recordId,expectedVersion,operation,data:saved};
}
export function encodeCursor(row) {
  return btoa(JSON.stringify({t:row.updated_at,k:row.record_type,i:row.record_id})).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function parseCursor(input) {
  if (!input) return {t:null,k:'',i:''};
  if (typeof input!=='string'||input.length>1024) throw new ProtocolError(400,'INVALID_CURSOR');
  try {
    const x=JSON.parse(atob(input.replace(/-/g,'+').replace(/_/g,'/')));
    if(typeof x.t!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(x.t)||!RECORD_TYPES.has(x.k)||!ID.test(x.i))throw Error('invalid');
    return x;
  }catch {throw new ProtocolError(400,'INVALID_CURSOR');}
}
export function originAllowed(origin, env) {
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  if (!origin) return true; // non-browser clients still require valid JWT
  return allowed.includes(origin); // no wildcard origin, no reflection of arbitrary origin
}
export function allowedUser(userId, env) {
  const allowed=(env.ALLOWED_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
  return allowed.length>0 && allowed.includes(userId);
}
export function json(body,status=200,origin='') {
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'};
  if(origin) {headers['access-control-allow-origin']=origin;headers['access-control-allow-methods']='GET,POST,OPTIONS';headers['access-control-allow-headers']='Authorization,Content-Type';headers['access-control-max-age']='3600';}
  return new Response(JSON.stringify(body),{status,headers});
}
export async function readJsonCapped(request,maxBytes=65536) {
  const contentType=request.headers.get('content-type')||'';
  if(!contentType.toLowerCase().startsWith('application/json')) throw new ProtocolError(415,'EXPECTED_JSON');
  if(Number(request.headers.get('content-length')||0)>maxBytes)throw new ProtocolError(413,'BODY_TOO_LARGE');
  if(!request.body)throw new ProtocolError(400,'EMPTY_BODY');
  const chunks=[];let size=0;const reader=request.body.getReader();
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw new ProtocolError(413,'BODY_TOO_LARGE');chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{throw new ProtocolError(400,'INVALID_JSON');}
}
