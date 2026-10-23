import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {installApiMocks,type MockProject} from './helpers';

const now='2026-10-14T08:00:00.000Z';
const projects:MockProject[]=[
  {id:'one',title:'贸易研究：长任务清单',kind:'paper',status:'active',metadata:{goal:'检查文献、变量与资料来源',notes:'保留已有笔记。',tasks:Array.from({length:100},(_,i)=>({id:`task-${i}`,text:`核对第 ${i+1} 项文献与数据来源`,done:i<60}))},created_at:now,updated_at:now},
  {id:'two',title:'课程统计练习',kind:'course',status:'active',metadata:{tasks:[]},created_at:now,updated_at:now},
  {id:'three',title:'已归档的实证分析',kind:'data',status:'completed',metadata:{goal:'复核最终结果',tasks:[]},created_at:now,updated_at:now},
];
const out='outputs/workspace-flow-2026-10-14';

test('Project search and keyboard selection preserve the source draft and recover from empty matches',async({page})=>{
  await installApiMocks(page,{signedIn:true,projects}); await page.goto('/projects');
  const list=page.locator('.project-list');
  await page.getByLabel('项目笔记',{exact:true}).fill('未保存的原项目草稿');
  await list.getByRole('button',{name:/贸易研究/}).press('ArrowDown');
  await expect(page.getByRole('heading',{name:'课程统计练习',exact:true})).toBeVisible();
  await expect(list.getByRole('button',{name:/课程统计练习/})).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('heading',{name:'已归档的实证分析',exact:true})).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByLabel('项目笔记',{exact:true})).toHaveValue('未保存的原项目草稿');
  await page.getByLabel('查找项目',{exact:true}).fill('复核最终');
  await expect(list.getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'贸易研究：长任务清单',exact:true})).toBeVisible();
  await expect(page.getByLabel('项目笔记',{exact:true})).toHaveValue('未保存的原项目草稿');
  await list.getByRole('button',{name:/已归档的实证分析/}).press('Enter');
  await expect(page.getByRole('heading',{name:'已归档的实证分析',exact:true})).toBeVisible();
  await page.getByLabel('查找项目',{exact:true}).fill('没有这个项目');
  await expect(page.getByText('没有匹配的项目。',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'查看全部项目',exact:true}).click();
  await expect(list.getByRole('button')).toHaveCount(3);
  await list.getByRole('button',{name:/已归档的实证分析/}).press('Home');
  await expect(list.getByRole('button',{name:/贸易研究/})).toBeFocused();
  await expect(page.getByLabel('项目笔记',{exact:true})).toHaveValue('未保存的原项目草稿');
});

test('Long task lists filter by actual state and restore usable focus after a completed row leaves the filter',async({page})=>{
  const state=await installApiMocks(page,{signedIn:true,projects}); await page.goto('/projects');
  const filters=page.getByRole('group',{name:'任务筛选',exact:true});
  await filters.getByRole('button',{name:'待办 40',exact:true}).click();
  await expect(page.locator('.project-tasks input')).toHaveCount(40);
  await page.locator('.project-tasks input').first().click();
  await expect(page.locator('.project-tasks input')).toHaveCount(39);
  await expect.poll(()=>page.locator('.project-tasks input').first().evaluate(e=>document.activeElement===e)).toBe(true);
  expect(state.projects[0].metadata.tasks?.filter(task=>task.done)).toHaveLength(61);
  await filters.getByRole('button',{name:'已完成 61',exact:true}).click();
  await expect(page.locator('.project-tasks input')).toHaveCount(61);
});

test('A fixed data result retains its values while variables change and belongs only to the current dataset',async({page})=>{
  await installApiMocks(page); await page.goto('/data#analysis');
  await page.getByRole('button',{name:'固定本次结果',exact:true}).click();
  const variable=page.getByRole('combobox',{name:'分析变量',exact:true}); await variable.selectOption('年龄');
  await page.getByText('查看固定结果对照',{exact:true}).click();
  const comparison=page.locator('.data-result-comparison');
  await expect(comparison).toContainText('分析变量：睡眠时长');
  await expect(comparison).toContainText('分析变量：年龄');
  await expect(comparison.getByRole('row',{name:/均值/}).getByRole('cell').nth(0)).toHaveText('7.02');
  await expect(comparison.getByRole('row',{name:/均值/}).getByRole('cell').nth(1)).toHaveText('21.00');
  await page.getByRole('tab',{name:'相关与回归',exact:true}).click();
  await expect(comparison).toContainText('Pearson 相关与一元回归');
  await expect(comparison.getByRole('row',{name:/相关系数 r/}).getByRole('cell').first()).toHaveText('—');
  await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'student_sleep.csv',mimeType:'text/csv',buffer:Buffer.from('x,y\n1,4\n2,5\n3,7')});
  await expect(comparison).toHaveCount(0);
  await expect(page.getByRole('button',{name:'固定本次结果',exact:true})).toBeVisible();
});

test('Result copy contains the real method and displayed numbers; denied clipboard access offers a manual copy',async({page})=>{
  await installApiMocks(page); await page.goto('/data#analysis');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as unknown as {copiedResult:string}).copiedResult=text;}}}));
  await page.getByRole('button',{name:'复制当前结果',exact:true}).click();
  await expect(page.getByText('已复制，包含数据来源与分析条件',{exact:true})).toBeVisible();
  const copy=await page.evaluate(()=>(window as unknown as {copiedResult:string}).copiedResult);
  expect(copy).toContain('student_sleep.csv（示例数据）');expect(copy).toContain('有效样本：23');expect(copy).toContain('均值：7.02');expect(copy).not.toContain('S01');
  await page.getByRole('tab',{name:'独立样本 t 检验',exact:true}).click();
  await expect(page.getByText('已复制，包含数据来源与分析条件',{exact:true})).toHaveCount(0);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new DOMException('Denied','NotAllowedError');}}}));
  await page.getByRole('button',{name:'复制当前结果',exact:true}).click();
  await expect(page.locator('.data-copy-fallback [role="alert"]')).toContainText('手动复制');
  await expect(page.getByLabel('可手动复制的分析结果',{exact:true})).toContainText('双侧 Welch');
});

for(const width of [1024,1440]) test(`Desktop flow tools fit real long fixtures at ${width}px @a11y`,async({page})=>{
  await installApiMocks(page,{signedIn:true,projects});await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await mkdir(out,{recursive:true});
  await page.goto('/projects');await expect(page.getByRole('heading',{name:projects[0].title,exact:true})).toBeVisible();
  await page.getByRole('group',{name:'任务筛选',exact:true}).getByRole('button',{name:'待办 40',exact:true}).click();
  for(const path of ['projects','data']) {
    if(path==='data') {await page.goto('/data#analysis');await page.getByRole('button',{name:'固定本次结果',exact:true}).click();await page.getByRole('combobox',{name:'分析变量',exact:true}).selectOption('年龄');await page.getByText('查看固定结果对照',{exact:true}).click();}
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
    await page.screenshot({path:`${out}/${path}-${width}.png`,animations:'disabled'});
  }
});
