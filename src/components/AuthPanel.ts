import {defineComponent,ref,onMounted} from 'vue';
import {authConfigured,authUser,authPending,authError,verifyState,refreshAuth,signIn,signOut,verifyIdentity} from '../services/neon-auth.js';

/** Compact account section in Settings. No automatic local-data upload. */
export default defineComponent({
 name:'AuthPanel',
 setup(){
  const email=ref(''), password=ref(''), showLogin=ref(false);
  const message=ref('');
  onMounted(()=>{if(authConfigured)void refreshAuth()});
  const login=async()=>{
   message.value='';
   try{await signIn(email.value,password.value);password.value='';showLogin.value=false;message.value='已登录。请点击“验证 API 身份”检查授权状态。';}
   catch{password.value='';}
  };
  const logout=async()=>{message.value='';try{await signOut();showLogin.value=false;message.value='已退出云端账号；本地任务和账本没有变化。';}catch{}};
  const check=async()=>{message.value='';try{await verifyIdentity();message.value='API 身份验证已通过，尚未开启同步。';}catch{}};
  return {authConfigured,authUser,authPending,authError,verifyState,email,password,showLogin,message,login,logout,check,refreshAuth};
 },
 template:`<section class="panel account-panel" aria-label="云端账号">
  <div class="section-heading"><h2>云端账号</h2><span class="badge">同步尚未启用</span></div>
  <p class="small muted account-note">账号只用于验证 Neon Auth 登录及日序 API 权限，本地计划、专注与记账仍保存在当前设备。</p>
  <p v-if="!authConfigured" class="warning">需要设置 VITE_NEON_AUTH_URL 和 VITE_SYNC_API_URL，重新构建后才可登录。</p>
  <template v-else-if="authUser">
    <div class="account-details"><div class="grow"><strong>{{authUser.email||authUser.name}}</strong><small>已登录 · {{verifyState==='verified'?'API 已验证':'API 未验证'}}</small></div><span class="account-indicator" :class="{verified:verifyState==='verified'}"></span></div>
    <div class="row wrap account-actions"><button class="secondary" type="button" :disabled="authPending" @click="check">{{authPending?'验证中…':'验证 API 身份'}}</button><button class="text-button" type="button" :disabled="authPending" @click="refreshAuth">刷新状态</button><button class="text-button danger" type="button" :disabled="authPending" @click="logout">退出账号</button></div>
  </template>
  <template v-else>
    <div v-if="!showLogin"><p class="small muted">尚未登录云端账号</p><button class="secondary account-login-toggle" type="button" :disabled="authPending" @click="showLogin=true">使用 Neon 账号登录</button></div>
    <form v-else @submit.prevent="login" class="account-form"><label>邮箱<input v-model.trim="email" type="email" autocomplete="username" required placeholder="Neon Auth 登录邮箱"/></label><label>密码<input v-model="password" type="password" autocomplete="current-password" required placeholder="账号密码"/></label><div class="row wrap"><button class="primary" type="submit" :disabled="authPending">{{authPending?'登录中…':'登录'}}</button><button class="text-button" type="button" @click="showLogin=false;password=''">取消</button></div></form>
  </template>
  <p v-if="authError" class="warning account-feedback" role="alert">{{authError}}</p>
  <p v-else-if="message" class="account-feedback small green" role="status">{{message}}</p>
 </section>`
});
