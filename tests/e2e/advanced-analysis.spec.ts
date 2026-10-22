import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {installApiMocks} from './helpers';
import {parseCsv} from '../../app/stats';
import ref from '../fixtures/advanced-reference.json' with {type:'json'};
import feasibility from '../fixtures/advanced-feasibility-reference.json' with {type:'json'};
const csv=[ref.data.headers.join(','),...ref.data.rows.map(r=>r.join(','))].join('\n');
const out='outputs/advanced-feasibility-2026-10-21';
async function open(page:Page){await installApiMocks(page);await page.goto('/data');await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'advanced-synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.getByRole('tab',{name:'进阶方法',exact:true}).click();await expect(page.getByRole('combobox',{name:'进阶方法',exact:true})).toBeVisible();}
async function select(page:Page,method:string){await page.getByRole('combobox',{name:'进阶方法',exact:true}).selectOption(method);}
async function run(page:Page){await page.getByRole('button',{name:'运行分析',exact:true}).click();await expect(page.getByRole('region',{name:'进阶分析结果',exact:true})).toBeVisible();}
async function exportTable(page:Page,title:string){const download=page.waitForEvent('download');await page.getByRole('button',{name:`导出${title} CSV`,exact:true}).click();return parseCsv(await readFile((await (await download).path())!,'utf8'),'export.csv');}
test('all twelve methods run actual production Workers with their required controls and full precision exports',async({page})=>{
  await open(page);
  for(const method of ['logistic','cluster','fixed','paired','anova','welchanova','posthoc','mannwhitney','wilcoxon','pca','kmeans','cv']){
    await select(page,method);await expect(page.getByRole('region',{name:'进阶分析结果',exact:true})).toHaveCount(0);
    if(['cluster','fixed','anova','welchanova','posthoc','cv'].includes(method))await page.getByRole('combobox',{name:'进阶因变量',exact:true}).selectOption('y');
    if(['paired','wilcoxon'].includes(method)){await page.getByRole('combobox',{name:'第一列',exact:true}).selectOption('before');await page.getByRole('combobox',{name:'第二列',exact:true}).selectOption('after');}
    if(method==='anova'||method==='welchanova'||method==='posthoc')await page.getByRole('combobox',{name:'分组字段',exact:true}).selectOption('group3');
    if(method==='mannwhitney'){await page.getByRole('combobox',{name:'进阶因变量',exact:true}).selectOption('before');await page.getByRole('combobox',{name:'分组字段',exact:true}).selectOption('group2');}
    if(method==='pca'||method==='kmeans')await page.getByRole('checkbox',{name:'x3',exact:true}).check();
    await run(page);const result=page.getByRole('region',{name:'进阶分析结果',exact:true});await expect(result).toContainText('96 / 0');
    if(method==='logistic'){const downloaded=await exportTable(page,'Logistic 系数与优势比');expect(Number(downloaded.rows[1][downloaded.headers.indexOf('OR')])).toBeCloseTo(ref.expected.logistic.coefficients[1][6],8);}
    if(method==='fixed'){const downloaded=await exportTable(page,'逐行拟合');expect(downloaded.rows).toHaveLength(96);expect(Number(downloaded.rows[0][downloaded.headers.indexOf('拟合值')])).toBeCloseTo(ref.expected.fixed.fitted[0],8);}
    if(method==='cv'){
      const downloaded=await exportTable(page,'逐行折外预测');expect(downloaded.rows).toHaveLength(96);expect(Number(downloaded.rows[0][downloaded.headers.indexOf('折外预测')])).toBeCloseTo(ref.expected.cv.predictions[0],8);
      await result.getByRole('button',{name:'固定本次结果',exact:true}).click();await page.getByRole('spinbutton',{name:'随机种子',exact:true}).fill('7');await expect(result).toContainText('设置已修改');await run(page);await page.getByText('查看固定结果对照',{exact:true}).click();await expect(page.locator('.data-result-comparison')).toContainText('种子 42');await expect(page.locator('.data-result-comparison')).toContainText('种子 7');
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出分析记录 JSON'}).click();const record=JSON.parse(await readFile((await (await download).path())!,'utf8'));expect(record.config.seed).toBe(7);expect(record.engine).toBe('acaora-advanced-v4');expect(record.tables).toBeUndefined();expect(record.rows).toBeUndefined();
    }
  }
});
for(const width of [1440,375])test(`grouped selector, keyboard scroll, readable tables and accessibility ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===375?812:1000});await open(page);
  const picker=page.getByRole('combobox',{name:'进阶方法',exact:true});await expect(picker.locator('optgroup')).toHaveCount(5);await expect(picker.locator('option')).toHaveCount(14);await select(page,'pca');await run(page);
  const region=page.getByRole('region',{name:'进阶分析结果',exact:true});await region.scrollIntoViewIfNeeded();await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/result-${width}.png`,animations:'disabled'});
  await page.getByRole('tab',{name:'进阶方法',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/setup-${width}.png`,animations:'disabled'});
  const audit=await new AxeBuilder({page}).include('#analysis').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const table=page.getByRole('region',{name:'标准化主轴权重，可横向滚动',exact:true});await table.focus();await expect(table).toBeFocused();
});
test('switching method or replacing data cancels old workers; invalid Logistic coding shows a recovery error',async({page})=>{
  await page.addInitScript(()=>{const original=Worker.prototype.postMessage;Worker.prototype.postMessage=function(message:unknown){setTimeout(()=>Reflect.apply(original,this,[message]),700);};});await open(page);
  const created=page.waitForEvent('worker');await page.getByRole('button',{name:'运行分析',exact:true}).click();const worker=await created,closed=new Promise<void>(resolve=>worker.once('close',()=>resolve()));await select(page,'paired');await closed;await expect(page.getByRole('region',{name:'进阶分析结果',exact:true})).toHaveCount(0);
  await select(page,'logistic');await page.getByRole('combobox',{name:'进阶因变量',exact:true}).selectOption('y');await page.getByRole('button',{name:'运行分析',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'0 与 1'})).toBeVisible();
  const created2=page.waitForEvent('worker');await page.getByRole('combobox',{name:'进阶因变量',exact:true}).selectOption('binary');await page.getByRole('button',{name:'运行分析',exact:true}).click();const worker2=await created2,closed2=new Promise<void>(resolve=>worker2.once('close',()=>resolve()));await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'new.csv',mimeType:'text/csv',buffer:Buffer.from('u,v\n1,4\n2,3\n3,5\n4,2')});await closed2;await expect(page.getByRole('region',{name:'进阶分析结果',exact:true})).toHaveCount(0);
});

const validationCsv=[feasibility.data.headers.join(','),...feasibility.data.rows.map(r=>r.join(','))].join('\n');
async function loadValidation(page:Page,text=validationCsv){await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'validation-synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(text)});}
test('data preflight and group/time Workers show isolated folds, excluded initial predictions and correct CSV',async({page})=>{
  await open(page);await loadValidation(page);await select(page,'cv');await page.getByRole('combobox',{name:'进阶因变量',exact:true}).selectOption('y');await page.getByRole('combobox',{name:'验证划分',exact:true}).selectOption('group');
  await page.getByRole('button',{name:'检查数据与设定',exact:true}).click();const check=page.getByRole('region',{name:'分析可行性检查',exact:true});await expect(check).toContainText('完整观测 96 / 96，排除 0');await expect(check).toContainText('主体完全隔离');await expect(page.getByRole('region',{name:'进阶分析结果',exact:true})).toHaveCount(0);
  await run(page);const result=page.getByRole('region',{name:'进阶分析结果',exact:true});await expect(result).toContainText('主体分组（entity）');const grouped=await exportTable(page,'逐行折外预测');expect(Number(grouped.rows[0][grouped.headers.indexOf('折外预测')])).toBeCloseTo(feasibility.expected.group.predictions[0]!,8);
  await page.getByRole('combobox',{name:'验证划分',exact:true}).selectOption('time');await page.getByRole('combobox',{name:'验证时间字段',exact:true}).selectOption('time');await expect(check).toContainText('设置已修改');await run(page);await expect(result).toContainText('时间前向（time）');
  const time=await exportTable(page,'逐行折外预测');expect(time.rows.filter(row=>row[time.headers.indexOf('折外预测')]==='')).toHaveLength(96-feasibility.expected.time.evaluated);const index=feasibility.expected.time.predictions.findIndex(v=>v!==null);expect(Number(time.rows[index][time.headers.indexOf('折外预测')])).toBeCloseTo(feasibility.expected.time.predictions[index]!,8);await expect(result).toContainText('时间顺序检查');
});
test('advanced recipes stage mappings, require changed-data acknowledgement and apply across methods without auto-running',async({page})=>{
  await open(page);await loadValidation(page);await select(page,'cv');await page.getByRole('combobox',{name:'进阶因变量',exact:true}).selectOption('y');await page.getByRole('combobox',{name:'验证划分',exact:true}).selectOption('group');await page.getByText('保存与载入进阶方案',{exact:true}).click();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出进阶方案',exact:true}).click();const recipeText=await readFile((await (await download).path())!,'utf8'),recipe=JSON.parse(recipeText);expect(recipe.config.validation).toBe('group');expect(recipe.dataset.fingerprint).toMatch(/^[a-f0-9]{64}$/);expect(recipe.dataset.data).toBeUndefined();
  const renamed=validationCsv.replace(feasibility.data.headers.join(','),feasibility.data.headers.map(h=>({x1:'u',x2:'v',y:'target',entity:'subject',time:'period'}[h]??h)).join(','));await loadValidation(page,renamed);await page.getByText('保存与载入进阶方案',{exact:true}).click();await page.getByLabel('选择进阶方案文件',{exact:true}).setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(recipeText)});
  const stage=page.getByRole('region',{name:'待应用进阶方案',exact:true});await expect(stage).toContainText('数据指纹不同');await expect(stage.getByRole('button',{name:'应用进阶设置'})).toBeDisabled();for(const [i,value] of ['target','u','v','subject'].entries())await stage.getByRole('combobox',{name:`进阶方案字段 ${i+1}`,exact:true}).selectOption(value);await expect(stage.getByRole('button',{name:'应用进阶设置'})).toBeDisabled();await stage.getByRole('checkbox',{name:'我已核对映射，使用当前数据',exact:true}).check();await stage.getByRole('button',{name:'应用进阶设置'}).click();
  await expect(page.getByRole('combobox',{name:'进阶方法',exact:true})).toHaveValue('cv');await expect(page.getByRole('combobox',{name:'验证划分',exact:true})).toHaveValue('group');await expect(page.getByRole('combobox',{name:'分组字段',exact:true})).toHaveValue('subject');await expect(page.getByRole('region',{name:'进阶分析结果',exact:true})).toHaveCount(0);await run(page);await expect(page.getByRole('region',{name:'进阶分析结果',exact:true})).toContainText('主体分组（subject）');
});
