import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache=new Map();
async function load(url){
  url=new URL(url,import.meta.url);if(cache.has(url.href))return cache.get(url.href);
  let code=ts.transpileModule(await readFile(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
  for(const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]){
    const source=match[1];const target=source.startsWith('.')?(await load(new URL(source+'.ts',url))).url:import.meta.resolve(source);
    code=code.replace(match[0],`from '${target}'`);
  }
  const encoded='data:text/javascript;base64,'+Buffer.from(code).toString('base64'),value={url:encoded,exports:await import(encoded)};cache.set(url.href,value);return value;
}
const {fitMultipleRegression,criticalT95}=(await load('../app/data/multiple-regression.ts')).exports;
const {validRegressionConfig,createRegressionRecipe,parseRegressionRecipe,regressionConfigErrors}=(await load('../app/data/regression-config.ts')).exports;
const reference=JSON.parse(await readFile(new URL('./fixtures/multiple-regression-reference.json',import.meta.url),'utf8'));
function close(actual,expected,tolerance=2e-8){assert.equal(typeof actual,'number');assert.ok(Number.isFinite(actual));assert.ok(Math.abs(actual-expected)<=tolerance*(1+Math.abs(expected)),`${actual} != ${expected}`);}
const configFor=(data,standardErrors='HC3')=>({outcome:'y',predictors:data.headers.filter(header=>header!=='y'),standardErrors});
for(const fixture of reference.cases)for(const standardErrors of ['classical','HC3'])test(`${fixture.name} ${standardErrors} matches statsmodels coefficients, inference and observation diagnostics`,()=>{
  const before=structuredClone(fixture.data),result=fitMultipleRegression(fixture.data,configFor(fixture.data,standardErrors)),expected=fixture.expected;
  for(const key of ['n','excluded','dfResidual'])assert.equal(result[key],expected[key]);
  for(const key of ['r2','adjustedR2','rmse'])close(result[key],expected[key]);
  result.coefficients.forEach((row,j)=>{for(const key of ['estimate','se','t','p','low','high','vif'])if(expected.methods[standardErrors][j][key]===null)assert.equal(row[key],null);else close(row[key],expected.methods[standardErrors][j][key]);});
  result.observations.forEach((row,i)=>{assert.equal(row.row,expected.observations[i].row);for(const key of ['fitted','residual','standardizedResidual','leverage','cook'])close(row[key],expected.observations[i][key]);});
  assert.deepEqual(fixture.data,before);
});
test('t critical values match published low and moderate df references',()=>{close(criticalT95(1),12.706204736432095);close(criticalT95(10),2.2281388519649385);assert.throws(()=>criticalT95(0));});
test('rank deficient and near collinear models cannot be silently fit with a pseudoinverse',()=>{
  for(const perturbation of [0,1e-12]){
    const data={name:'collinear',headers:['x1','x2','y'],rows:Array.from({length:12},(_,i)=>[String(i),String(2*i+(i%2)*perturbation),String(1+i+(i%3)*.2)])};
    assert.throws(()=>fitMultipleRegression(data,configFor(data)),/共线性/);
  }
});
test('constant outcomes, constants within complete cases, insufficient df and row bounds fail explicitly',()=>{
  const constant={name:'constant',headers:['x1','y'],rows:[['1','2'],['2','2'],['3','2'],['4','2']]};assert.throws(()=>fitMultipleRegression(constant,configFor(constant)),/没有变动/);
  const incomplete={...constant,rows:[['1','1'],['1','2'],['1','3'],['2','']]};assert.throws(()=>fitMultipleRegression(incomplete,configFor(incomplete)),/没有变动/);
  assert.throws(()=>fitMultipleRegression({...constant,rows:[['1','1'],['2','2']]},configFor(constant)),/参数/);
  assert.throws(()=>fitMultipleRegression({...constant,rows:Array.from({length:50001},(_,i)=>[String(i),String(i%7)])},configFor(constant)),/50,000/);
});
test('HC3 has unchanged coefficients but its own covariance; perfect fit inference is withheld',()=>{
  const data=reference.cases[1].data,classical=fitMultipleRegression(data,configFor(data,'classical')),robust=fitMultipleRegression(data,configFor(data));
  classical.coefficients.forEach((row,i)=>close(row.estimate,robust.coefficients[i].estimate));assert.notEqual(classical.coefficients[1].se,robust.coefficients[1].se);
  const exact={name:'exact',headers:['x1','y'],rows:[['1','3'],['2','5'],['3','7'],['4','9']]};const fit=fitMultipleRegression(exact,configFor(exact));fit.coefficients.forEach(row=>{assert.equal(row.p,null);assert.equal(row.se,null);});assert.ok(fit.warnings.some(message=>message.includes('完全拟合')));
});
test('unit leverage keeps point estimates but does not fabricate finite HC3 inference',()=>{
  const data={name:'isolated',headers:['x1','x2','y'],rows:[[0,0,1],[1,0,2.1],[2,0,1.8],[3,0,3.3],[4,0,3.8],[5,1,9]].map(row=>row.map(String))};
  const fit=fitMultipleRegression(data,configFor(data));assert.ok(fit.warnings.some(message=>message.includes('杠杆值接近 1')));assert.equal(fit.coefficients[0].se,null);assert.equal(fit.coefficients[1].p,null);
});
test('centering and rescaling preserve fitted observations and restore original coefficient units',()=>{
  const data=reference.cases[0].data,base=fitMultipleRegression(data,configFor(data));
  const transformed={...data,rows:data.rows.map(row=>[String(Number(row[0])*1e6+2e8),row[1],String(Number(row[2])*1000+1e9)])};
  const fit=fitMultipleRegression(transformed,configFor(transformed));close(fit.coefficients[1].estimate,base.coefficients[1].estimate/1000,1e-7);close(fit.coefficients[2].estimate,base.coefficients[2].estimate*1000,1e-7);close(fit.coefficients[1].se,base.coefficients[1].se/1000,1e-7);
  fit.observations.forEach((row,i)=>close(row.fitted,base.observations[i].fitted*1000+1e9,1e-12));
});
test('regression recipes strictly carry settings and schema but never raw rows or executable fields',()=>{
  const data=reference.cases[0].data,config=configFor(data),fingerprint='a'.repeat(64),recipe=createRegressionRecipe(data,config,fingerprint);
  assert.deepEqual(parseRegressionRecipe(JSON.stringify(recipe)),recipe);assert.equal(Object.hasOwn(recipe.dataset,'data'),false);
  for(const patch of [{version:2},{engine:'arbitrary'},{intercept:false},{confidence:.9},{code:'anything'},{config:{...config,predictors:['x1','x1']}},{dataset:{...recipe.dataset,rows:[]}}])assert.throws(()=>parseRegressionRecipe(JSON.stringify({...recipe,...patch})));
  assert.equal(validRegressionConfig({...config,predictors:['y']}),false);assert.ok(regressionConfigErrors(data,{...config,outcome:'missing'}).length>0);
});
