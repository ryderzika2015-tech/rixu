/** Neon Auth browser integration: login & identity verification only.
 * Does not read, write, import, export, merge or synchronize local records.
 */
import {ref} from 'vue';
import {createSyncApi, SyncApiError} from './sync-api.js';

export interface UserIdentity {id: string; email: string; name: string}
export type VerifyState = 'none' | 'unchecked' | 'verified' | 'denied' | 'error';
export const authUser = ref<UserIdentity | null>(null);
export const authPending = ref(false);
export const authError = ref('');
export const verifyState = ref<VerifyState>('none');
export const verifiedUserId = ref('');

const browserEnv = (import.meta as ImportMeta & {env?:Record<string,string>}).env || {};
const neonAuthUrl = (browserEnv.VITE_NEON_AUTH_URL || '').trim().replace(/\/+$/, '');
const apiUrl = (browserEnv.VITE_SYNC_API_URL || '').trim().replace(/\/+$/, '');
export const authConfigured = Boolean(neonAuthUrl && apiUrl && /^https:\/\//.test(neonAuthUrl) && /^https:\/\//.test(apiUrl));

// Use official Neon browser session handling; credentials and JWTs are never
// copied into app's IndexedDB, global state, logs or localStorage.
// Dynamically load the SDK so the old offline preview keeps working without it.
async function loadClient() { const {createAuthClient}=await import('@neon/auth'); return createAuthClient(neonAuthUrl); }
type Client = Awaited<ReturnType<typeof loadClient>>;
let clientPromise:Promise<Client>|null=null;
async function getClient():Promise<Client> {
  if(!authConfigured)throw new Error('认证服务尚未配置');
  if(!clientPromise)clientPromise=loadClient();
  return clientPromise;
}
const api = authConfigured ? createSyncApi({apiBaseUrl:apiUrl, getAccessToken}) : null;

function userFromSession(value: unknown): UserIdentity | null {
  if (!value || typeof value !== 'object') return null;
  const u=(value as {user?:unknown}).user;
  if (!u || typeof u !== 'object') return null;
  const x=u as Record<string,unknown>;
  if (typeof x.id!=='string' || !x.id) return null;
  return {id:x.id, email:typeof x.email==='string'?x.email:'', name:typeof x.name==='string'?x.name:''};
}
function friendlyError(error:unknown):string {
  if (error instanceof SyncApiError) {
    if (error.code==='ACCOUNT_NOT_ALLOWED') return '该账号未获日序同步 API 授权，请核对用户 ID 白名单';
    if (error.code==='INVALID_TOKEN') return '登录令牌未通过后端验证，请检查 JWT 签发者和公钥配置';
    if (error.code==='ORIGIN_NOT_ALLOWED') return '当前网页地址尚未加入后端允许来源';
    if (error.code==='BACKEND_NOT_CONFIGURED') return '云端 API 尚未配置完成';
    if (error.code==='LOGIN_REQUIRED'||error.code==='MISSING_TOKEN') return '当前登录会话没有可用的 API 身份令牌，请刷新状态后重试';
    return `API 验证失败（${error.status}：${error.code}）`;
  }
  if (error && typeof error==='object' && 'message' in error && typeof error.message==='string')return error.message;
  return '网络或认证服务暂不可用';
}
export async function getAccessToken():Promise<string|null> {
  if (!authConfigured || !authUser.value) return null;
  const client=await getClient();
  // Neon SDK attaches the short-lived JWT to getSession().data.session.token.
  // The underlying session cookie is opaque and must never be sent to our API.
  const session=await client.getSession();
  if (session.error) throw new Error('获取登录会话失败，请刷新状态后重试');
  const currentUser=userFromSession(session.data);
  if (!currentUser || currentUser.id!==authUser.value.id) return null;
  const sessionToken=session.data?.session?.token;
  if (typeof sessionToken==='string' && sessionToken.split('.').length===3) return sessionToken;
  // Some SDK/server combinations expose the same JWT via the JWT plugin.
  const response=await client.token();
  if (response.error) throw new Error('Neon Auth 未签发 API 身份令牌，请检查认证服务设置');
  const token=response.data?.token;
  if (typeof token==='string' && token.split('.').length===3) return token;
  throw new Error('Neon Auth 未返回有效的 API 身份令牌，请检查认证服务设置');
}
export async function refreshAuth():Promise<void> {
  if (!authConfigured) {authUser.value=null;verifyState.value='none';authError.value='尚未配置认证服务';return;}
  authPending.value=true;authError.value='';
  try {
    const response=await (await getClient()).getSession();
    if (response.error) throw new Error(response.error.message||'SESSION_FAILED');
    authUser.value=userFromSession(response.data);
    verifyState.value=authUser.value?'unchecked':'none';
    verifiedUserId.value='';
  }catch(e) {authUser.value=null;verifyState.value='error';authError.value=friendlyError(e);}
  finally {authPending.value=false;}
}
export async function signIn(email:string,password:string):Promise<void> {
  if (!authConfigured)throw new Error('未配置认证服务');
  if (!email.trim() || !password)throw new Error('请输入邮箱和密码');
  authPending.value=true;authError.value='';verifiedUserId.value='';
  try {
    const client=await getClient();
    const result=await client.signIn.email({email:email.trim(),password});
    if (result.error)throw new Error(result.error.message||'登录失败');
    const response=await (await getClient()).getSession();
    if (response.error)throw new Error(response.error.message||'获取会话失败');
    authUser.value=userFromSession(response.data);
    if (!authUser.value)throw new Error('登录成功但未取得会话，请检查浏览器 Cookie 设置');
    verifyState.value='unchecked';
  }catch(e){authUser.value=null;verifyState.value='error';authError.value=friendlyError(e);throw e;}
  finally{authPending.value=false;}
}
export async function signUp(name:string,email:string,password:string):Promise<void> {
  if(!authConfigured)throw new Error('未配置认证服务');
  if(!name.trim() || !email.trim() || password.length<8)throw new Error('请输入姓名、邮箱和至少 8 位密码');
  authPending.value=true;authError.value='';
  try {
    const result=await (await getClient()).signUp.email({name:name.trim(),email:email.trim(),password});
    if(result.error)throw new Error(result.error.message||'注册失败');
    await refreshAuth();
  }catch(e){authError.value=friendlyError(e);throw e;}
  finally{authPending.value=false;}
}
export async function requestPasswordReset(email:string):Promise<void> {
  if (!authConfigured) throw new Error('未配置认证服务');
  if (!email.trim()) throw new Error('请输入邮箱');
  authPending.value=true;authError.value='';
  try {
    const redirectTo=new URL('/',window.location.origin);
    redirectTo.searchParams.set('reset','1');
    const result=await (await getClient()).requestPasswordReset({email:email.trim(),redirectTo:redirectTo.href});
    if(result.error)throw new Error(result.error.message||'无法发送重置邮件');
  }catch(e){authError.value=friendlyError(e);throw e;}
  finally{authPending.value=false;}
}
export async function resetPassword(token:string,newPassword:string):Promise<void> {
  if(!token || !newPassword)throw new Error('重置链接或新密码无效');
  authPending.value=true;authError.value='';
  try {
    const result=await (await getClient()).resetPassword({token,newPassword});
    if(result.error)throw new Error(result.error.message||'重置密码失败');
    const url=new URL(window.location.href);
    url.searchParams.delete('token');url.searchParams.delete('reset');
    window.history.replaceState(null,'',url.pathname+url.search+url.hash);
  }catch(e){authError.value=friendlyError(e);throw e;}
  finally{authPending.value=false;}
}
export async function verifyIdentity():Promise<void> {
  if (!api || !authUser.value)throw new Error('请先登录');
  authPending.value=true;authError.value='';verifiedUserId.value='';
  try {
    const response=await api.me(); // Only GET /v1/me, never /pull or /push
    if (!response.userId || response.userId!==authUser.value.id) throw new Error('API 返回身份与登录账号不一致');
    verifiedUserId.value=response.userId;verifyState.value='verified';
  }catch(e){verifyState.value=e instanceof SyncApiError?'denied':'error';authError.value=friendlyError(e);throw e;}
  finally{authPending.value=false;}
}
export async function signOut():Promise<void> {
  if (!authConfigured)return;authPending.value=true;authError.value='';
  try {
    const result=await (await getClient()).signOut();
    if (result.error)throw new Error(result.error.message||'退出失败');
    authUser.value=null;verifyState.value='none';verifiedUserId.value='';
  }catch(e){authError.value=friendlyError(e);throw e;}
  finally{authPending.value=false;}
}
