import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import http from 'node:http';

const origin='http://127.0.0.1:3220',protocol='acaora-local-runner-v1',python=process.env.ACAORA_TEST_PYTHON??'python';
const source=new URL('../public/repro/local-runner.py',import.meta.url);
const hash=value=>createHash('sha256').update(value).digest('hex');
const canonical=value=>value&&typeof value==='object'?(Array.isArray(value)?`[${value.map(canonical).join(',')}]`:`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`):JSON.stringify(value);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function job(marker='1',requestId=randomUUID()){
 const data={headers:['x'],rows:[[marker],['2']]},analysis={kind:'basic',config:{method:'describe',x:'x',y:'',group:'',value:''}},fingerprint=hash(JSON.stringify(data));
 return {requestId,runtime:'python',manifest:{format:'acaora-reproduction-pack',version:1,analysis,dataset:{fingerprint,sourceFingerprint:'b'.repeat(64),headers:data.headers,rows:data.rows.length},verificationIdentity:{engine:'acaora-stats-v2',settingsHash:hash(canonical(analysis)),dataFingerprint:fingerprint,sourceFingerprint:'b'.repeat(64)}},data};
}
function request(info,path='/health',{method='GET',body,token=info.token,requestOrigin=origin,headers={},timeoutMs=15000}={}){
 const raw=body===undefined?null:typeof body==='string'?body:JSON.stringify(body);
 return new Promise((resolve,reject)=>{const value=http.request(info.url+path,{method,headers:{Origin:requestOrigin,...(token?{Authorization:`Bearer ${token}`}:{}) ,...(raw!==null?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw)}:{}),...headers}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const text=Buffer.concat(chunks).toString();resolve({status:response.statusCode,headers:response.headers,body:text?JSON.parse(text):null});});});value.on('error',reject);value.setTimeout(timeoutMs,()=>value.destroy(new Error('Companion test request timed out')));if(raw!==null)value.write(raw);value.end();});
}
async function start({timeout=2,budget,real=false}={}){
 const folder=await mkdtemp(join(tmpdir(),'acaora-local-runner-test-')),counter=join(folder,'executions.txt');
 await copyFile(source,join(folder,'local-runner.py'));
 const script=`import json,platform,time,sys\nfrom pathlib import Path\np=Path(__file__).resolve().parent\nc=Path(${JSON.stringify(counter)})\nwith c.open('a',encoding='utf-8') as f:f.write('executed\\n')\nm=json.loads((p/'manifest.json').read_text(encoding='utf-8'))\nd=json.loads((p/'analysis-data.json').read_text(encoding='utf-8'))\nmarker=d['rows'][0][0]\nif marker=='sleep':time.sleep(3)\nif marker=='fail':print('controlled script failure',file=sys.stderr);sys.exit(17)\nr={'verificationIdentity':m['verificationIdentity'],'verificationMetrics':[['n',len(d['rows'])],['mean',1.234567890123]],'versions':{'python':platform.python_version()}}\nif marker=='large':r['tooLarge']='x'*(10*1024*1024)\n(p/'python-results.json').write_text(json.dumps(r,ensure_ascii=False),encoding='utf-8')\n`;
 await writeFile(join(folder,'analysis.py'),script);await writeFile(join(folder,'analysis.R'),'# Controlled test R fixture; no execution requested.');await writeFile(join(folder,'requirements.txt'),'# No installs in companion tests.\n');
 if(real){await copyFile(new URL('../public/repro/analysis.py',import.meta.url),join(folder,'analysis.py'));await copyFile(new URL('../public/repro/analysis.R',import.meta.url),join(folder,'analysis.R'));await writeFile(join(folder,'requirements.txt'),'numpy==2.5.4\nscipy==1.18.1\nstatsmodels==0.15.0\npandas==3.0.6\n');}
 const child=spawn(python,['local-runner.py','--port','0','--allow-origin',origin,'--timeout',String(timeout),...(budget?['--max-request-bytes',String(budget)]:[])],{cwd:folder,stdio:['ignore','pipe','pipe'],windowsHide:true});
 let stdout='',stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
 const info=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(new Error('Companion startup failed: '+stderr));},15000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Companion exited ${code}: ${stderr}`));});child.stdout.on('data',chunk=>{stdout+=chunk.toString();if(stdout.includes('\n')){clearTimeout(timer);try{resolve(JSON.parse(stdout.split('\n')[0]));}catch(error){reject(error);}}});});
 async function count(){try{return (await readFile(counter,'utf8')).trim().split('\n').filter(Boolean).length;}catch{return 0;}}
 async function close(){child.kill();if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));await rm(folder,{recursive:true,force:true,maxRetries:5,retryDelay:50});}
 return {info,folder,script,count,close,logs:()=>({stdout,stderr})};
}

test('local companion protects health, CORS, host and token boundaries without request logging',async()=>{
 const runner=await start();try{
  const {info}=runner;assert.equal(info.protocol,protocol);assert.match(info.url,/^http:\/\/127\.0\.0\.1:\d+$/);assert.ok(info.token.length>=40);
  let response=await request(info);assert.equal(response.status,200);assert.equal(response.body.protocol,protocol);assert.equal(response.body.capabilities.python,true);assert.match(response.body.environmentHash,/^[a-f0-9]{64}$/);assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.headers['access-control-allow-origin'],origin);
  const environment=await request(info,'/environment');assert.deepEqual(environment.body.environment,response.body.environment);const lock=JSON.parse(await readFile(join(runner.folder,'environment-lock.json'),'utf8'));assert.equal(lock.environmentHash,response.body.environmentHash);assert.equal(lock.scriptHashes.python,hash(runner.script));
  response=await request(info,'/run',{method:'OPTIONS',token:null,headers:{'Access-Control-Request-Private-Network':'true','Access-Control-Request-Headers':'authorization,content-type'}});assert.equal(response.status,204);assert.equal(response.headers['access-control-allow-private-network'],'true');
  assert.equal((await request(info,'/health',{token:null})).status,401);assert.equal((await request(info,'/health',{token:'invalid'})).status,401);assert.equal((await request(info,'/health',{requestOrigin:'https://unexpected.example'})).status,403);assert.equal((await request(info,'/health',{headers:{Host:'attacker.example'}})).status,403);
  assert.equal((await request(info,'/health?token='+info.token,{token:null})).status,401);assert.equal((await request(info,'/unknown')).status,404);assert.equal(await runner.count(),0);assert.equal(runner.logs().stdout.trim().split('\n').length,1);assert.equal(runner.logs().stderr,'');
 }finally{await runner.close();}
});

test('fixed script actually executes once, binds identity, locks environment and retries the same receipt',async()=>{
 const runner=await start();try{
  const health=(await request(runner.info)).body,body=job();body.expectedEnvironment=health.environmentHash;
  let response=await request(runner.info,'/run',{method:'POST',body});assert.equal(response.status,200);assert.equal(await runner.count(),1);assert.equal(response.body.verificationMetrics[1][1],1.234567890123);assert.equal(response.body.executionReceipt.scriptHash,hash(runner.script));assert.equal(response.body.executionReceipt.environmentHash,health.environmentHash);assert.equal(response.body.executionReceipt.requestId,body.requestId);assert.equal(response.body.executionReceipt.runtime,'python');assert.equal(response.body.executionReceipt.protocol,protocol);
  const first=response.body;response=await request(runner.info,'/run',{method:'POST',body:structuredClone(body)});assert.equal(response.status,200);assert.deepEqual(response.body,first);assert.equal(await runner.count(),1);
  response=await request(runner.info,'/run',{method:'POST',body:{...job('3',body.requestId),expectedEnvironment:health.environmentHash}});assert.equal(response.status,409);assert.equal(response.body.code,'REQUEST_ID_CONFLICT');
  response=await request(runner.info,'/run',{method:'POST',body:{...job(),expectedEnvironment:'f'.repeat(64)}});assert.equal(response.status,409);assert.equal(response.body.code,'ENVIRONMENT_MISMATCH');assert.equal(await runner.count(),1);
  const changed=job();changed.data.rows[0][0]='changed';response=await request(runner.info,'/run',{method:'POST',body:changed});assert.equal(response.status,400);assert.equal(response.body.code,'IDENTITY_MISMATCH');
  response=await request(runner.info,'/run',{method:'POST',body:{...job(),script:'arbitrary.py',args:['unsafe']}});assert.equal(response.status,400);assert.equal(response.body.code,'INVALID_REQUEST');assert.equal(await runner.count(),1);
  const invalid=job();invalid.manifest.analysis.kind=[];response=await request(runner.info,'/run',{method:'POST',body:invalid});assert.equal(response.status,400);
  response=await request(runner.info,'/run',{method:'POST',body:'{"requestId":"one","requestId":"two"}'});assert.equal(response.status,400);assert.equal(response.body.code,'INVALID_JSON');
 }finally{await runner.close();}
});

test('one active subprocess, finite timeout and retained failed receipts leave the worker available',async()=>{
 const runner=await start({timeout:1});try{
  const body=job('sleep'),pending=request(runner.info,'/run',{method:'POST',body});for(let i=0;i<400&&await runner.count()===0;i++)await delay(10);assert.equal(await runner.count(),1);
  let response=await request(runner.info,'/run',{method:'POST',body:job()});assert.equal(response.status,409);assert.equal(response.body.code,'RUNNING');
  response=await pending;assert.equal(response.status,408);assert.equal(response.body.code,'RUN_TIMEOUT');response=await request(runner.info,'/run',{method:'POST',body});assert.equal(response.status,408);assert.equal(await runner.count(),1);
  response=await request(runner.info,'/run',{method:'POST',body:job()});assert.equal(response.status,200);assert.equal(await runner.count(),2);
  response=await request(runner.info,'/run',{method:'POST',body:job('fail')});assert.equal(response.status,422);assert.equal(response.body.code,'RUN_FAILED');assert.match(response.body.error,/controlled script failure/);
 }finally{await runner.close();}
});

test('request and output caps refuse oversized content without arbitrary code or unbounded response',async()=>{
 const runner=await start({budget:1024});try{
  let response=await request(runner.info,'/run',{method:'POST',body:'x'.repeat(1025)});assert.equal(response.status,413);assert.equal(response.body.code,'REQUEST_LIMIT');assert.equal(await runner.count(),0);
  response=await request(runner.info,'/run',{method:'POST',body:job('large')});assert.equal(response.status,413);assert.equal(response.body.code,'OUTPUT_LIMIT');assert.equal(await runner.count(),1);assert.ok(JSON.stringify(response.body).length<2000);
 }finally{await runner.close();}
});

test('changed bundled scripts or requirements require an explicit companion restart',async()=>{
 const runner=await start();try{
  await writeFile(join(runner.folder,'analysis.py'),runner.script+'\n# changed after startup\n');let response=await request(runner.info);assert.equal(response.status,409);assert.equal(response.body.code,'SCRIPT_CHANGED');assert.equal(await runner.count(),0);
  await writeFile(join(runner.folder,'analysis.py'),runner.script);await writeFile(join(runner.folder,'requirements.txt'),'changed after startup');response=await request(runner.info);assert.equal(response.status,409);assert.equal(response.body.code,'REQUIREMENTS_CHANGED');
 }finally{await runner.close();}
});

test('CLI rejects nonlocal HTTP origins, unknown host flags and timeout expansion',()=>{
 for(const flags of [['--allow-origin','http://unexpected.example'],['--host','0.0.0.0'],['--timeout','121']]){const result=spawnSync(python,[source.pathname.replace(/^\/([A-Za-z]:\/)/,'$1'),...flags],{encoding:'utf8',windowsHide:true,timeout:15000});assert.notEqual(result.status,0);assert.match(result.stderr,/error:/);}
});

test('vendored scientific Python executes through HTTP with independently expected complete precision', {skip:process.env.ACAORA_LOCAL_RUNNER_REAL!=='1'},async()=>{
 const runner=await start({timeout:60,real:true});try{const health=(await request(runner.info)).body,body=job();body.expectedEnvironment=health.environmentHash;const response=await request(runner.info,'/run',{method:'POST',body,timeoutMs:90000});assert.equal(response.status,200,JSON.stringify(response.body));const metrics=Object.fromEntries(response.body.verificationMetrics);assert.equal(metrics.n,2);assert.equal(metrics.mean,1.5);assert.equal(metrics.median,1.5);assert.ok(Math.abs(metrics.sd-Math.sqrt(.5))<1e-14);assert.equal(response.body.versions.numpy,'2.5.4');assert.equal(response.body.executionReceipt.scriptHash,hash(await readFile(new URL('../public/repro/analysis.py',import.meta.url))));}finally{await runner.close();}
});
