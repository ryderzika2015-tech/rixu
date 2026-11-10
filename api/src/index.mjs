import {createRemoteJWKSet,jwtVerify} from 'jose';
import {pullRecords,applyMutation} from './database.mjs';
import {ProtocolError,parseMutation,parseCursor,encodeCursor,originAllowed,allowedUser,json,readJsonCapped} from './protocol.mjs';
const keys=new Map();
function config(env) {
  if(!env.DATABASE_URL || !env.NEON_AUTH_JWKS_URL || !env.NEON_AUTH_BASE_URL || !env.ALLOWED_USER_IDS)throw new ProtocolError(503,'BACKEND_NOT_CONFIGURED');
  const auth=new URL(env.NEON_AUTH_BASE_URL);
  if(auth.protocol!=='https:')throw new ProtocolError(503,'AUTH_URL_NOT_HTTPS');
  const jwksUrl=new URL(env.NEON_AUTH_JWKS_URL);
  if(jwksUrl.protocol!=='https:')throw new ProtocolError(503,'JWKS_URL_NOT_HTTPS');
  return {auth,jwksUrl};
}
async function authorize(request,env) {
  const {auth,jwksUrl}=config(env);
  const header=request.headers.get('Authorization')||'';
  if(!/^Bearer\s+\S+$/i.test(header))throw new ProtocolError(401,'MISSING_TOKEN');
  const token=header.replace(/^Bearer\s+/i,'');
  const jwksKey=jwksUrl.href;
  if(!keys.has(jwksKey))keys.set(jwksKey,createRemoteJWKSet(jwksUrl));
  let payload;
  try {
    ({payload}=await jwtVerify(token,keys.get(jwksKey),{issuer:auth.origin,algorithms:['EdDSA']}));
  }catch {throw new ProtocolError(401,'INVALID_TOKEN');}
  if(typeof payload.sub!=='string'||!payload.sub)throw new ProtocolError(401,'INVALID_SUBJECT');
  if(!allowedUser(payload.sub,env))throw new ProtocolError(403,'ACCOUNT_NOT_ALLOWED');
  return payload.sub;
}
export default {
 async fetch(request,env) {
  const origin=request.headers.get('Origin')||'';
  if(!originAllowed(origin,env))return json({error:'ORIGIN_NOT_ALLOWED'},403);
  const corsOrigin=origin;
  if(request.method==='OPTIONS'){
   const h={'vary':'Origin','access-control-allow-origin':corsOrigin,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Authorization,Content-Type','access-control-max-age':'3600'};
   return new Response(null,{status:204,headers:h});
  }
  const url=new URL(request.url);
  if(url.pathname==='/health'&&request.method==='GET')return json({service:'rixu-api',status:'ready',storage:'not-checked'},200,corsOrigin);
  try {
    if(!['/v1/me','/v1/sync/pull','/v1/sync/push'].includes(url.pathname))throw new ProtocolError(404,'NOT_FOUND');
    const userId=await authorize(request,env);
    if(url.pathname==='/v1/me'&&request.method==='GET')return json({userId},200,corsOrigin);
    if(url.pathname==='/v1/sync/pull'&&request.method==='GET') {
      const cursor=parseCursor(url.searchParams.get('cursor'));
      const limitString=url.searchParams.get('limit');
      const limit=limitString===null?100:Number(limitString);
      if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new ProtocolError(400,'INVALID_LIMIT');
      const rows=await pullRecords(env.DATABASE_URL,userId,cursor,limit);
      const records=rows.map(r=>({type:r.record_type,id:r.record_id,version:Number(r.version),data:r.data,deletedAt:r.deleted_at,updatedAt:r.updated_at}));
      const nextCursor=rows.length===limit?encodeCursor(rows[rows.length-1]):null;
      return json({records,nextCursor},200,corsOrigin);
    }
    if(url.pathname==='/v1/sync/push'&&request.method==='POST') {
      const mutation=parseMutation(await readJsonCapped(request));
      const response=await applyMutation(env.DATABASE_URL,userId,mutation);
      return json(response,200,corsOrigin);
    }
    throw new ProtocolError(405,'METHOD_NOT_ALLOWED');
  }catch(error) {
    if(error instanceof ProtocolError)return json({error:error.code},error.status,corsOrigin);
    console.error('RIXU_BACKEND_ERROR',error?.code||error?.name||'UNKNOWN');
    return json({error:'INTERNAL_ERROR'},500,corsOrigin);
  }
 }
};
