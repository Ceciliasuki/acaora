import {expect, test} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {installApiMocks, type MockProject} from './helpers';

const captures='outputs/advanced-motion-2026-10-13';
const project:MockProject={id:'motion-project',title:'示例：交互核验',kind:'paper',status:'active',metadata:{notes:'已保存的笔记',tasks:[{id:'task',text:'核对原文',done:false}]},created_at:'2026-10-13T00:00:00Z',updated_at:'2026-10-13T00:00:00Z'};

test('quick navigation searches real pages, traps focus, restores drafts and avoids nested dialogs',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await installApiMocks(page,{signedIn:true,projects:[project]});
 await page.goto('/projects');
 const notes=page.locator('#project-notes');
 await expect(notes).toHaveValue('已保存的笔记');
 await notes.fill('尚未保存的研究笔记');
 await page.keyboard.press('Control+k');
 const dialog=page.getByRole('dialog',{name:'快捷导航',exact:true});
 const search=dialog.getByRole('combobox');
 await expect(search).toBeFocused();
 await expect(page.locator('.sidebar-auto-slot')).toHaveAttribute('data-expanded','false');
 await page.keyboard.press('Shift+Tab');
 await expect(dialog.getByRole('button',{name:'关闭快捷导航'})).toBeFocused();
 await page.keyboard.press('Shift+Tab');
 await expect(dialog.getByRole('option').last()).toBeFocused();
 await page.keyboard.press('Tab');
 await page.keyboard.press('Tab');
 await expect(search).toBeFocused();
 await mkdir(captures,{recursive:true});
 await page.screenshot({path:`${captures}/quick-navigation-1440.png`,animations:'disabled'});
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 await search.fill('无此页面');
 await expect(dialog.getByRole('status')).toContainText('没有匹配');
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(notes).toBeFocused();
 await expect(notes).toHaveValue('尚未保存的研究笔记');
 await page.getByRole('button',{name:'删除',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'删除这个项目？'})).toBeVisible();
 await page.keyboard.press('Control+k');
 await expect(dialog).toHaveCount(0);
 await page.keyboard.press('Escape');
 await page.keyboard.press('Control+k');
 await search.fill('course');
 await expect(dialog.getByRole('option')).toHaveCount(1);
 await page.keyboard.press('Enter');
 await expect(page).toHaveURL('/courses');
 await expect(page.getByRole('heading',{name:'课程中心',level:1,exact:true})).toBeVisible();
});

for(const width of [1440,375]) {
 test(`course focus ${width}px preserves answers and closes only the top surface`,async({page})=>{
  await page.setViewportSize({width,height:width===375?812:1000});
  await installApiMocks(page,{signedIn:true});
  await page.goto('/courses/STAT-201/lesson-1');
  const answer=page.locator('[aria-labelledby="title-STAT-201-l1-q3"]').getByLabel('输入数值答案');
  await answer.fill('0.6');
  const toggle=page.locator('.course-focus-toggle');
  await toggle.click();
  expect(await page.locator('.page-body').evaluate(element=>element.getAnimations().length)).toBeGreaterThan(0);
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.workspace-header')).toBeHidden();
  await expect(page.locator('.app-sidebar')).toBeHidden();
  await expect(answer).toHaveValue('0.6');
  await page.evaluate(()=>window.scrollTo(0,0));
  await mkdir(captures,{recursive:true});
  await page.screenshot({path:`${captures}/course-focus-${width}.png`,animations:'disabled'});
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog',{name:'快捷导航',exact:true})).toBeVisible();
  if(width===375) await page.screenshot({path:`${captures}/quick-navigation-375.png`,animations:'disabled'});
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(toggle).toBeFocused();
  await expect(answer).toHaveValue('0.6');
  await page.emulateMedia({reducedMotion:'reduce'});
  await toggle.click();
  expect(await page.locator('.page-body').evaluate(element=>element.getAnimations().length)).toBe(0);
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 });
}

test('hover plate follows intent without selecting and settles after interruption',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});
 await installApiMocks(page,{signedIn:true});
 await page.goto('/data');
 const modes=page.getByRole('tablist',{name:'分析方法'});
 await modes.getByRole('tab',{name:'相关与回归',exact:true}).hover();
 await modes.getByRole('tab',{name:'独立样本 t 检验',exact:true}).hover();
 const plate=modes.locator('.motion-navigation-hover');
 expect(await plate.evaluate(element=>element.getAnimations().length)).toBeGreaterThan(0);
 await expect(modes.getByRole('tab',{name:'描述统计',exact:true})).toHaveAttribute('aria-selected','true');
 const target=modes.getByRole('tab',{name:'相关与回归',exact:true});
 await target.hover();
 await expect.poll(async()=>{const a=await target.boundingBox();const b=await plate.boundingBox();return Boolean(a&&b&&Math.abs(a.x-b.x)<1&&Math.abs(a.width-b.width)<1);}).toBe(true);
 await page.emulateMedia({reducedMotion:'reduce'});
 await modes.getByRole('tab',{name:'独立样本 t 检验',exact:true}).hover();
 expect(await plate.evaluate(element=>element.getAnimations().length)).toBe(0);
});

test('chart changes settle at real values and task feedback preserves unsaved notes',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,projects:[project]});
 await page.goto('/data');
 const variable=page.getByLabel('分析变量');
 await expect(variable).toBeVisible();
 const options=await variable.locator('option').allTextContents();
 const original=await variable.inputValue();
 const bars=page.locator('.histogram-column i');
 const before=await bars.evaluateAll(elements=>elements.map(element=>(element as HTMLElement).style.height));
 await variable.selectOption(options.find(value=>value!==original)!);
 await expect.poll(()=>bars.evaluateAll(elements=>elements.map(element=>(element as HTMLElement).style.height))).not.toEqual(before);
 expect(await bars.first().evaluate(element=>getComputedStyle(element).transitionDuration)).toContain('0.42s');
 await page.emulateMedia({reducedMotion:'reduce'});
 await variable.selectOption(original);
 expect(await bars.first().evaluate(element=>getComputedStyle(element).transitionDuration)).toBe('0s');
 await expect.poll(()=>bars.evaluateAll(elements=>elements.map(element=>(element as HTMLElement).style.height))).toEqual(before);
 await page.goto('/projects');
 const notes=page.locator('#project-notes');
 await notes.fill('保留尚未保存的笔记');
 // Controlled tasks display the stored state after the async save succeeds.
 await page.getByRole('checkbox',{name:'核对原文',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'核对原文',exact:true})).toBeChecked();
 await expect(page.locator('.project-summary')).toContainText('1 / 1 项任务完成');
 await expect(notes).toHaveValue('保留尚未保存的笔记');
 expect(state.projects[0].metadata.tasks?.[0].done).toBe(true);
 await page.reload();
 await expect(page.getByRole('checkbox',{name:'核对原文',exact:true})).toBeChecked();
});
