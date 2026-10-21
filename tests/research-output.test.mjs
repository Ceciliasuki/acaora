import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(url){url=new URL(url,import.meta.url);if(cache.has(url.href))return cache.get(url.href);let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;for(const m of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]){const target=m[1].startsWith('.')?(await load(new URL(m[1]+'.ts',url))).url:import.meta.resolve(m[1]);code=code.replace(m[0],`from '${target}'`);}code+='\n//# sourceURL='+url.href;const encoded='data:text/javascript;base64,'+Buffer.from(code).toString('base64'),value={url:encoded,exports:await import(encoded)};cache.set(url.href,value);return value;}
const {fitMultipleRegression:ols}=(await load('../app/data/multiple-regression.ts')).exports;
const {runAdvancedAnalysis:run}=(await load('../app/data/advanced-analysis.ts')).exports;
const {holmAdjust}=(await load('../app/data/posthoc.ts')).exports;
const {createAdvancedRecipe,parseAdvancedRecipe,mapAdvancedConfig}=(await load('../app/data/advanced-recipe.ts')).exports;
const {createRegressionRecipe,parseRegressionRecipe}=(await load('../app/data/regression-config.ts')).exports;
const {createPaperChartSvg}=(await load('../app/data/paper-chart-svg.ts')).exports;
const {regressionPaperChart,advancedPaperChart}=(await load('../app/data/paper-charts.ts')).exports;
const ref=JSON.parse(await readFile(new URL('./fixtures/research-output-reference.json',import.meta.url),'utf8')),data=ref.data,cats=[{name:'kind',reference:ref.levels[0]}];
const config=method=>({method,outcome:'y',predictors:['x'],categoricals:cats,group:'entity',second:'x',components:2,clusters:3,folds:5,seed:42,validation:'random',time:'time'});
const linear=(standardErrors='classical',categoricals=cats)=>({outcome:'y',predictors:['x'],categoricals,standardErrors});
const close=(a,b)=>{assert.equal(typeof a,'number');assert.ok(Number.isFinite(a));assert.ok(Math.abs(a-b)<2e-8*(1+Math.abs(b)),`${a} != ${b}`);};
const vector=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>close(v,b[i]));};
for(const method of ['classical','HC3'])test(`categorical OLS ${method} matches independent statsmodels coefficients and every inference column`,()=>{
  const fit=ols(data,linear(method)),expected=ref.expected[method==='classical'?'ols':'HC3'];fit.coefficients.forEach((row,j)=>vector([row.estimate,row.se,row.t,row.p,row.low,row.high],expected[j]));assert.equal(fit.encoding.columns.length,2);assert.equal(fit.n,150);assert.match(fit.coefficients[2].name,/vs 对照组/);
});
for(const method of ['cluster','fixed','logistic'])test(`categorical ${method} matches independent statsmodels with explicit reference`,()=>{
  const c=config(method);if(method==='logistic')c.outcome='binary';const fit=run(data,c),expected=ref.expected[method];fit.tables[0].rows.forEach((row,j)=>vector(row.slice(1,7),expected[j]));assert.equal(fit.tables.at(-1).title,'分类编码与参考组');assert.equal(fit.config.categoricals[0].reference,'对照组');assert.ok(!JSON.stringify(fit.tables[0]).includes('__acaora_category_'));
});
test('changing the reference preserves fitted outcomes and matches separately refitted reference coefficients',()=>{
  const base=ols(data,linear()),fit=ols(data,linear('classical',[{name:'kind',reference:ref.levels[1]}]));fit.coefficients.forEach((row,j)=>vector([row.estimate,row.se,row.t,row.p,row.low,row.high],ref.expected.reference_changed[j]));fit.observations.forEach((r,i)=>close(r.fitted,base.observations[i].fitted));
});
for(const mode of ['random','group','time'])test(`categorical ${mode} CV predictions match independent training-only schemas and NumPy fits`,()=>{
  const fit=run(data,{...config('cv'),validation:mode}),expected=ref.expected.cv[mode];fit.tables[1].rows.forEach((row,i)=>{if(expected[i]===null)assert.equal(row[3],null);else close(row[3],expected[i]);});assert.equal(fit.tables.at(-1).title,'逐折分类编码');
});
test('unseen validation levels and missing training references fail instead of leaking a global schema',()=>{
  const copy=structuredClone(data);copy.rows.forEach(row=>{if(Number(row[5])>=45)row[3]='验证集独有类别';});assert.throws(()=>run(copy,{...config('cv'),validation:'time'}),/训练集未见类别/);
  const missing=structuredClone(data);missing.rows.forEach((r,i)=>{r[3]=i<30?ref.levels[1+i%2]:ref.levels[0];});assert.throws(()=>run(missing,{...config('cv'),validation:'time'}),/参考组.*未出现/);
});
test('missing categories exclude whole rows, numeric-only and category-only models work, input is unchanged',()=>{
  const copy=structuredClone(data);copy.rows[3][3]='';const before=structuredClone(copy),fit=ols(copy,linear());assert.equal(fit.n,149);assert.equal(fit.excluded,1);assert.deepEqual(copy,before);
  const only=ols(data,{...linear(),predictors:[]});assert.equal(only.parameters,3);const advanced=run(data,{...config('cluster'),predictors:[]});assert.equal(advanced.tables[0].rows.length,3);
});
test('unsupported category cardinality, references, duplicate roles and expanded column counts fail',()=>{
  assert.throws(()=>ols(data,linear('classical',[{name:'kind',reference:'missing'}])),/参考组/);assert.throws(()=>run(data,{...config('cluster'),categoricals:[{name:'entity',reference:'E00'}]}),/不同/);
  const many={...data,rows:data.rows.map((r,i)=>r.map((v,j)=>j===3?String(i%13):v))};assert.throws(()=>ols(many,linear()),/2–12/);
  const expanded={...data,headers:[...data.headers,'other'],rows:data.rows.map((r,i)=>[...r,String(i%12)])};assert.throws(()=>ols(expanded,{...linear(),categoricals:[...cats,{name:'other',reference:'0'}]}),/超过 12/);
});
for(const family of ['all','reference'])test(`Welch pairwise ${family} family matches SciPy contrasts and statsmodels Holm values`,()=>{
  const fit=run(ref.posthoc_data,{...config('posthoc'),outcome:'value',group:'group',categoricals:[],posthocFamily:family,posthocReference:'A'}),e=ref.posthoc[family],rows=fit.tables[1].rows;
  assert.equal(rows.length,e.pairs.length);rows.forEach((row,i)=>{assert.deepEqual(row.slice(0,2),e.pairs[i]);vector(row.slice(4,9),e.values[i].slice(0,5));close(row[9],e.adjusted[i]);vector(row.slice(10,12),e.values[i].slice(5));});assert.match(fit.context,/同一比较族/);
});
test('Holm retains original ordering, monotonic adjusted probabilities, ties and invalid-family rejection',()=>{
  assert.deepEqual(holmAdjust([.04,.01,.03,.2]),[.09,.04,.09,.2]);vector(holmAdjust([0,1,.1,.1]),[0,1,.3,.3]);assert.throws(()=>holmAdjust([NaN,.05]));
  assert.throws(()=>run(ref.posthoc_data,{...config('posthoc'),outcome:'value',group:'group',categoricals:[],posthocFamily:'reference',posthocReference:'missing'}),/参考组/);
});
test('categorical references, comparison families and column mappings survive strict recipes with legacy numeric compatibility',()=>{
  const recipe=createAdvancedRecipe(data,config('cluster'),'a'.repeat(64)),parsed=parseAdvancedRecipe(JSON.stringify(recipe));assert.deepEqual(parsed.config.categoricals,cats);assert.equal(mapAdvancedConfig(parsed.config,{kind:'treatment'}).categoricals[0].name,'treatment');
  const linearRecipe=createRegressionRecipe(data,linear(),'a'.repeat(64));assert.deepEqual(parseRegressionRecipe(JSON.stringify(linearRecipe)).config.categoricals,cats);
  const oldLinear={...linearRecipe,engine:'acaora-ols-v1',config:{outcome:'y',predictors:['x'],standardErrors:'classical'}};assert.doesNotThrow(()=>parseRegressionRecipe(JSON.stringify(oldLinear)));
  const legacy={...recipe,engine:'acaora-advanced-v2',config:{...config('cluster')}};delete legacy.config.categoricals;assert.doesNotThrow(()=>parseAdvancedRecipe(JSON.stringify(legacy)));assert.throws(()=>parseAdvancedRecipe(JSON.stringify({...recipe,engine:'acaora-advanced-v2'})));
  for(const spec of [[{name:'kind',reference:'A',code:'x'}],[{name:'kind',reference:'A'},{name:'kind',reference:'B'}]])assert.throws(()=>parseAdvancedRecipe(JSON.stringify({...recipe,config:{...recipe.config,categoricals:spec}})));
});
test('paper chart adapters preserve exact coefficient intervals, eigenvalues and fold error metrics',()=>{
  const fit=ols(data,linear()),chart=regressionPaperChart(fit);chart.points.forEach((p,i)=>{close(p.value,fit.coefficients[i+1].estimate);close(p.low,fit.coefficients[i+1].low);});
  const logistic=advancedPaperChart(run(data,{...config('logistic'),outcome:'binary'}));assert.match(logistic.xLabel,/log odds/);
  const cv=run(data,config('cv')),graph=advancedPaperChart(cv);graph.points.forEach((p,i)=>{close(p.value,cv.tables[0].rows[i][3]);close(p.secondary,cv.tables[0].rows[i][4]);});assert.equal(graph.n,150);
});
test('standalone SVG escapes arbitrary labels and metadata, embeds provenance and enforces export bounds',()=>{
  const spec={...regressionPaperChart(ols(data,linear())),source:'<script>alert(1)</script> & "source"',points:[{label:'<image href="https://bad.invalid"/>',value:1.23456789012345,low:-.5,high:2.5}]},options={title:'研究 <A> & B',xLabel:'系数',yLabel:'变量',note:'注释',width:1200},svg=createPaperChartSvg(spec,options);
  assert.ok(svg.startsWith('<svg xmlns='));assert.ok(svg.includes('&lt;script&gt;'));assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('<image href='));assert.ok(svg.includes('1.23456789012345'));assert.ok(svg.includes('acaora-paper-chart-v1'));assert.ok(svg.includes('N=150'));assert.ok(!/NaN|Infinity/.test(svg));
  assert.throws(()=>createPaperChartSvg(spec,{...options,width:500}));assert.throws(()=>createPaperChartSvg({...spec,points:[{label:'bad',value:NaN}]},options));
});
test('internal encoding names never corrupt an original variable name or displayed context',()=>{
  const name='prefix__acaora_category_1__suffix',renamed={...data,headers:data.headers.map(h=>h==='x'?name:h)},c={...config('cluster'),predictors:[name]},fit=run(renamed,c);
  assert.ok(fit.context.includes(name));assert.equal(fit.tables[0].rows[1][0],name);fit.tables[0].rows.forEach((row,j)=>vector(row.slice(1,7),ref.expected.cluster[j]));
});
