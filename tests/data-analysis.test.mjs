import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(path){
  const url=new URL(path,import.meta.url);if(cache.has(url.href))return cache.get(url.href);
  let source=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const match of [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)])if(match[1].startsWith('.')){
    const child=new URL(match[1]+'.ts',url);const result=await load(child.href);source=source.replace(match[0],`from '${result.url}'`);
  }
  const encoded='data:text/javascript;base64,'+Buffer.from(source).toString('base64');const result={url:encoded,exports:await import(encoded)};cache.set(url.href,result);return result;
}
const stats=(await load('../app/stats.ts')).exports;
const exploration=(await load('../app/data/data-exploration.ts')).exports;
const recipes=(await load('../app/data/analysis-recipe.ts')).exports;
const dataset=(headers,rows)=>({name:'controlled.csv',headers,rows});
const close=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);

test('invalid t statistics and undefined degrees of freedom never turn into a significant p value',()=>{
  for(const [t,df] of [[NaN,3],[undefined,3],[1,0],[1,-1],[1,NaN],[1,Infinity]])assert.ok(Number.isNaN(stats.studentTPValue(t,df)));
  assert.equal(stats.formatP(stats.studentTPValue(NaN,3)),'—');
  assert.equal(stats.studentTPValue(Infinity,10),0);assert.equal(stats.studentTPValue(-Infinity,10),0);
});
test('t probabilities agree with independent closed form distributions',()=>{
  for(const t of [0,.1,1,2,10]){
    close(stats.studentTPValue(t,1),1-2*Math.atan(t)/Math.PI);
    close(stats.studentTPValue(t,2),1-t/Math.sqrt(t*t+2));
    close(stats.studentTPValue(t,3),1-2/Math.PI*(Math.atan(t/Math.sqrt(3))+Math.sqrt(3)*t/(t*t+3)));
    close(stats.studentTPValue(-t,3),stats.studentTPValue(t,3));
  }
});
test('constant variables, too few pairs and zero standard error return unavailable analyses',()=>{
  for(const rows of [[['1','2'],['1','3'],['1','4']],[['1','2'],['2','2'],['3','2']],[['1','2'],['2','4']]])assert.equal(stats.regression(dataset(['x','y'],rows),'x','y'),null);
  const rows=[['A','2'],['A','2'],['B','2'],['B','2']];assert.equal(stats.welchTest(dataset(['g','v'],rows),'g','v'),null);
});
test('ordinary regression and Welch retain the correct coefficients and probabilities',()=>{
  const regression=stats.regression(dataset(['x','y'],[['1','2'],['2','4'],['3','5'],['4','4'],['5','5']]),'x','y');
  close(regression.slope,.6);close(regression.intercept,2.2);close(regression.r2,.6);
  const t=Math.sqrt(4.5);close(regression.p,1-2/Math.PI*(Math.atan(t/Math.sqrt(3))+Math.sqrt(3)*t/(t*t+3)));
  const welch=stats.welchTest(dataset(['g','v'],[['A','1'],['A','2'],['A','3'],['B','2'],['B','3'],['B','4']]),'g','v');
  close(welch.degreesOfFreedom,4);const u=Math.abs(welch.t)/Math.sqrt(welch.t**2+4);close(welch.p,1-1.5*u+.5*u**3);
});
test('empty summaries do not fabricate zeros and one observation has no sample standard deviation',()=>{
  const empty=stats.summarize(dataset(['x'],[[''],['NA']]),'x');assert.equal(empty.n,0);
  for(const key of ['mean','sd','min','median','max'])assert.ok(Number.isNaN(empty[key]),key);
  const one=stats.summarize(dataset(['x'],[['5']]),'x');assert.equal(one.mean,5);assert.ok(Number.isNaN(one.sd));
  assert.deepEqual(stats.histogram(dataset(['x'],[['']]),'x'),[]);
});
test('all import paths can use collision free column names including generated suffix collisions',()=>{
  const names=stats.uniqueColumnNames([' x ','x_2','x','','变量4','x_2']);assert.equal(new Set(names).size,names.length);assert.equal(names[0],'x');
  const parsed=stats.parseCsv('x,x,x_2\n1,2,3','dupes.csv');assert.equal(new Set(parsed.headers).size,3);assert.deepEqual(parsed.rows,[['1','2','3']]);
});
test('large histograms avoid argument count limits and retain every observation',()=>{
  const rows=Array.from({length:150000},(_,i)=>[String(i)]);const histogram=stats.histogram(dataset(['x'],rows),'x');assert.equal(histogram.reduce((total,bin)=>total+bin.count,0),rows.length);
});
test('quality diagnostics separate invalid numeric cells, missing cells, constants and duplicate excess rows',()=>{
  const data=dataset(['mixed','constant','empty'],[['1','A',''],['2','A','NA'],['3','A',''],['4','A',''],['oops','A',''],['','A',''],['1','A','']]);
  const before=structuredClone(data);const result=exploration.qualityProfile(data);
  assert.equal(result.duplicates,1);assert.equal(result.columns[0].invalidNumeric,1);assert.equal(result.columns[0].missing,1);assert.equal(result.columns[0].n,5);assert.equal(result.columns[1].constant,true);assert.equal(result.columns[2].present,0);assert.deepEqual(data,before);
});
test('group summaries use sample SD and type7 quartiles while accounting for omitted rows',()=>{
  const result=exploration.groupedSummaries(dataset(['g','v'],[['A','1'],['A','2'],['A','3'],['A','4'],['A',''],['B','10'],['','99']]),'g','v');
  const a=result.groups[0];assert.equal(a.n,4);assert.equal(a.missing,1);assert.equal(a.mean,2.5);close(a.sd,Math.sqrt(5/3));assert.equal(a.q1,1.75);assert.equal(a.median,2.5);assert.equal(a.q3,3.25);assert.equal(result.missingGroup,1);assert.ok(Number.isNaN(result.groups[1].sd));
  assert.equal(exploration.groupedSummaries(dataset(['x'],[['1'],['2']]),'','x').groups[0].group,'全部观测');
  assert.throws(()=>exploration.groupedSummaries(dataset(['g','v'],Array.from({length:201},(_,i)=>[String(i),'1'])),'g','v'),/200/);
});
test('frequency denominators exclude missing observations and ties are stable',()=>{
  const result=exploration.frequencyTable(dataset(['g'],[['B'],['A'],['A'],[''],['NA']]),'g');assert.equal(result.missing,2);assert.equal(result.valid,3);assert.equal(result.rows[0].value,'A');close(result.rows[0].percent,200/3);
});
test('correlation matrices retain pair specific N, match regression and mark constants unavailable',()=>{
  const data=dataset(['x','y','z','constant'],[['1','2','','3'],['2','4','10','3'],['3','5','9','3'],['4','','8','3'],['5','5','7','3']]);
  const matrix=exploration.correlationMatrix(data,['x','y','z','constant']);assert.equal(matrix[0][1].n,4);assert.equal(matrix[1][2].n,3);close(matrix[0][1].r,stats.regression(data,'x','y').r);assert.deepEqual(matrix[0][1],matrix[1][0]);assert.equal(matrix[0][3].r,null);assert.equal(matrix[3][3].r,null);close(matrix[0][0].r,1);
  assert.throws(()=>exploration.correlationMatrix(data,['x','x']));
});
test('CSV export escapes spreadsheet formulas, quotes and missing numbers without rounding valid numbers',()=>{
  const csv=exploration.statisticsCsv([['=cmd',' A',' @formula','a,"b"'],[-2,1/3,NaN,null]]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=cmd"'));assert.ok(csv.includes('"\' @formula"'));assert.ok(csv.includes('"a,""b"""'));assert.ok(csv.includes('"-2","0.3333333333333333","",""'));
});
test('new recipes declare the corrected engine and legacy recipes remain explicitly recognizable',async()=>{
  const data=dataset(['x','y'],[['1','2'],['2','3'],['3','5']]);const config={method:'relation',x:'x',y:'y',group:'',value:''};const recipe=recipes.createAnalysisRecipe(data,config,await recipes.fingerprintDataset(data));assert.equal(recipe.engine,'acaora-stats-v2');assert.equal(recipes.parseAnalysisRecipe(JSON.stringify({...recipe,engine:'acaora-stats-v1'})).engine,'acaora-stats-v1');assert.throws(()=>recipes.parseAnalysisRecipe(JSON.stringify({...recipe,engine:'unknown'})));
});
