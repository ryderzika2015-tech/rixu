import {defineComponent,ref,onMounted} from 'vue';
import {authConfigured,authUser,authPending,authError,verifyState,refreshAuth,signIn,signUp,signOut,verifyIdentity,requestPasswordReset,resetPassword,verificationEmail,sendVerification,verifyEmailCode} from '../services/neon-auth.js';

/** Compact account section in Settings. No automatic local-data upload. */
export default defineComponent({
 name:'AuthPanel',
 setup(){
  const email=ref(''), password=ref(''), name=ref(''), showLogin=ref(false), showSignUp=ref(false), showReset=ref(false), newPassword=ref('');
  const resetToken=ref(new URLSearchParams(window.location.search).get('token')||'');
  const message=ref(''), code=ref(''), verificationMessage=ref('');
  const resend=async()=>{verificationMessage.value='';try{await sendVerification(verificationEmail.value||authUser.value?.email||email.value);verificationMessage.value='验证邮件已发送，请检查收件箱和垃圾邮件；一分钟后可重发。';}catch{}};
  const confirmEmail=async()=>{verificationMessage.value='';try{await verifyEmailCode(code.value);verificationMessage.value=authUser.value?'邮箱验证成功。':'邮箱验证成功，请使用密码登录。';}catch{}finally{code.value='';}};
  onMounted(()=>{if(authConfigured)void refreshAuth()});
  const login=async()=>{
   message.value='';
   try{await signIn(email.value,password.value);password.value='';showLogin.value=false;message.value='已登录。请点击“验证 API 身份”检查授权状态。';}
   catch{password.value='';}
  };
  const register=async()=>{message.value='';try{await signUp(name.value,email.value,password.value);password.value='';showSignUp.value=false;showLogin.value=false;message.value=verificationEmail.value?'账号已创建，请完成邮箱验证。':authUser.value?'账号已创建并登录，尚未开启同步。':'账号已创建，请返回登录。';}catch{password.value='';}};
  const logout=async()=>{message.value='';try{await signOut();showLogin.value=false;message.value='已退出云端账号；本地任务和账本没有变化。';}catch{}};
  const check=async()=>{message.value='';try{await verifyIdentity();message.value='API 身份验证已通过，尚未开启同步。';}catch{}};
  const sendReset=async()=>{message.value='';try{await requestPasswordReset(email.value);message.value='如果该邮箱有账号，请检查收件箱和垃圾邮件中的重置邮件。';showReset.value=false;}catch{}};
  const completeReset=async()=>{message.value='';try{await resetPassword(resetToken.value,newPassword.value);newPassword.value='';resetToken.value='';message.value='密码已重置，请使用新密码登录。';}catch{newPassword.value='';}};
  return {code,verificationMessage,verificationEmail,resend,confirmEmail,authConfigured,authUser,authPending,authError,verifyState,email,password,name,showLogin,showSignUp,showReset,newPassword,resetToken,message,login,register,logout,check,sendReset,completeReset,refreshAuth};
 },
 template:`<section class="panel account-panel" aria-label="云端账号">
  <div class="section-heading"><h2>云端账号</h2><span class="badge">同步尚未启用</span></div>
  <p class="small muted account-note">账号只用于验证 Neon Auth 登录及日序 API 权限，本地计划、专注与记账仍保存在当前设备。</p>
  <p class="warning">本机数据尚未按账号分开，退出或更换账号后仍可查看。请勿在共用浏览器中记录私人信息。注册不代表已开通云端同步。</p>
  <p v-if="!authConfigured" class="warning">需要设置 VITE_NEON_AUTH_URL 和 VITE_SYNC_API_URL，重新构建后才可登录。</p>
  <form v-else-if="resetToken" @submit.prevent="completeReset" class="account-form"><label>新密码<input v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required/></label><button class="primary" type="submit" :disabled="authPending">设置新密码</button></form>
  <template v-else-if="authUser">
    <div class="account-details"><div class="grow"><strong>{{authUser.email||authUser.name}}</strong><small>已登录 · {{verifyState==='verified'?'API 已验证':'API 未验证'}}</small></div><span class="account-indicator" :class="{verified:verifyState==='verified'}"></span></div>
    <div class="row wrap account-actions"><button class="secondary" type="button" :disabled="authPending" @click="check">{{authPending?'验证中…':'验证 API 身份'}}</button><button class="text-button" type="button" :disabled="authPending" @click="refreshAuth">刷新状态</button><button class="text-button danger" type="button" :disabled="authPending" @click="logout">退出账号</button></div>
  </template>
  <template v-else>
    <div v-if="!showLogin&&!showReset&&!showSignUp"><p class="small muted">尚未登录云端账号</p><button class="secondary account-login-toggle" type="button" :disabled="authPending" @click="showLogin=true">使用 Neon 账号登录</button><button class="text-button" type="button" @click="showSignUp=true">创建账号</button><button class="text-button" type="button" @click="showReset=true">忘记密码</button></div>
    <form v-else-if="showReset" @submit.prevent="sendReset" class="account-form"><label>账号邮箱<input v-model.trim="email" type="email" autocomplete="email" required/></label><div class="row wrap"><button class="primary" type="submit" :disabled="authPending">发送重置邮件</button><button class="text-button" type="button" @click="showReset=false">返回</button></div></form>
    <form v-else-if="showSignUp" @submit.prevent="register" class="account-form"><p class="small muted">请使用尚未在 Neon Auth 创建过用户的邮箱。此操作不会改动已有账号或本地数据。</p><label>姓名<input v-model.trim="name" autocomplete="name" required/></label><label>邮箱<input v-model.trim="email" type="email" autocomplete="email" required/></label><label>密码<input v-model="password" type="password" autocomplete="new-password" minlength="8" required/></label><div class="row wrap"><button class="primary" type="submit" :disabled="authPending">创建账号</button><button class="text-button" type="button" @click="showSignUp=false;password=''">返回</button></div></form>
    <form v-else @submit.prevent="login" class="account-form"><label>邮箱<input v-model.trim="email" type="email" autocomplete="username" required placeholder="Neon Auth 登录邮箱"/></label><label>密码<input v-model="password" type="password" autocomplete="current-password" required placeholder="账号密码"/></label><div class="row wrap"><button class="primary" type="submit" :disabled="authPending">{{authPending?'登录中…':'登录'}}</button><button class="text-button" type="button" @click="showLogin=false;password=''">取消</button><button class="text-button" type="button" @click="showReset=true;password=''">忘记密码</button></div></form>
  </template>
  <form v-if="authConfigured&&!resetToken&&(verificationEmail||(authUser&&!authUser.emailVerified))" @submit.prevent="confirmEmail" class="account-form" aria-label="验证邮箱"><p>请验证邮箱：{{verificationEmail||authUser.email}}</p><p class="small muted">点击发送邮件后，输入收到的六位验证码；若收到验证链接，请在邮件中点击链接后刷新状态。</p><label>验证码<input v-model="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required/></label><div class="row wrap"><button type="submit" :disabled="authPending">验证邮箱</button><button type="button" :disabled="authPending" @click="resend">发送／重发验证邮件</button><button v-if="!authUser" type="button" :disabled="authPending" @click="verificationEmail='';code='';verificationMessage=''">返回登录／更换邮箱</button></div></form>
  <p v-if="verificationMessage" role="status">{{verificationMessage}}</p>
  <p v-if="authError" class="warning account-feedback" role="alert">{{authError}}</p>
  <p v-else-if="message" class="account-feedback small green" role="status">{{message}}</p>
 </section>`
});
