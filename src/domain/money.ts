export function toCents(raw:unknown):number {
 const text=String(raw).trim().replace(/[,\uff0c]/g,'');if(!/^\d+(\.\d{1,2})?$/.test(text))throw Error('INVALID_MONEY');
 const [whole,fraction='']=text.split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(result)||result<=0||result>999999999999)throw Error('INVALID_MONEY');return result;
}
export const money=(cents:number)=>(cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
