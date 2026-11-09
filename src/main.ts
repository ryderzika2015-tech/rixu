import {createApp} from 'vue';
import App from './App.js';
import {notify} from './services/store.js';
type BootGuard = {mounted():void;fail(error:unknown):void};
const guard=(window as Window & {__rixuBoot?:BootGuard}).__rixuBoot;
const app=createApp(App);
app.config.errorHandler=(error:unknown)=>{
  console.error(error);
  const root=document.getElementById('app');
  if (!root?.querySelector('.shell,.boot')) guard?.fail(error);
  notify(error instanceof Error?error.message:'SAVE_FAILED');
};
try {
  app.mount('#app');
  if (!document.getElementById('app')?.querySelector('.shell,.boot')) {
    throw new Error('App mounted without a visible root. Check browser Console.');
  }
  guard?.mounted();
} catch (error) {
  console.error(error);
  guard?.fail(error);
}
