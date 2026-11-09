import {ref} from 'vue';
import {dayAt} from './domain/time.js';
export const page=ref('today'),selectedDay=ref(dayAt()),focusOpen=ref(false);
export interface Panel {name:string;payload:any}
export const stack=ref<Panel[]>([]);
export const current=()=>stack.value[stack.value.length-1];
export function open(name:string,payload:any={}){stack.value=[...stack.value,{name,payload}]}
export function close(){stack.value=stack.value.slice(0,-1)}
export function closeAll(){stack.value=[]}
export function navigate(name:string){page.value=name;stack.value=[];window.scrollTo({top:0,behavior:'instant'})}
export const titles:Record<string,string>={task:'task',goal:'goals',agenda:'agenda',plans:'myPlans',capture:'quick',transaction:'transactionTitle',taxonomy:'taxa',backup:'backup',trash:'trash',search:'search',planner:'planTomorrow',focusSetup:'focusSetup',reminders:'reminders',knowledge:'learningMethod',inbox:'inbox',about:'about',allTasks:'todayPlan'};
