/** Type-only stand-in for compiling the offline distribution.
 * Actual Vite builds use the official @neon/auth dependency.
 */
export interface Result<T> {data:T|null;error:{message?:string;code?:string}|null}
export function createAuthClient(url:string): {
  signIn:{email(args:{email:string;password:string}):Promise<Result<unknown>>};
  signUp:{email(args:{name:string;email:string;password:string}):Promise<Result<{user?:{emailVerified?:boolean}}>>};
  signOut():Promise<Result<unknown>>;
  getSession():Promise<Result<{user?:{id:string;email:string;name:string;emailVerified?:boolean};session?:{token?:string}}>>;
  token():Promise<Result<{token:string}>>;
  requestPasswordReset(args:{email:string;redirectTo:string}):Promise<Result<unknown>>;
  resetPassword(args:{token:string;newPassword:string}):Promise<Result<unknown>>;
  sendVerificationEmail(args:{email:string;callbackURL:string}):Promise<Result<unknown>>;
  emailOtp:{verifyEmail(args:{email:string;otp:string}):Promise<Result<unknown>>};
}
