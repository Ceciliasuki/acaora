import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(url){url=new URL(url,import.meta.url);if(cache.has(url.href))return cache.get(url.href);let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;for(const m of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]){const target=m[1].startsWith('.')?(await load(new URL(m[1]+'.ts',url))).url:import.meta.resolve(m[1]);code=code.replace(m[0],`from '${target}'`);}code+='\n//# sourceURL='+url.href;const encoded='data:text/javascript;base64,'+Buffer.from(code).toString('base64'),value={url:encoded,exports:await import(encoded)};cache.set(url.href,value);return value;}
const {applyDataWorkflow,parseWorkflow,emptyVariable,parseDictionary}=(await load('../app/data/data-workflow.ts')).exports;
const {auditPanel}=(await load('../app/data/panel-audit.ts')).exports;
const {runAdvancedAnalysis:run}=(await load('../app/data/advanced-analysis.ts')).exports;
const {binaryMetrics}=(await load('../app/data/research-methods.ts')).exports;
const {advancedPaperCharts}=(await load('../app/data/paper-charts.ts')).exports;
const {createPaperChartSvg}=(await load('../app/data/paper-chart-svg.ts')).exports;
const {createAdvancedRecipe,parseAdvancedRecipe,mapAdvancedConfig}=(await load('../app/data/advanced-recipe.ts')).exports;
const data={name:'工作表',headers:['id','time','x','y','group'],rows:[['A','1','1','2','a'],['A','3','','4','a'],['B','1','3','6','b'],['B','1','5','8','b'],['B','2','-1','bad','b']]};
const step=(kind,column,operation,extra={})=>({kind,column,operation,output:'derived',value:'',other:'y',...extra});
test('workflow preserves source, tracks row origin and fitted parameters, supports deterministic replay and undo',()=>{
  const before=structuredClone(data),steps=[step('impute','x','mean'),step('derive','x','zscore'),step('filter','time','gt',{value:'1'})],w=applyDataWorkflow(data,steps);
  assert.deepEqual(data,before);assert.equal(w.records[0].parameters.fill,2);assert.deepEqual(w.sourceRows,[2,5]);assert.equal(w.fittedColumns.includes('x'),true);assert.equal(w.fittedColumns.includes('derived'),true);assert.equal(w.fittedSelection,false);assert.deepEqual(applyDataWorkflow(data,steps),w);assert.equal(applyDataWorkflow(data,steps.slice(0,-1)).data.rows.length,5);
  assert.equal(applyDataWorkflow(data,[...steps,step('filter','derived','present')]).fittedSelection,true);assert.deepEqual(applyDataWorkflow(data,[]).data,data);
});
test('workflow handles domain/missing arithmetic and exact text recodes, blocks invalid transformations',()=>{
  const w=applyDataWorkflow(data,[step('derive','x','log'),step('recode','group','mapping',{output:'code',mapping:{a:'甲',b:'乙'}})]);assert.equal(w.data.rows[4][5],'');assert.equal(w.data.rows[1][5],'');assert.equal(w.data.rows[0][6],'甲');
  assert.throws(()=>applyDataWorkflow(data,[step('derive','x','square',{output:'x'})]),/覆盖/);assert.throws(()=>applyDataWorkflow(data,[step('filter','x','gt',{value:'999'})]),/全部/);assert.throws(()=>applyDataWorkflow(data,[step('impute','x','constant',{value:'NA'})]),/常量/);
});
test('workflow and variable dictionary imports validate strict shapes, names and duplicate metadata',()=>{
  const recipe={format:'acaora-data-workflow',version:1,sourceFingerprint:'a'.repeat(64),steps:[step('filter','time','present')]};assert.deepEqual(parseWorkflow(JSON.stringify(recipe)),recipe);assert.throws(()=>parseWorkflow(JSON.stringify({...recipe,unknown:true})));
  const variables=[{...emptyVariable('x'),source:'统计年鉴',unit:'万元',definition:'原始口径'}],dictionary={format:'acaora-data-dictionary',version:1,variables};assert.deepEqual(parseDictionary(JSON.stringify(dictionary),data.headers),variables);assert.throws(()=>parseDictionary(JSON.stringify({...dictionary,variables:[...variables,...variables]}),data.headers));assert.throws(()=>parseDictionary(JSON.stringify(dictionary),['unknown']));
});
test('panel audit reports duplicate keys, gaps, balance, numeric time equivalence and within-subject constants without deleting',()=>{
  const before=structuredClone(data),audit=auditPanel(data,'id','time',1,['x']);assert.equal(audit.valid,5);assert.equal(audit.duplicateExtraRows,1);assert.equal(audit.duplicates[0].entity,'B');assert.deepEqual(audit.duplicates[0].rows,[3,4]);assert.equal(audit.subjects[0].gaps,1);assert.equal(audit.balanced,false);assert.equal(audit.constant[0].invariant,1);assert.deepEqual(data,before);
  const balanced={name:'b',headers:['id','t'],rows:[['A','01'],['A','2'],['B','1'],['B','2']]};assert.equal(auditPanel(balanced,'id','t',1,[]).balanced,true);balanced.rows.push(['','bad']);const report=auditPanel(balanced,'id','t',1,[]);assert.equal(report.missingEntity,1);assert.equal(report.invalidTime,0);
});
test('binary evaluation aggregates tied probabilities and uses AP steps, confusion thresholds and Brier correctly',()=>{
  const m=binaryMetrics([0,1,0,1],[.5,.5,.2,.8],.5);assert.equal(m.auc,.875);assert.ok(Math.abs(m.ap-5/6)<1e-14);assert.equal(m.tp,2);assert.equal(m.fp,1);assert.equal(m.tn,1);assert.equal(m.fn,0);assert.ok(Math.abs(m.brier-.145)<1e-14);assert.equal(m.roc.length,4);assert.equal(m.calibration.reduce((s,r)=>s+r[2],0),4);assert.throws(()=>binaryMetrics([1,1],[.2,.3],.5));assert.throws(()=>binaryMetrics([0,1],[NaN,.3],.5));
});
const fixture=JSON.parse(await readFile(new URL('./fixtures/research-output-reference.json',import.meta.url),'utf8')).data;
const config=method=>({method,outcome:method==='classification'?'binary':'y',predictors:['x'],group:'entity',second:'x',components:2,clusters:3,folds:3,seed:42,validation:'random',time:'time',threshold:.45,bootstrapIterations:100});
for(const validation of ['random','group','time'])test(`classification ${validation} produces only held predictions and full exportable curves`,()=>{
  const c={...config('classification'),validation},fit=run(fixture,c),pred=fit.tables.find(t=>t.observationLevel),n=pred.rows.filter(r=>r[3]!==null).length;assert.equal(fit.metrics[0][1],n);if(validation==='time')assert.ok(n<fit.n);const graphs=advancedPaperCharts(fit);assert.equal(graphs.length,3);for(const spec of graphs)assert.match(createPaperChartSvg(spec,{...spec,width:1200}),/<path/);if(validation==='group')assert.ok(fit.tables.find(t=>t.title==='主体隔离检查').rows.every(r=>r[3]===0));
});
test('classification rejects unseen categories, one-class outcomes and unstable folds',()=>{
  const copy=structuredClone(fixture);copy.rows.forEach(r=>{if(Number(r[5])>=45)r[3]='held-only';});assert.throws(()=>run(copy,{...config('classification'),validation:'time',categoricals:[{name:'kind',reference:'对照组'}]}),/第.*折失败/);assert.throws(()=>run({...fixture,rows:fixture.rows.map(r=>r.map((v,i)=>i===2?'1':v))},config('classification')),/两类/);
});
for(const statistic of ['mean','paired-difference','correlation'])test(`Bootstrap ${statistic} row/subject draws are deterministic and preserve entire subjects`,()=>{
  for(const unit of ['row','cluster']){const c={...config('bootstrap'),bootstrapStatistic:statistic,bootstrapUnit:unit,bootstrapCluster:'entity'},a=run(fixture,c),b=run(fixture,c);assert.deepEqual(a,b);assert.equal(a.tables[0].rows.length,100);assert.ok(a.metrics.find(v=>v[0]==='百分位 95% 下限')[1]<=a.metrics.find(v=>v[0]==='百分位 95% 上限')[1]);if(unit==='cluster')assert.ok(a.tables[0].rows.every(r=>r[2]%3===0));}
});
test('new strict recipes keep bootstrap sampling IDs mapped, reject invalid thresholds and preserve v3 compatibility',()=>{
  const c={...config('bootstrap'),bootstrapUnit:'cluster',bootstrapCluster:'entity'},recipe=createAdvancedRecipe(fixture,c,'a'.repeat(64));assert.equal(mapAdvancedConfig(recipe.config,{entity:'subject'}).bootstrapCluster,'subject');assert.throws(()=>parseAdvancedRecipe(JSON.stringify({...recipe,config:{...c,threshold:2}})));const legacy={...createAdvancedRecipe(fixture,{...config('cv')},'a'.repeat(64)),engine:'acaora-advanced-v3'};assert.doesNotThrow(()=>parseAdvancedRecipe(JSON.stringify(legacy)));assert.throws(()=>parseAdvancedRecipe(JSON.stringify({...recipe,engine:'acaora-advanced-v3'})));
});
test('bootstrap blocks insufficient groups and unbounded work',()=>{
  assert.throws(()=>run(fixture,{...config('bootstrap'),bootstrapStatistic:'difference',group:'entity'}),/两个/);assert.throws(()=>run(fixture,{...config('bootstrap'),bootstrapIterations:5000}),/重复/);
});
