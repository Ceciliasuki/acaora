import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {installApiMocks} from './helpers';
import {parseCsv} from '../../app/stats';
import reference from '../fixtures/multiple-regression-reference.json' with {type:'json'};

const fixture=reference.cases[0].data;
const csv=[fixture.headers.join(','),...fixture.rows.map(row=>row.join(','))].join('\n');
const out='outputs/multiple-regression-2026-10-21';
async function load(page:Page,name='model.csv',text=csv){await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from(text)});}
async function openModel(page:Page){await page.getByRole('tab',{name:'多元回归',exact:true}).click();await expect(page.getByRole('combobox',{name:'回归因变量',exact:true})).toBeVisible();}
async function exportCoefficients(page:Page){const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出系数 CSV',exact:true}).click();const file=await download;return parseCsv(await readFile((await file.path())!,'utf8'),'coefficients.csv');}
for(const width of [1440,375])test(`OLS worker, HC3 inference, model comparison and recipe round trip ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===375?812:1000});const state=await installApiMocks(page);await page.goto('/data');await load(page);await openModel(page);
  const worker=page.waitForEvent('worker');await page.getByRole('button',{name:'拟合模型',exact:true}).click();await worker;
  const result=page.getByRole('region',{name:'多元回归结果',exact:true});await expect(result).toBeVisible();
  const table=page.getByRole('region',{name:'回归系数表，可横向滚动'});await expect(table.locator('tbody tr')).toHaveCount(3);await expect(result).toContainText('HC3 稳健标准误');
  const robust=await exportCoefficients(page);const expected=reference.cases[0].expected.methods.HC3;const coefficientIndex=robust.headers.indexOf('系数'),seIndex=robust.headers.indexOf('标准误');
  robust.rows.forEach((row,index)=>{expect(Number(row[coefficientIndex])).toBeCloseTo(expected[index].estimate,7);expect(Number(row[seIndex])).toBeCloseTo(expected[index].se,7);});
  await result.getByRole('button',{name:'固定本次结果',exact:true}).click();await page.getByRole('combobox',{name:'标准误方式',exact:true}).selectOption('classical');await expect(page.getByText(/模型设置已修改/)).toBeVisible();
  await page.getByRole('button',{name:'拟合模型',exact:true}).click();await expect(result).toContainText('常规标准误');await page.getByText('查看固定结果对照',{exact:true}).click();const comparison=page.locator('.data-result-comparison');await expect(comparison).toContainText('HC3 稳健标准误');await expect(comparison).toContainText('常规标准误');
  const classical=await exportCoefficients(page);expect(Number(classical.rows[1][seIndex])).toBeCloseTo(reference.cases[0].expected.methods.classical[1].se,7);expect(Number(classical.rows[1][coefficientIndex])).toBeCloseTo(Number(robust.rows[1][coefficientIndex]),10);
  const diagnosticsDownload=page.waitForEvent('download');await page.getByRole('button',{name:'导出逐行诊断 CSV'}).click();const diagnosticsFile=await diagnosticsDownload;const diagnostics=parseCsv(await readFile((await diagnosticsFile.path())!,'utf8'),'diagnostics.csv');expect(diagnostics.rows).toHaveLength(fixture.rows.length);
  await page.getByText('保存与载入回归方案',{exact:true}).click();const recipeDownload=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前模型方案'}).click();const recipeFile=await recipeDownload;const recipeText=await readFile((await recipeFile.path())!,'utf8');const recipe=JSON.parse(recipeText);expect(recipe.config.predictors).toEqual(['x1','x2']);expect(recipe.intercept).toBe(true);expect(recipe.dataset.fingerprint).toMatch(/^[a-f0-9]{64}$/);expect(recipe.dataset.data).toBeUndefined();
  await table.scrollIntoViewIfNeeded();await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/coefficients-${width}.png`,animations:'disabled'});
  const audit=await new AxeBuilder({page}).include('#analysis').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await load(page,'mapped.csv',csv.replace('x1,x2,y','u,v,z'));await expect(result).toHaveCount(0);await page.getByText('保存与载入回归方案',{exact:true}).click();await page.getByLabel('选择回归方案文件').setInputFiles({name:'model.json',mimeType:'application/json',buffer:Buffer.from(recipeText)});
  await expect(page.getByText(/数据指纹不同，应用后使用当前数据/)).toBeVisible();await expect(page.getByRole('button',{name:'应用回归配置'})).toBeDisabled();
  await page.getByRole('combobox',{name:'方案因变量',exact:true}).selectOption('z');await page.getByRole('combobox',{name:'方案解释变量 1',exact:true}).selectOption('u');await page.getByRole('combobox',{name:'方案解释变量 2',exact:true}).selectOption('v');await page.getByRole('checkbox',{name:'我已核对映射，使用当前数据'}).check();await page.getByRole('button',{name:'应用回归配置'}).click();await expect(result).toHaveCount(0);
  await expect(page.getByRole('combobox',{name:'回归因变量',exact:true})).toHaveValue('z');await page.getByRole('button',{name:'拟合模型',exact:true}).click();await expect(result).toBeVisible();await expect(result).toContainText('u、v');expect(state.requests.some(request=>request==='POST /api/data'||request==='POST /api/regression')).toBe(false);
});

test('a collinear design fails explicitly instead of producing arbitrary coefficients',async({page})=>{
  await installApiMocks(page);await page.goto('/data');await load(page,'collinear.csv','x1,x2,y\n1,2,3\n2,4,4.2\n3,6,7\n4,8,8.5\n5,10,9');await openModel(page);await page.getByRole('button',{name:'拟合模型',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'共线性'})).toBeVisible();await expect(page.getByRole('region',{name:'多元回归结果',exact:true})).toHaveCount(0);
});
test('replacing a dataset terminates the previous worker and prevents late results',async({page})=>{
  await installApiMocks(page);await page.addInitScript(()=>{const original=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message:unknown){setTimeout(()=>Reflect.apply(original,this,[message]),700);};});await page.goto('/data');await load(page);await openModel(page);
  const created=page.waitForEvent('worker');await page.getByRole('button',{name:'拟合模型',exact:true}).click();const oldWorker=await created;const closed=new Promise<void>(resolve=>oldWorker.once('close',()=>resolve()));await load(page,'replacement.csv','u,v,z\n1,4,6\n2,3,7\n3,5,9\n4,2,8');await closed;
  await expect(page.getByRole('region',{name:'多元回归结果',exact:true})).toHaveCount(0);await expect(page.getByRole('combobox',{name:'回归因变量',exact:true})).toHaveValue('z');await expect(page.getByRole('button',{name:'拟合模型',exact:true})).toBeEnabled();
});

test('model entry is readable at both sizes and its worker fits the built application',async({page})=>{
  await installApiMocks(page);await page.goto('/data');await load(page);
  for(const width of [1440,375]){
    await page.setViewportSize({width,height:width===375?812:1000});await openModel(page);
    const tab=page.getByRole('tab',{name:'多元回归',exact:true});await tab.scrollIntoViewIfNeeded();
    for(const button of await page.getByRole('tablist',{name:'分析方法',exact:true}).getByRole('tab').all())expect(await button.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/setup-${width}.png`,animations:'disabled'});
  }
  await page.getByRole('button',{name:'拟合模型',exact:true}).click();const result=page.getByRole('region',{name:'多元回归结果',exact:true});await expect(result).toBeVisible();await expect(result).toContainText('HC3 稳健标准误');
});
