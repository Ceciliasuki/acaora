import {test, expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks, type MockProject} from './helpers';
import {emptyResearchDossier} from '../../app/lib/project-research';

const out='outputs/conservative-rollback-2026-10-26';
for(const width of [1440,390]) test(`homepage reading preview and retained palette ${width}px`,async({page})=>{
  await installApiMocks(page);await page.setViewportSize({width,height:900});await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toHaveText(/读透论文，\s*做实研究。/);
  await expect(page.getByRole('figure',{name:'原文与笔记示例',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'开始研究',exact:true})).toHaveCount(0);
  expect(await page.locator('body').evaluate(node=>getComputedStyle(node).backgroundColor)).toBe('rgb(247, 246, 242)');
  if(width===390){const menu=page.getByRole('button',{name:'打开主导航',exact:true});await menu.click();await expect(page.getByRole('navigation',{name:'移动主导航',exact:true}).getByRole('link',{name:'课程学习',exact:true})).toHaveAttribute('href','/courses');await menu.press('Escape');await expect(menu).toBeFocused();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/home-${width}.png`,animations:'disabled'});
});

test('previous project tools and overview return without a new export step',async({page})=>{
  const time='2026-10-26T00:00:00Z';
  const project:MockProject={id:'20000000-0000-4000-8000-000000000001',title:'流程回退检查',kind:'paper',status:'active',created_at:time,updated_at:time,metadata:{research:emptyResearchDossier(),analysisRecords:[{id:'analysis',snapshotId:'snapshot',name:'描述统计记录',role:'primary',sample:true,method:'描述统计',context:'合成数据',settings:JSON.stringify({method:'describe',x:'x',y:'',group:'',value:''}),dataset:{name:'example.csv',rows:4,fingerprint:'a'.repeat(64),sourceFingerprint:'b'.repeat(64)},metrics:[['均值','2.5']],interpretation:'合成流程检查',evidenceIds:[],createdAt:time,registeredAt:time}]}};
  const state=await installApiMocks(page,{signedIn:true,projects:[project]});
  await page.route('**/api/projects/workbench**',route=>route.fulfill({json:{project:state.projects[0],events:[]}}));
  await page.setViewportSize({width:1440,height:1000});await page.goto(`/projects?project=${project.id}`);
  await expect(page.getByRole('heading',{name:'项目空间',level:1,exact:true})).toBeVisible();
  await expect(page.getByRole('tablist',{name:'专业研究工具',exact:true}).getByRole('tab')).toHaveCount(11);
  await expect(page.getByRole('tablist',{name:'研究记录分区',exact:true}).getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('navigation',{name:'研究阶段',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'论文交付',exact:true}).click();const delivery=page.getByRole('region',{name:'论文交付',exact:true});
  await expect(delivery.getByRole('button',{name:'导出 Word .docx',exact:true})).toBeEnabled();
  await expect(delivery.getByRole('checkbox',{name:'以明确标注待核验分析的工作稿导出',exact:true})).toHaveCount(0);
  await delivery.getByText('分析核验情况',{exact:true}).click();await expect(delivery).toContainText('1 项分析待核验');
  await page.goto('/dashboard');await expect(page.getByRole('heading',{name:'总览',level:1,exact:true})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'工作空间',exact:true}).getByRole('link')).toHaveCount(3);
  await expect(page.locator('.research-queue')).toHaveCount(0);
});
