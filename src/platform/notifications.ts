import type {ReminderNode} from '../domain/reminders.js';
export interface NotificationAdapter {capability:'unavailable'|'native';reconcile(nodes:ReminderNode[]):Promise<void>}
/** Web intentionally does not pretend setTimeout is a background OS reminder. */
export const notificationAdapter:NotificationAdapter={capability:'unavailable',async reconcile(){throw Error('NATIVE_NOT_CONNECTED')}};
