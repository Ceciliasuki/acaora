import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(url){if(cache.has(url.href))return cache.get(url.href);let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;for(const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]){const specifier=match[1],target=specifier.startsWith('.')?(await load(new URL(`${specifier}.ts`,url))).url:import.meta.resolve(specifier);code=code.replace(match[0],`from '${target}'`);}const encoded=`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`,loaded={url:encoded,exports:await import(encoded)};cache.set(url.href,loaded);return loaded;}

const {assessAnalysisVerification}=(await load(new URL('../app/lib/research-readiness.ts',import.meta.url))).exports;
const {researchHash}=(await load(new URL('../app/lib/research-ledger.ts',import.meta.url))).exports;
const {defaultRegressionConfig}=(await load(new URL('../app/data/regression-config.ts',import.meta.url))).exports;
const config={method:'describe',x:'x',y:'',group:'',value:''};
const analysis={id:'analysis',name:'Main analysis',snapshotId:'snapshot',settings:JSON.stringify(config),dataset:{fingerprint:'b'.repeat(64),sourceFingerprint:'a'.repeat(64)}};
async function record(status='pass',sequence=1){return {id:`event-${sequence}`,entity_id:`verification-${sequence}`,revision:1,sequence,collection:'verification',archived:false,payload:{snapshotId:'snapshot',status,sourceFingerprint:analysis.dataset.sourceFingerprint,dataFingerprint:analysis.dataset.fingerprint,settingsHash:await researchHash({kind:'basic',config})}};}
test('unverified, failed, outdated and unknown configurations cannot appear verified',async()=>{
 assert.equal((await assessAnalysisVerification([analysis],[]))[0].verified,false);
 const passed=await record();assert.equal((await assessAnalysisVerification([analysis],[passed]))[0].verified,true);
 assert.equal((await assessAnalysisVerification([analysis],[passed,await record('fail',2)]))[0].verified,false);
 assert.equal((await assessAnalysisVerification([{...analysis,dataset:{...analysis.dataset,fingerprint:'c'.repeat(64)}}],[passed]))[0].verified,false);
 assert.equal((await assessAnalysisVerification([{...analysis,settings:'unknown'}],[passed]))[0].verified,false);
 assert.equal((await assessAnalysisVerification([analysis],[{...passed,archived:true}]))[0].verified,false);
 assert.equal((await assessAnalysisVerification([{...analysis,settings:JSON.stringify({...config,x:'other'})}],[passed]))[0].verified,false);
});
test('regression suggestions exclude named identifiers regardless of column order, without removing manual choices',()=>{
 for(const headers of [['id','x','y'],['x','y','id']]){
 const suggested=defaultRegressionConfig({name:'toy.csv',headers,rows:[['1','2','3'],['2','3','4'],['3','4','5']]});
 assert.equal(suggested.outcome,'y');assert.deepEqual(suggested.predictors,['x']);
 }
 const identifiers=defaultRegressionConfig({name:'ids.csv',headers:['id','编号'],rows:[['1','1'],['2','2']]});assert.equal(identifiers.outcome,'');assert.deepEqual(identifiers.predictors,[]);
});
