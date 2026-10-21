// Numerical bridge test: browser engine vs executed Python and base-R runtimes.
// The isolated webR copy fixes its Windows file-URL loader; application dependencies stay untouched.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import ts from 'typescript';
const cache=new Map();
async function load(url){url=new URL(url,import.meta.url);if(cache.has(url.href))return cache.get(url.href);let code=ts.transpileModule(await fs.readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;for(const m of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]){const target=m[1].startsWith('.')?(await load(new URL(m[1]+'.ts',url))).url:import.meta.resolve(m[1]);code=code.replace(m[0],`from '${target}'`);}code+='\n//# sourceURL='+url.href;const encoded='data:text/javascript;base64,'+Buffer.from(code).toString('base64'),value={url:encoded,exports:await import(encoded)};cache.set(url.href,value);return value;}
const {runAdvancedAnalysis:run}=(await load('../app/data/advanced-analysis.ts')).exports,{fitMultipleRegression:ols}=(await load('../app/data/multiple-regression.ts')).exports;
const {fingerprintDataset}=(await load('../app/data/analysis-recipe.ts')).exports;
const {regression,welchTest,summarize}=(await load('../app/stats.ts')).exports;
const ref=JSON.parse(await fs.readFile('tests/fixtures/research-output-reference.json','utf8')),data=ref.data;
const root=path.resolve('work/reproduction-reference');await fs.mkdir(root,{recursive:true});
const config=method=>({method,outcome:['logistic','classification'].includes(method)?'binary':'y',predictors:['x'],group:'entity',second:'x',components:2,clusters:3,folds:3,seed:42,validation:'random',time:'time',threshold:.45,bootstrapIterations:100});
const cases=[];
for(const standardErrors of ['classical','HC3'])cases.push({id:'ols-'+standardErrors,data,analysis:{kind:'ols',config:{outcome:'y',predictors:['x'],categoricals:[{name:'kind',reference:'对照组'}],standardErrors}}});
for(const method of ['logistic','cluster','fixed','paired','wilcoxon','anova','welchanova','posthoc','mannwhitney','pca','kmeans','cv','classification','bootstrap']){
  const c=config(method);let source=data;
  if(['logistic','cluster','fixed'].includes(method))c.categoricals=[{name:'kind',reference:'对照组'}];
  if(['anova','welchanova','posthoc','mannwhitney'].includes(method)){source=method==='mannwhitney'?{...ref.posthoc_data,rows:ref.posthoc_data.rows.filter(r=>['A','B'].includes(r[1]))}:ref.posthoc_data;c.outcome='value';c.group='group';}
  if(['pca','kmeans'].includes(method))c.predictors=['x','y'];
  cases.push({id:method,data:source,analysis:{kind:'advanced',config:c}});
}
for(const validation of ['group','time'])for(const method of ['cv','classification'])cases.push({id:method+'-'+validation,data,analysis:{kind:'advanced',config:{...config(method),validation,categoricals:[{name:'kind',reference:'对照组'}]}}});
for(const statistic of ['mean','paired-difference','correlation','difference'])for(const unit of ['row','cluster']){const source={...data,headers:[...data.headers,'two'],rows:data.rows.map(r=>[...r,Number(r[0])<0?'A':Number(r[5])%2?'A':'B'])};cases.push({id:'bootstrap-'+statistic+'-'+unit,data:source,analysis:{kind:'advanced',config:{...config('bootstrap'),bootstrapStatistic:statistic,bootstrapUnit:unit,bootstrapCluster:'entity',group:'two'}}});}
for(const method of ['describe','relation','test'])cases.push({id:'basic-'+method,data:method==='test'?ref.posthoc_data:data,analysis:{kind:'basic',config:{method,x:'x',y:'y',group:'group',value:'value'}}});
// Welch basic requires exactly two groups.
cases.find(v=>v.id==='basic-test').data={...ref.posthoc_data,rows:ref.posthoc_data.rows.filter(r=>['A','B'].includes(r[1]))};
await fs.writeFile(path.join(root,'cases.json'),JSON.stringify(cases));
const pythonScript=`import importlib.util,json,pathlib\np=pathlib.Path('public/repro/analysis.py').resolve()\ns=importlib.util.spec_from_file_location('repro',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\ncases=json.loads(pathlib.Path('work/reproduction-reference/cases.json').read_text(encoding='utf-8'))\nresult={}\nfor case in cases:\n result[case['id']]=m.clean(m.run(case['analysis'],case['data']))\npathlib.Path('work/reproduction-reference/python.json').write_text(json.dumps(result,ensure_ascii=False,allow_nan=False),encoding='utf-8')\n`;
await fs.writeFile(path.join(root,'check.py'),pythonScript);
execFileSync('python',[path.join(root,'check.py')],{env:{...process.env,PYTHONUTF8:'1',PYTHONPATH:path.resolve('work/regression-reference')},stdio:'pipe'});
const runtime=path.resolve('work/webr-test');await fs.cp('node_modules/webr/dist',runtime,{recursive:true});await fs.writeFile(path.join(runtime,'package.json'),' {"type":"commonjs"}');
for(const name of ['webr.mjs','webr-worker.js']){const filename=path.join(runtime,name);let s=await fs.readFile(filename,'utf8');s=s.replaceAll('await import((await import("path")).default.resolve(','await import((await import("url")).pathToFileURL((await import("path")).default.resolve(').replaceAll('.resolve(e))}', '.resolve(e)).href)}').replaceAll('.resolve(r))}', '.resolve(r)).href)}');await fs.writeFile(filename,s);}
const {WebR}=await import(pathToFileURL(path.join(runtime,'webr.mjs')).href),r=new WebR({baseUrl:runtime+path.sep});
try{
  await r.init();await r.installPackages(['jsonlite','digest']);await r.FS.writeFile('/home/web_user/analysis.R',new Uint8Array(await fs.readFile('public/repro/analysis.R')));await r.FS.writeFile('/home/web_user/cases.json',new Uint8Array(await fs.readFile(path.join(root,'cases.json'))));
  await r.evalRVoid('Sys.setenv(ACAORA_REPRO_TEST="1");source("analysis.R");cases <- fromJSON("cases.json",simplifyVector=FALSE);results <- list();for(case in cases){tryCatch({results[[case$id]] <- run_analysis(case$analysis,case$data)},error=function(e)stop(paste(case$id,e$message)))};write_json(results,"r.json",auto_unbox=TRUE,digits=NA,na="null",null="null")');
  await fs.writeFile(path.join(root,'r.json'),await r.FS.readFile('/home/web_user/r.json'));
  // Exercise the actual standalone entry points, including exact-byte hash verification.
  const item=cases.find(v=>v.id==='classification-group'),raw=JSON.stringify({headers:item.data.headers,rows:item.data.rows}),manifest={analysis:item.analysis,dataset:{fingerprint:await fingerprintDataset(item.data)}};
  await r.FS.writeFile('/home/web_user/analysis-data.json',new TextEncoder().encode(raw));await r.FS.writeFile('/home/web_user/manifest.json',new TextEncoder().encode(JSON.stringify(manifest)));await r.evalRVoid('main()');await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest));await fs.writeFile(path.join(root,'analysis-data.json'),raw);await fs.copyFile('public/repro/analysis.py',path.join(root,'analysis.py'));execFileSync('python',[path.join(root,'analysis.py')],{env:{...process.env,PYTHONUTF8:'1',PYTHONPATH:path.resolve('work/regression-reference')},stdio:'pipe'});
}finally{r.close();}
const python=JSON.parse(await fs.readFile(path.join(root,'python.json'),'utf8')),R=JSON.parse(await fs.readFile(path.join(root,'r.json'),'utf8'));
function close(a,b,label){if(a===null||b===null){assert.equal(a,b,label);return;}assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=3e-6*(1+Math.abs(b)),`${label}: ${a} != ${b}`);}
function vector(a,b,label){if(!Array.isArray(a))a=[a];assert.equal(a.length,b.length,label);a.forEach((v,i)=>close(v,b[i],label+' '+i));}
for(const item of cases){
  const c=item.analysis.config,m=c.method,kind=item.analysis.kind;let fit;if(kind==='ols')fit=ols(item.data,c);else if(kind==='advanced')fit=run(item.data,c);
  for(const [language,outputs] of [['Python',python],['R',R]]){
    const out=outputs[item.id],label=language+' '+item.id;
    if(kind==='ols'){vector(out.coefficients,fit.coefficients.map(v=>v.estimate),label);vector(out.se,fit.coefficients.map(v=>v.se),label+' SE');vector(out.p,fit.coefficients.map(v=>v.p),label+' p');}
    else if(kind==='basic'){
      if(m==='describe'){const s=summarize(item.data,c.x);close(out.mean,s.mean,label);close(out.sd,s.sd,label);}
      if(m==='relation'){const s=regression(item.data,c.x,c.y);close(out.r,s.r,label);close(out.coefficients[1],s.slope,label);close(out.p,s.p,label);}
      if(m==='test'){const s=welchTest(item.data,c.group,c.value);close(out.t,s.t,label);close(out.p,s.p,label);}
    }else if(['logistic','cluster','fixed'].includes(m)){vector(out.coefficients,fit.tables[0].rows.map(r=>r[1]),label);vector(out.se,fit.tables[0].rows.map(r=>r[2]),label+' SE');vector(out.p,fit.tables[0].rows.map(r=>r[4]),label+' p');}
    else if(m==='pca')vector(out.eigenvalues,fit.tables[0].rows.map(r=>r[1]),label);
    else if(m==='kmeans'){close(out.inertia,fit.metrics[1][1],label);vector(out.labels,fit.tables.find(t=>t.observationLevel).rows.map(r=>r[1]),label);}
    else if(m==='cv'||m==='classification'){
      vector(out.predictions,fit.tables.find(t=>t.observationLevel).rows.map(r=>r[3]),label);
      if(m==='classification')for(const [key,index] of [['auc',2],['ap',3],['brier',4],['logloss',5]])close(out[key],fit.metrics[index][1],label+' '+key);
      else close(out.rmse,fit.metrics[2][1],label);
    }else if(m==='bootstrap'){
      for(const [key,index] of [['estimate',0],['se',1],['low',2],['high',3]])close(out[key],fit.metrics[index][1],label+' '+key);
      vector(out.replicates.map(r=>r[0]),fit.tables[0].rows.map(r=>r[1]),label+' draws');
    }else if(m==='posthoc')vector(out.contrasts.map(v=>v.holm_p),fit.tables[1].rows.map(r=>r[9]),label);
    else {const key=m==='paired'?'双侧 p':m==='wilcoxon'?'双侧近似 p':m==='mannwhitney'?'双侧近似 p':'p';close(out.p,fit.metrics.find(v=>v[0]===key)?.[1],label);}
  }
  console.log('PASS',item.id);
}
console.log(`${cases.length} configurations reproduced by both Python and R; files: work/reproduction-reference`);
