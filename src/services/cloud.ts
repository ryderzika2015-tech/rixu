/** Cloud capabilities stay disabled until hosted auth and endpoints are actually configured. */
export const cloudStatus={auth:'not-connected',sync:'not-connected',ai:'not-connected'} as const;
export class CloudNotConfigured extends Error {constructor(){super('CLOUD_NOT_CONNECTED')}}
export async function requestAI(_text:string):Promise<never>{throw new CloudNotConfigured()}
