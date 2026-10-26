import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {installApiMocks} from './helpers';

test('home modules share one list without a separate learning panel or footer',async({page})=>{
  await installApiMocks(page);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.locator('.module-grid .module-card')).toHaveCount(4);
  await expect(page.locator('.home-learning-module,.acaora-footer')).toHaveCount(0);
  const learning=page.locator('.module-grid .module-card[href="/courses"]');
  for(const width of [1440,2624,390]){
    await page.setViewportSize({width,height:1000});
    const tools=await page.locator('.module-grid .module-card').first().boundingBox(),block=await learning.boundingBox();
    expect(Math.abs(block!.x-tools!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(block!.width-tools!.width)).toBeLessThanOrEqual(1);
    expect(block!.height).toBeLessThan(200);
    expect(await learning.locator('p').evaluate(node=>node.getBoundingClientRect().width)).toBeGreaterThan(width>760?200:120);
    const grid=await page.locator('.module-grid').boundingBox();
    const content=await page.locator('.acaora-site').boundingBox();
    expect(Math.abs(grid!.x+grid!.width/2-(content!.x+content!.width/2))).toBeLessThanOrEqual(1);
    for(const card of await page.locator('.module-grid .module-card').all()){
      const content=await card.boundingBox();
      for(const text of await card.locator('h3,p').all()){
        const bounds=await text.boundingBox();
        expect(Math.abs(bounds!.x+bounds!.width/2-(content!.x+content!.width/2))).toBeLessThanOrEqual(1);
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await mkdir('outputs/home-learning-layout-2026-10-26',{recursive:true});
    await learning.screenshot({path:`outputs/home-learning-layout-2026-10-26/learning-${width}.png`,animations:'disabled'});
    await page.locator('.module-grid').screenshot({path:`outputs/home-learning-layout-2026-10-26/modules-${width}.png`,animations:'disabled'});
  }
});

for(const width of [1440,390])test(`overview layout and learning group ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await installApiMocks(page,{signedIn:true,projects:[{id:'overview-project',title:'文献与样本整理',kind:'paper',status:'active',metadata:{},created_at:'2026-10-26T00:00:00Z',updated_at:'2026-10-26T00:00:00Z'}]});
  await page.goto('/dashboard');await expect(page.getByRole('link',{name:'继续上次工作',exact:true})).toHaveAttribute('href','/projects?project=overview-project');
  const work=page.getByRole('navigation',{name:'工作空间',exact:true});await expect(work.getByRole('link')).toHaveCount(3);
  const study=page.getByRole('region',{name:'课程学习',exact:true});await expect(study.getByRole('link',{name:'进入课程',exact:true})).toHaveAttribute('href','/courses');
  if(width===390)await page.getByRole('button',{name:'打开主导航',exact:true}).click();else await page.locator('#app-sidebar').hover();
  const group=page.locator('#app-sidebar').getByRole('group',{name:'学习',exact:true});await expect(group.getByRole('link',{name:'课程学习',exact:true})).toHaveAttribute('href','/courses');
  if(width===390)await page.keyboard.press('Escape');else {
    await page.mouse.move(1200,40);
    await expect(page.locator('.sidebar-auto-slot')).toHaveAttribute('data-expanded','false');
    await expect(page.locator('#app-sidebar a[aria-label="论文阅读"] span')).toHaveCSS('opacity','0');
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  await mkdir('outputs/overview-copy-2026-10-26',{recursive:true});await page.screenshot({path:`outputs/overview-copy-2026-10-26/overview-${width}.png`,animations:'disabled'});
});
