export function reminderSound(){
 const rate=22050,seconds=1.6,n=Math.floor(rate*seconds),buffer=Buffer.alloc(44+n*2);
 buffer.write('RIFF',0);buffer.writeUInt32LE(36+n*2,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(rate,24);buffer.writeUInt32LE(rate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(n*2,40);
 for(let i=0;i<n;i++){const t=i/rate,local=t%0.8,env=Math.min(1,local/0.03)*Math.exp(-local*4);const v=Math.sin(2*Math.PI*(t<0.8?660:880)*t)*env*0.55;buffer.writeInt16LE(Math.round(v*32767),44+i*2);}return buffer;
}
