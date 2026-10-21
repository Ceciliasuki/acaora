import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(url){url=new URL(url,import.meta.url);if(cache.has(url.href))return cache.get(url.href);let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;for(const m of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]){const target=m[1].startsWith('.')?(await load(new URL(m[1]+'.ts',url))).url:import.meta.resolve(m[1]);code=code.replace(m[0],`from '${target}'`);}const encoded='data:text/javascript;base64,'+Buffer.from(code).toString('base64'),value={url:encoded,exports:await import(encoded)};cache.set(url.href,value);return value;}
const {runAdvancedAnalysis:run}=(await load('../app/data/advanced-analysis.ts')).exports;
const {inspectAdvancedData:inspect}=(await load('../app/data/advanced-check.ts')).exports;
const {completeRows}=(await load('../app/data/advanced-math.ts')).exports;
const {validationSplits}=(await load('../app/data/advanced-learning.ts')).exports;
const {createAdvancedRecipe,parseAdvancedRecipe,mapAdvancedConfig,advancedMappingErrors}=(await load('../app/data/advanced-recipe.ts')).exports;
const {fingerprintDataset}=(await load('../app/data/analysis-recipe.ts')).exports;
const ref=JSON.parse(await readFile(new URL('./fixtures/advanced-feasibility-reference.json',import.meta.url),'utf8')),data=ref.data;
const c=(method='cv')=>({method,outcome:'y',predictors:['x1','x2'],group:'entity',second:'after',components:2,clusters:3,folds:5,seed:42,validation:'random',time:'time'});
const close=(a,b)=>{assert.equal(typeof a,'number');assert.ok(Number.isFinite(a));assert.ok(Math.abs(a-b)<2e-8*(1+Math.abs(b)),`${a} != ${b}`);};
const metric=(r,k)=>r.metrics.find(([key])=>key===k)[1];
test('Welch ANOVA matches both SciPy and statsmodels for unequal group sizes and variances',()=>{
  const e=ref.expected.welchanova,r=run(e.data,{...c('welchanova'),outcome:'value',group:'group'});close(metric(r,'Welch F'),e.f);close(metric(r,'p'),e.p);close(metric(r,'分子自由度'),e.df[0]);close(metric(r,'分母自由度'),e.df[1]);
  const invalid=structuredClone(e.data);invalid.rows.filter(r=>r[1]==='A').forEach(r=>{r[0]='1';});assert.throws(()=>run(invalid,{...c('welchanova'),outcome:'value',group:'group'}),/正且有限/);
});
for(const mode of ['group','time'])test(`${mode} validation matches every independent NumPy prediction, baseline, fold and aggregate`,()=>{
  const config={...c(),validation:mode},r=run(data,config),e=ref.expected[mode];
  r.tables[1].rows.forEach((row,i)=>{assert.equal(row[1],e.folds[i]<0?null:e.folds[i]+1);if(e.predictions[i]===null){assert.equal(row[3],null);assert.equal(row[4],null);assert.equal(row[5],null);}else{close(row[3],e.predictions[i]);close(row[5],e.baselines[i]);}});
  r.tables[0].rows.forEach((row,i)=>row.forEach((v,j)=>close(v,e.fold_metrics[i][j])));assert.equal(metric(r,'折外评估 N'),e.evaluated);close(metric(r,'折外 RMSE'),e.rmse);close(metric(r,'折外 MAE'),e.mae);close(metric(r,'折外整体 R²'),e.r2);
});
test('split invariants isolate all subjects and keep equal timestamps together with strict past-only training',()=>{
  for(const mode of ['group','time']){
    const config={...c(),validation:mode},rows=completeRows(data,config),{folds,splits}=validationSplits(rows,config);
    for(const {train,held} of splits){
      if(mode==='group'){const subjects=new Set(train.map(i=>rows[i].group));assert.ok(held.every(i=>!subjects.has(rows[i].group)));}
      else assert.ok(Math.max(...train.map(i=>rows[i].values.time))<Math.min(...held.map(i=>rows[i].values.time)));
    }
    if(mode==='time'){const byTime=new Map();rows.forEach((r,i)=>{if(byTime.has(r.values.time))assert.equal(folds[i],byTime.get(r.values.time));else byTime.set(r.values.time,folds[i]);});}
  }
});
test('a held-out subjects outcomes cannot affect predictions within that subjects validation fold',()=>{
  const config={...c(),validation:'group'},base=run(data,config),copy=structuredClone(data),subject=copy.rows[0][7];copy.rows.forEach(row=>{if(row[7]===subject)row[3]=String(Number(row[3])+1000);});const changed=run(copy,config),fold=base.tables[1].rows[0][1];base.tables[1].rows.forEach((row,i)=>{if(row[1]===fold)close(changed.tables[1].rows[i][3],row[3]);});
});
test('future target changes cannot affect predictions of earlier validation blocks',()=>{
  const config={...c(),validation:'time'},base=run(data,config),copy=structuredClone(data);copy.rows.forEach(row=>{if(Number(row.at(-1))>=2030)row[3]=String(Number(row[3])+1000);});const changed=run(copy,config);base.tables[1].rows.forEach((row,i)=>{if(row[3]!==null)close(changed.tables[1].rows[i][3],row[3]);});
});
test('insufficient subjects, timestamps and per-fold training sizes fail explicitly',()=>{
  assert.throws(()=>run(data,{...c(),validation:'group',group:'group2'}),/主体数少于折数/);
  assert.throws(()=>run(data,{...c(),validation:'time',time:'binary'}),/不同数值时间点/);
  const small={name:'small',headers:['x1','x2','y','time'],rows:[[1,2,2,1],[2,3,3,2],[3,5,2,3],[4,3,5,4],[5,4,3,5],[6,1,7,6]].map(r=>r.map(String))};assert.throws(()=>run(small,{...c(),validation:'time'}),/训练集仅/);
});
test('preflight reports exact union of excluded rows, per-column reasons and preserves the input',()=>{
  const copy=structuredClone(data);copy.rows[0][0]='';copy.rows[0][3]='NA';copy.rows[1][0]='bad';copy.rows[2][7]='';copy.rows[3][2]='';const before=structuredClone(copy),r=inspect(copy,c('cluster'));
  assert.equal(r.complete,93);assert.equal(r.excluded,3);assert.deepEqual(r.columns.find(c=>c.name==='x1'),{name:'x1',missing:1,invalid:1});assert.deepEqual(r.columns.find(c=>c.name==='y'),{name:'y',missing:1,invalid:0});assert.deepEqual(copy,before);assert.equal(r.errors.length,0);
});
test('preflight distinguishes unsupported coding, invariant within predictors and valid constant marginal pairs',()=>{
  assert.ok(inspect(data,c('logistic')).errors.some(e=>e.includes('0 与 1')));
  const copy=structuredClone(data);copy.rows.forEach(r=>{r[0]=r[7].slice(1);});assert.ok(inspect(copy,c('fixed')).errors.some(e=>e.includes('主体内部没有变动')));
  const paired={name:'paired',headers:['before','after'],rows:[['2','1'],['2','3'],['2','4'],['2','6']]};assert.deepEqual(inspect(paired,{...c('paired'),outcome:'before',second:'after'}).errors,[]);
});
test('advanced recipes round trip all needed roles and strict current engine without raw data',async()=>{
  const config={...c(),validation:'time'},hash=await fingerprintDataset(data),recipe=createAdvancedRecipe(data,config,hash),parsed=parseAdvancedRecipe(JSON.stringify(recipe));assert.deepEqual(parsed.config,config);assert.equal(parsed.dataset.fingerprint,hash);assert.equal(parsed.dataset.rows,96);assert.equal(parsed.data,undefined);
  const renamed={...data,headers:data.headers.map(h=>h==='x1'?'u':h==='time'?'period':h==='y'?'target':h)},mapped=mapAdvancedConfig(config,{x1:'u',time:'period',y:'target'});assert.deepEqual(advancedMappingErrors(renamed,mapped),[]);assert.notEqual(await fingerprintDataset(renamed),hash);assert.equal(mapped.time,'period');
  for(const mutate of [r=>{r.extra='code';},r=>{r.engine='acaora-advanced-v1';},r=>{r.config.predictors=['x1','x1'];},r=>{r.config.folds=200;},r=>{r.config.exec='alert(1)';},r=>{r.dataset.fingerprint='no';},r=>{r.dataset.rows=[];},r=>{r.config.time='x1';}]){const bad=structuredClone(recipe);mutate(bad);assert.throws(()=>parseAdvancedRecipe(JSON.stringify(bad)));}
  assert.throws(()=>parseAdvancedRecipe(' '.repeat(256*1024+1)));assert.throws(()=>parseAdvancedRecipe('{no}'));
});
test('mapping collisions, nonnumeric model fields and unknown names prevent application',()=>{
  assert.ok(advancedMappingErrors(data,mapAdvancedConfig(c(),{y:'x1'})).length>0);assert.ok(advancedMappingErrors(data,mapAdvancedConfig(c(),{y:'entity'})).length>0);assert.ok(advancedMappingErrors(data,mapAdvancedConfig(c(),{y:'missing'})).length>0);
});
