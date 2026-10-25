import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(url){if(cache.has(url.href))return cache.get(url.href);let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;for(const match of [...code.matchAll(/(?:from|export\s+\*)\s+['"]([^'"]+)['"]/g)]){const specifier=match[1],target=specifier.startsWith('.')?(await load(new URL(`${specifier}.ts`,url))).url:import.meta.resolve(specifier);code=code.replace(match[0],match[0].replace(specifier,target));}const encoded=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`,loaded={url:encoded,exports:await import(encoded)};cache.set(url.href,loaded);return loaded;}
const c=(await load(new URL('../app/lib/research-connections.ts',import.meta.url))).exports,l=(await load(new URL('../app/lib/research-ledger.ts',import.meta.url))).exports,v=(await load(new URL('../app/lib/research-verification.ts',import.meta.url))).exports,execute=(await load(new URL('../app/data/research-execution.ts',import.meta.url))).exports.executeResearchAnalysis;
const owner='10000000-0000-4000-8000-000000000001',projectId='20000000-0000-4000-8000-000000000001',datasetId='30000000-0000-4000-8000-000000000001',specId='30000000-0000-4000-8000-000000000002',runId='30000000-0000-4000-8000-000000000003',now='2026-10-25T05:00:00.000Z',hash='a'.repeat(64);
const project={id:projectId,title:'Controlled study',updated_at:now,metadata:{}};
const event=(kind,id,payload,revision=1,sequence=1)=>({id:crypto.randomUUID(),sequence,project_id:projectId,user_id:owner,collection:kind,entity_id:id,revision,payload,archived:false,created_at:now,origin:null});
const dictionary=[{name:'x',label:'Exposure',unit:'hour',definition:'Self report',source:'Survey',citation:'',period:'2025',kind:'numeric'}];
const dataset={name:'Original',source:'Archive',url:'',accessedAt:now,license:'',coverage:'',unit:'person',notes:'',sourceFingerprint:hash,versions:[],dictionary};
const specification={name:'Main',role:'primary',protocolId:'',purpose:'Predeclared comparison',sourceFingerprint:hash,analysis:{kind:'basic',config:{method:'describe',x:'x',y:'',group:'',value:''}},steps:[]};
test('source metadata labels do not invalidate values, but dictionary definitions and actual specifications do',async()=>{
 const original=[event('dataset',datasetId,dataset),event('specification',specId,specification)],refs=await c.projectReferences(project,original),dependency={name:'Main output',target:{kind:'run',id:runId},sources:refs.filter(ref=>ref.kind==='dataset'||ref.kind==='dictionary'||ref.kind==='specification'),note:'',confirmedAt:now};
 const renamed=await c.projectReferences(project,[event('dataset',datasetId,{...dataset,name:'A new display label',notes:'Administrative note'},2),original[1]]);assert.equal(c.assessConnections([dependency],renamed)[0].status,'current');
 const changed=await c.projectReferences(project,[event('dataset',datasetId,{...dataset,dictionary:[{...dictionary[0],definition:'Device measurement'}]},2),original[1]]);assert.equal(c.assessConnections([dependency],changed)[0].status,'stale');
 const newSpec=await c.projectReferences(project,[original[0],event('specification',specId,{...specification,analysis:{...specification.analysis,config:{...specification.analysis.config,x:'another'}}},2)]);assert.match(c.assessConnections([dependency],newSpec)[0].reasons.join(' '),/Main/);
});
test('upstream changes propagate into fixed writing; missing sources and cycles never appear current',async()=>{
 const runRef={kind:'run',id:runId,label:'Main output',revision:1,fingerprint:hash},dataRef={kind:'dataset',id:datasetId,label:'Data',revision:1,fingerprint:hash},binding={name:'Model',target:{kind:'run',id:runId},sources:[dataRef],note:'',confirmedAt:now},block={id:'writing',title:'Result',lead:'',conclusion:'',runId,metrics:[{key:'p',label:'p',decimals:3,unit:'',value:'0.0000002'}],references:[runRef],citations:[],confirmedAt:now};
 const states=c.assessConnections([binding],[runRef,{...dataRef,fingerprint:'b'.repeat(64)}],[block]);assert.equal(states.find(s=>s.key==='writing:writing').status,'stale');assert.equal(block.metrics[0].value,'0.0000002');assert.equal(c.renderResultBlock(block),'p <0.001');assert.equal(c.assessConnections([binding],[runRef])[0].status,'missing');
 const cyclic=[binding,{...binding,target:{kind:'dataset',id:datasetId},sources:[runRef]}];assert.ok(c.assessConnections(cyclic,[runRef,dataRef]).every(s=>s.status==='stale'));
});
test('automatic run dependencies preserve the configuration actually executed',async()=>{
 const first=event('specification',specId,specification,1,1),run=event('run',runId,{name:'Main run',specificationId:specId,protocolId:'',sourceFingerprint:hash,dataFingerprint:hash,settings:JSON.stringify({specRevision:1})},1,2),second=event('specification',specId,{...specification,purpose:'Revised interpretation'},2,3);
 const automatic=await c.automaticDependencies(project,[first,run,second]),refs=await c.projectReferences(project,[first,run,second]);assert.equal(automatic[0].sources.find(ref=>ref.kind==='specification').revision,1);assert.equal(c.assessConnections(automatic,refs).find(s=>s.key===`run:${runId}`).status,'stale');
});
test('paired t external mapping covers every full-precision baseline metric against independent scipy reference',async()=>{
 const ref=JSON.parse(await readFile(new URL('./fixtures/advanced-reference.json',import.meta.url),'utf8')),analysis={kind:'advanced',config:{method:'paired',outcome:'before',predictors:['x1','x2'],group:'entity',second:'after',components:2,clusters:3,folds:5,seed:42}},baseline=execute(ref.data,analysis),e=ref.expected.paired;
 const n=baseline.metrics.find(([key])=>key==='n')[1],output={n,excluded:0,estimate:e.mean,se:e.mean/e.t,t:e.t,p:e.p,df:n-1,low:e.ci[0],high:e.ci[1]},external=v.externalExecutionMetrics(output,analysis);assert.equal(external.length,baseline.metrics.length);for(const [key,value] of baseline.metrics){const actual=external.find(([name])=>name===key)?.[1];assert.ok(Math.abs(actual-value)<=1e-7*(1+Math.abs(value)),`${key}: ${actual} != ${value}`);}
 assert.equal(v.externalExecutionMetrics({...output,verificationMetrics:[['n','not-number']]},analysis),null);
});
test('new records reject coerced phases, forged power results and missing family results',()=>{
 const family={name:'Two hypotheses',method:'holm',phase:'planned',protocolId:'',hypotheses:[{id:'h1',label:'Effect',runId:'',metric:'',p:null,adjusted:null}],notes:''};assert.equal(l.validateLedgerPayload('family',family),true);assert.equal(l.validateLedgerPayload('family',{...family,phase:['planned']}),false);assert.equal(l.validateLedgerPayload('family',{...family,phase:'evaluated'}),false);
 const power={name:'Precision',method:'two-independent-normal',alpha:.05,effect:.5,nPerGroup:64,targetPower:.8,result:{power:1,nRequired:1,mde:0},protocolId:'',notes:''};assert.equal(l.validateLedgerPayload('power',power),false);
});
