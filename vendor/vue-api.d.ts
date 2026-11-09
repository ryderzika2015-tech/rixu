/** Offline compile contract for the Vue APIs used here. Full Vue types are used by npm typecheck. */
declare module 'vue' {
 export interface Ref<T> {value:T}
 export function ref<T>(value:T):Ref<T>;
 export function shallowRef<T>(value:T):Ref<T>;
 export function computed<T>(f:()=>T):Readonly<Ref<T>>;
 export function reactive<T extends object>(value:T):T;
 export function onMounted(f:()=>unknown):void;
 export function onUnmounted(f:()=>unknown):void;
 export function nextTick():Promise<void>;
 export function watch<T>(source:unknown,callback:(value:T,old?:T)=>unknown,options?:unknown):()=>void;
 export function createApp(root:unknown):{mount(el:string|Element):unknown;config:{errorHandler?: (...args:any[])=>void}};
 export function defineComponent<T>(options:T):T;
}
