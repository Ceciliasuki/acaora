import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {installApiMocks,type MockProject} from './helpers';

const now='2026-10-14T08:00:00.000Z';
const project:MockProject={id:'release-mobile',title:'论文与数据证据核对及阶段研究计划'.repeat(3),kind:'paper',status:'active',metadata:{notes:'核对来源并保留研究草稿。',tasks:Array.from({length:100},(_,i)=>({id:`t-${i}`,text:`核对第${i+1}项文献中的变量、样本及检验条件`,done:i<30}))},created_at:now,updated_at:now};
const output='outputs/release-2026-10-14';

for(const width of [320,375,768]) test(`Release touch layout and core controls at ${width}px @a11y`,async({browser})=>{
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
  const page=await context.newPage();await installApiMocks(page,{signedIn:true,projects:[project]});await mkdir(output,{recursive:true});
  for(const route of ['courses','papers','data','projects','settings','auth']) {
    await page.goto(route==='papers'?'/papers?view=reader':`/${route}`);
    if(route==='papers') await expect(page.getByLabel('论文标题',{exact:true})).toBeVisible();
    if(route==='projects') {await expect(page.getByRole('heading',{name:project.title,exact:true})).toBeVisible();await page.getByLabel('查找项目',{exact:true}).fill('不存在的计划');await page.getByRole('button',{name:'查看全部项目',exact:true}).click();await page.getByRole('group',{name:'任务筛选',exact:true}).getByRole('button',{name:'待办 70',exact:true}).click();}
    if(route==='data') {await page.getByRole('button',{name:'固定本次结果',exact:true}).click();await page.getByRole('combobox',{name:'分析变量',exact:true}).selectOption('年龄');await page.getByText('查看固定结果对照',{exact:true}).click();await expect(page.locator('.data-result-comparison')).toContainText('7.02');}
    if(route==='settings') await expect(page.getByLabel('昵称',{exact:true})).toHaveValue('测试同学');
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical'),`${route} at ${width}`).toEqual([]);
    await page.screenshot({path:`${output}/${route}-${width}.png`,animations:'disabled'});
  }
  await context.close();
});
