import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {installApiMocks} from './helpers';

const out='outputs/data-exploration-2026-10-21';
async function openExplorer(page:Page){await page.getByText('数据诊断与探索',{exact:true}).click();return page.getByRole('tablist',{name:'数据探索方式'});}
for(const width of [1440,375])test(`DataLab explores groups, frequencies and pairwise correlations ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===375?812:1000});await installApiMocks(page);await page.goto('/data');
  const tabs=await openExplorer(page);
  await page.getByLabel('查找诊断变量',{exact:true}).fill('睡眠');
  const quality=page.getByRole('region',{name:'质量诊断表，可横向滚动'});await expect(quality.locator('tbody tr')).toHaveCount(1);await expect(quality).toContainText('睡眠时长');
  await tabs.getByRole('tab',{name:'分组汇总',exact:true}).click();
  await page.getByRole('combobox',{name:'汇总分组',exact:true}).selectOption('性别');await page.getByRole('combobox',{name:'汇总数值变量',exact:true}).selectOption('统计学成绩');
  const grouped=page.getByRole('region',{name:'分组汇总表，可横向滚动'});await expect(grouped.locator('tbody tr')).toHaveCount(2);await expect(grouped).toContainText('Q1');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前表格 CSV'}).click();const file=await download;const text=await readFile((await file.path())!,'utf8');expect(text).toContain('"组别","有效 N"');expect(text).toContain('"女","12"');expect(text).toContain('"男","11","1"');
  await tabs.getByRole('tab',{name:'频数分布',exact:true}).click();await page.getByRole('combobox',{name:'频数变量',exact:true}).selectOption('性别');
  const frequencies=page.getByRole('region',{name:'频数分布表，可横向滚动'});await expect(frequencies.locator('tbody tr')).toHaveCount(2);await expect(frequencies.locator('tbody tr').first()).toContainText('50');
  await tabs.getByRole('tab',{name:'相关矩阵',exact:true}).click();
  const matrix=page.getByRole('region',{name:'相关矩阵，可横向滚动'});await expect(matrix).toContainText('N = 23');
  const audit=await new AxeBuilder({page}).include('details[aria-label="数据诊断与探索"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await matrix.scrollIntoViewIfNeeded();await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/correlation-${width}.png`,animations:'disabled'});
  await matrix.getByRole('button',{name:/睡眠时长 与 统计学成绩.*查看散点图/}).click();
  await expect(page.getByRole('tab',{name:'相关与回归',exact:true})).toHaveAttribute('aria-selected','true');await expect(page.getByRole('combobox',{name:'X',exact:true})).toHaveValue('睡眠时长');await expect(page.getByRole('combobox',{name:'Y',exact:true})).toHaveValue('统计学成绩');
  await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'new.csv',mimeType:'text/csv',buffer:Buffer.from('new_x,new_y\n1,2\n2,4\n3,7')});
  await expect(page.getByRole('tablist',{name:'数据探索方式'})).toHaveCount(0);
});

test('undefined analyses cannot report significance or be copied and legacy recipes require confirmation',async({page})=>{
  await installApiMocks(page);await page.goto('/data#analysis');
  await page.getByText('保存与重跑分析方案',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前方案'}).click();const file=await download;const recipe=JSON.parse(await readFile((await file.path())!,'utf8'));recipe.engine='acaora-stats-v1';
  await page.getByLabel('选择分析方案文件').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recipe))});
  await expect(page.getByText(/这是旧版统计引擎的方案/)).toBeVisible();await expect(page.getByRole('button',{name:'应用并重算'})).toBeDisabled();
  await page.getByRole('checkbox',{name:'我已确认变量映射，使用当前数据重算'}).check();await page.getByRole('button',{name:'应用并重算'}).click();
  await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'constant.csv',mimeType:'text/csv',buffer:Buffer.from('x,y,group\n1,2,A\n1,2,A\n1,2,B\n1,2,B')});
  await page.getByRole('tab',{name:'相关与回归',exact:true}).click();await expect(page.getByText(/请选择两个不同且有变动/)).toBeVisible();await expect(page.getByRole('button',{name:'复制当前结果'})).toBeDisabled();await expect(page.locator('.plain-conclusion')).toHaveCount(0);
  await page.getByRole('tab',{name:'独立样本 t 检验',exact:true}).click();await page.getByRole('combobox',{name:'分组变量',exact:true}).selectOption('group');await expect(page.getByText('暂时无法执行检验',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'复制当前结果'})).toBeDisabled();
  await page.getByText('数据诊断与探索',{exact:true}).click();await page.getByRole('tab',{name:'相关矩阵',exact:true}).click();const matrix=page.getByRole('region',{name:'相关矩阵，可横向滚动'});await expect(matrix).toContainText('—');await expect(matrix.getByRole('button').filter({hasText:'0.000'})).toHaveCount(0);
});
