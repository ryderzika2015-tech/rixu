import './vue.global.js';
// The global build is imported as ESM, so its `var Vue` is module-scoped.
// Its runtime template compiler uses new Function() and expects global Vue.
const runtime = globalThis.__RIXU_VUE;
if (!runtime || typeof runtime.createApp !== 'function') {
  throw new Error('Vue runtime failed to load. Check dist/vendor.');
}
globalThis.Vue = runtime;
export const {createApp,ref,shallowRef,reactive,computed,onMounted,onUnmounted,nextTick,watch,defineComponent}=runtime;
