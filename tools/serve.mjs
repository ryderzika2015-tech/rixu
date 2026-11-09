import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=process.argv[2]?resolve(process.argv[2]):resolve(project,'dist');
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
try {await stat(resolve(root,'index.html'));await stat(resolve(root,'app/main.js'));}
catch {console.error('Built files missing. Extract the complete ZIP and keep dist/.');process.exit(1)}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 try {
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return}
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,'.'+path);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return}
  if((await stat(file)).isDirectory())file=resolve(file,'index.html');
  const content=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:content);
 }catch(e){res.writeHead(e instanceof URIError?400:404,{'Content-Type':'text/plain; charset=utf-8'});res.end(e instanceof URIError?'Bad URL':'Not found')}
});
server.on('error',e=>{
 console.error(e.code==='EADDRINUSE'?`Port ${port} is occupied. Stop the OLD server with Ctrl+C, then start this version. Do not clear browser data.`:e.message);
 process.exitCode=1;
});
server.listen(port,host,()=>console.log(`Rixu 0.3.1 - http://${host}:${port}\nServing: ${root}\nKeep this window open. Stop with Ctrl+C.`));
