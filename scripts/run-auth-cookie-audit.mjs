import http from 'node:http';
import https from 'node:https';
import {createHmac,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,createWriteStream} from 'node:fs';
import {resolve} from 'node:path';
import {once} from 'node:events';

// No production credentials, certificate trust-store changes, or live writes.
// The real Next/Supabase cookie adapter talks to a synthetic local provider.
const args=process.argv.slice(2),reuse=args.indexOf('--reuse-build');
if(reuse<0||!args[reuse+1])throw new Error('Pass --reuse-build <existing Next production dist directory>.');
const dist=args.splice(reuse,2)[1];
if(!existsSync(resolve(dist,'BUILD_ID')))throw new Error(`Missing production build: ${dist}`);
const output=resolve('outputs/browser-auth-audit/cookie-runtime');mkdirSync(output,{recursive:true});
const key=resolve(output,'test-key.pem'),cert=resolve(output,'test-cert.pem');
const openssl=process.platform==='win32'&&existsSync('C:/Strawberry/c/bin/openssl.exe')?'C:/Strawberry/c/bin/openssl.exe':'openssl';
const sslConfig=resolve(output,'openssl.cnf');writeFileSync(sslConfig,'[req]\ndistinguished_name=dn\n[dn]\n');
const generated=spawnSync(openssl,['req','-config',sslConfig,'-x509','-newkey','rsa:2048','-nodes','-subj','/CN=127.0.0.1','-days','1','-addext','subjectAltName=IP:127.0.0.1','-keyout',key,'-out',cert],{windowsHide:true,stdio:'pipe'});
if(generated.status!==0)throw new Error(`Test certificate generation failed: ${generated.stderr?.toString().slice(-300)}`);
const user={id:'43000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'cookie-audit@example.invalid',email_confirmed_at:new Date().toISOString(),user_metadata:{},app_metadata:{provider:'email'},created_at:new Date().toISOString()};
const sessions=new Map(),logoutScopes=[];
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
const readBody=async req=>{let text='';for await(const chunk of req)text+=chunk;return text?JSON.parse(text):{};};
const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return server.address().port;};
const provider=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1'),token=(req.headers.authorization??'').replace(/^Bearer /,'');
  if(url.pathname==='/auth/v1/token'){
   const body=await readBody(req);if(body.email!==user.email||body.password!=='CookieAudit1')return json(res,400,{error_code:'invalid_credentials',msg:'Invalid login credentials'});
   const session_id=randomUUID(),iat=Math.floor(Date.now()/1000),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
   const unsigned=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:user.id,email:user.email,aud:user.aud,role:user.role,iat,exp:iat+3600,session_id})}`;
   const access_token=`${unsigned}.${createHmac('sha256','disposable-local-audit-only').update(unsigned).digest('base64url')}`;sessions.set(access_token,session_id);
   return json(res,200,{access_token,refresh_token:randomUUID(),expires_in:3600,expires_at:iat+3600,token_type:'bearer',user});
  }
  if(url.pathname==='/auth/v1/user')return sessions.has(token)?json(res,200,user):json(res,401,{msg:'Invalid session',error_code:'bad_jwt'});
  if(url.pathname==='/auth/v1/logout'){
   const scope=url.searchParams.get('scope');logoutScopes.push(scope);if(scope==='local')sessions.delete(token);else sessions.clear();res.writeHead(204);res.end();return;
  }
  if(url.pathname.startsWith('/rest/v1/profiles'))return json(res,200,[{display_name:'Cookie Audit',university:'',major:'',graduation_year:null,preferences:{avatar:'',bio:'',interests:[],language:'zh-CN'}}]);
  if(url.pathname.startsWith('/rest/v1/'))return json(res,200,[]);
  return json(res,404,{error:'Unimplemented isolated audit endpoint'});
 }catch(error){json(res,500,{error:String(error)});}
});
let next,proxy;const logfile=createWriteStream(resolve(output,'next.log'));
try{
 const upstreamPort=await listen(provider),reservation=http.createServer();const nextPort=await listen(reservation);await new Promise(r=>reservation.close(r));
 next=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(nextPort)],{windowsHide:true,env:{...process.env,NODE_ENV:'production',ACAORA_NEXT_DIST_DIR:dist,SUPABASE_URL:`http://127.0.0.1:${upstreamPort}`,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_disposable_cookie_audit',SUPABASE_ANON_KEY:'',SITE_URL:'https://127.0.0.1'},stdio:['ignore','pipe','pipe']});next.stdout.pipe(logfile);next.stderr.pipe(logfile);
 let ready=false;for(let i=0;i<90;i++){if(next.exitCode!==null)throw new Error('Next exited before audit; inspect cookie-runtime/next.log');try{if((await fetch(`http://127.0.0.1:${nextPort}/api/version`)).ok){ready=true;break;}}catch{/* Retry only while the isolated Next process starts. */}await new Promise(r=>setTimeout(r,300));}if(!ready)throw new Error('Next did not become ready.');
 proxy=https.createServer({key:readFileSync(key),cert:readFileSync(cert)},(req,res)=>{
  if(req.url==='/audit/cross-site'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Isolated cross-site cookie probe</title>');return;}
  if(req.url==='/audit/cookie-echo'){const origin=`https://localhost:${proxy.address().port}`;if(req.headers.origin!==origin){res.writeHead(403);res.end();return;}res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Cache-Control':'no-store'});res.end(JSON.stringify({hasSession:(req.headers.cookie??'').includes('auth-token')}));return;}
  const forwarded=http.request({hostname:'127.0.0.1',port:nextPort,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https'}},incoming=>{res.writeHead(incoming.statusCode,incoming.headers);incoming.pipe(res);});forwarded.on('error',()=>{if(!res.destroyed){if(!res.headersSent)res.writeHead(502);res.end();}});req.pipe(forwarded);
 });const port=await listen(proxy);
 const runner=spawn(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=playwright.cookie.config.ts',...args],{windowsHide:true,stdio:'inherit',env:{...process.env,ACAORA_COOKIE_AUDIT_URL:`https://127.0.0.1:${port}`}});
 const [code]=await once(runner,'exit');if(logoutScopes.length===0||logoutScopes.some(scope=>scope!=='local'))throw new Error('Logout did not use only local-session revocation.');process.exitCode=code??1;
}finally{
 proxy?.closeAllConnections();proxy?.close();provider.closeAllConnections();provider.close();if(next&&next.exitCode===null){next.kill();await Promise.race([once(next,'exit'),new Promise(r=>setTimeout(r,5000))]);}logfile.end();
}
