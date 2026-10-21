import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(url){
  url=new URL(url,import.meta.url);if(cache.has(url.href))return cache.get(url.href);
  let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]){const source=match[1],target=source.startsWith('.')?(await load(new URL(source+'.ts',url))).url:import.meta.resolve(source);code=code.replace(match[0],`from '${target}'`);}
  const encoded='data:text/javascript;base64,'+Buffer.from(code).toString('base64'),value={url:encoded,exports:await import(encoded)};cache.set(url.href,value);return value;
}
const {runAdvancedAnalysis:run}=(await load('../app/data/advanced-analysis.ts')).exports;
const {normalP,shuffledFolds}=(await load('../app/data/advanced-math.ts')).exports;
const ref=JSON.parse(await readFile(new URL('./fixtures/advanced-reference.json',import.meta.url),'utf8')),data=ref.data;
const config=method=>({method,outcome:'y',predictors:['x1','x2'],group:'entity',second:'after',components:2,clusters:3,folds:5,seed:42});
const close=(a,b,tol=2e-8)=>{assert.equal(typeof a,'number');assert.ok(Number.isFinite(a));assert.ok(Math.abs(a-b)<=tol*(1+Math.abs(b)),`${a} != ${b}`);};
const vector=(a,b,tol)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i],tol));};
const metric=(r,key)=>{const m=r.metrics.find(([k])=>k===key);assert.ok(m,`Missing ${key}`);return m[1];};
for(const method of ['cluster','fixed'])test(`${method} coefficients, CR1 inference and every fitted row match statsmodels full design`,()=>{
  const result=run(data,config(method)),expected=ref.expected[method];assert.equal(result.n,96);assert.equal(metric(result,'残差自由度'),expected.df);
  result.tables[0].rows.forEach((r,j)=>vector(r.slice(1),expected.coefficients[j]));
  result.tables[1].rows.forEach((r,i)=>{close(r[3],expected.fitted[i]);close(r[4],expected.residual[i]);});
  if(method==='fixed')vector(result.tables[2].rows.map(r=>r[2]),expected.intercepts);
});
test('unpenalized Logistic inference, OR and predictions match statsmodels',()=>{
  const result=run(data,{...config('logistic'),outcome:'binary'}),expected=ref.expected.logistic;
  result.tables[0].rows.forEach((r,i)=>vector(r.slice(1),expected.coefficients[i]));vector(result.tables[1].rows.map(r=>r[2]),expected.probabilities);
  close(metric(result,'对数似然'),expected.ll);close(metric(result,'AIC'),expected.aic);close(metric(result,'McFadden 伪 R²'),expected.pseudo);
});
test('paired t mean, inference and interval match scipy',()=>{
  const result=run(data,{...config('paired'),outcome:'before'}),e=ref.expected.paired;
  close(metric(result,'平均差（第一列−第二列）'),e.mean);close(metric(result,'t'),e.t);close(metric(result,'双侧 p'),e.p);close(metric(result,'95% 下限'),e.ci[0]);close(metric(result,'95% 上限'),e.ci[1]);
});
test('one way ANOVA matches scipy f_oneway',()=>{
  const result=run(data,{...config('anova'),group:'group3'}),e=ref.expected.anova;close(metric(result,'F'),e.f);close(metric(result,'p'),e.p);
});
test('Mann Whitney ties and continuity corrected asymptotic inference match scipy',()=>{
  const result=run(data,{...config('mannwhitney'),outcome:'before',group:'group2'}),e=ref.expected.mannwhitney;close(metric(result,'第一组 U'),e.u);close(metric(result,'双侧近似 p'),e.p);
});
test('Wilcoxon zero removal, ties and continuity corrected asymptotic inference match scipy',()=>{
  const result=run(data,{...config('wilcoxon'),outcome:'before'}),e=ref.expected.wilcoxon;close(metric(result,'W（较小秩和）'),e.w);close(metric(result,'双侧近似 p'),e.p);
});
test('PCA standardized eigenvalues, canonical weights and every score match NumPy SVD',()=>{
  const result=run(data,{...config('pca'),predictors:['x1','x2','x3'],components:3}),e=ref.expected.pca;
  vector(result.tables[0].rows.map(r=>r[1]),e.eigen);result.tables[1].rows.forEach((r,i)=>vector(r.slice(1),e.weights[i]));result.tables[3].rows.forEach((r,i)=>vector(r.slice(1),e.scores[i]));
});
test('K means centers, membership and inertia match scipy Lloyd with the explicit same initializations',()=>{
  const result=run(data,{...config('kmeans'),predictors:['x1','x2','x3']}),e=ref.expected.kmeans;
  close(metric(result,'组内平方和（标准化空间）'),e.inertia);result.tables[0].rows.forEach((r,i)=>vector(r.slice(2),e.centers[i]));assert.deepEqual(result.tables[2].rows.map(r=>r[1]-1),e.labels);
  assert.deepEqual(result,run(data,{...config('kmeans'),predictors:['x1','x2','x3']}));
});
test('K fold held-out metrics and every prediction match independent training-only NumPy fits',()=>{
  const result=run(data,config('cv')),e=ref.expected.cv;assert.deepEqual(shuffledFolds(96,5,42),e.folds);
  vector(result.tables[1].rows.map(r=>r[3]),e.predictions);vector(result.tables[1].rows.map(r=>r[5]),e.baseline);result.tables[0].rows.forEach((r,i)=>vector(r,e.fold_metrics[i]));
  close(metric(result,'折外 RMSE'),e.rmse);close(metric(result,'折外 MAE'),e.mae);close(metric(result,'折外整体 R²'),e.r2);
});
test('held-out target changes cannot affect that rows fold predictions or training baseline',()=>{
  const base=run(data,config('cv')),copy=structuredClone(data);copy.rows[0][3]=String(Number(copy.rows[0][3])+10000);const changed=run(copy,config('cv')),f=base.tables[1].rows[0][1];
  base.tables[1].rows.forEach((r,i)=>{if(r[1]===f){close(changed.tables[1].rows[i][3],r[3]);close(changed.tables[1].rows[i][5],r[5]);}});
});
test('required-column listwise deletion preserves original row identifiers and unrelated missingness',()=>{
  const copy=structuredClone(data);copy.rows[0][0]='';copy.rows[1][3]='bad';copy.rows[2][9]='';const before=structuredClone(copy),result=run(copy,config('cluster'));
  assert.equal(result.n,94);assert.equal(result.excluded,2);assert.equal(result.tables[1].rows[0][0],3);assert.deepEqual(copy,before);
  const numericEntity={...data,rows:data.rows.map(r=>r.map((v,j)=>j===7?v.slice(1):v))};vector(run(numericEntity,config('fixed')).tables[0].rows[0].slice(1),ref.expected.fixed.coefficients[0]);
});
test('non 0/1 outcomes and separation fail rather than reporting Logistic certainty',()=>{
  assert.throws(()=>run(data,{...config('logistic'),outcome:'y'}),/0 与 1/);
  const separated={name:'separated',headers:['x','y'],rows:Array.from({length:30},(_,i)=>[String(i-15),String(i<15?0:1)])};assert.throws(()=>run(separated,{...config('logistic'),outcome:'y',predictors:['x']}),/分离|收敛/);
});
test('fixed effects reject invariant predictors, insufficient groups and rank deficient within variation',()=>{
  const copy=structuredClone(data);copy.rows.forEach((r,i)=>{r[0]=String(Math.floor(i/6));});assert.throws(()=>run(copy,config('fixed')),/内部没有变动/);
  copy.rows.forEach(r=>{r[7]='one';});assert.throws(()=>run(copy,config('fixed')),/至少需要 2/);
  const collinear=structuredClone(data);collinear.rows.forEach(r=>{r[1]=String(Number(r[0])*2);});assert.throws(()=>run(collinear,config('cluster')),/共线性/);
});
test('rank tests reject invalid grouping and zero variance without fabricated p values',()=>{
  assert.throws(()=>run(data,{...config('mannwhitney'),group:'group3'}),/恰好两个/);
  const constant=structuredClone(data);constant.rows.forEach(r=>{r[5]='3';r[6]='3';});
  for(const method of ['paired','wilcoxon'])assert.throws(()=>run(constant,{...config(method),outcome:'before'}),/没有变动|非零|零差/);
  assert.throws(()=>run(constant,{...config('mannwhitney'),outcome:'before',group:'group2'}),/同值/);
});
test('numeric limits, variable uniqueness and modeling parameters are enforced',()=>{
  assert.throws(()=>run(data,{...config('pca'),predictors:['x1'],components:1}),/至少 2/);
  assert.throws(()=>run(data,{...config('pca'),components:3}),/主成分数/);
  assert.throws(()=>run(data,{...config('cv'),folds:1}),/折数/);
  assert.throws(()=>run(data,{...config('kmeans'),clusters:1}),/聚类数/);
  assert.throws(()=>run(data,{...config('cv'),seed:-1}),/种子/);
  assert.throws(()=>run(data,{...config('cv'),predictors:['x1','x1']}),/不同/);
  assert.throws(()=>run({...data,rows:Array.from({length:10001},(_,i)=>data.rows[i%96])},config('kmeans')),/10,000/);
});
test('normal tail computation retains small probabilities and symmetry',()=>{close(normalP(1.959963984540054),.05,1e-12);close(normalP(8),1.244192114854348e-15,1e-25);assert.equal(normalP(-3),normalP(3));assert.equal(normalP(0),1);});
