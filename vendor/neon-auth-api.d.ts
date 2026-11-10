/** Type-only stand-in for compiling the offline distribution.
 * Actual Vite builds use the official @neon/auth dependency.
 */
export interface Result<T> {data:T|null;error:{message?:string}|null}
export function createAuthClient(url:string): {
  signIn:{email(args:{email:string;password:string}):Promise<Result<unknown>>};
  signOut():Promise<Result<unknown>>;
  getSession():Promise<Result<{user?:{id:string;email:string;name:string}}>>;
  token():Promise<Result<{token:string}>>;
}
