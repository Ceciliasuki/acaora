import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {installApiMocks} from './helpers';

for(const width of [1440,390])test(`expanded home introduction has working analysis and useful source links ${width}px`,async({page})=>{
  const runtimeErrors:string[]=[];
  page.on('pageerror',error=>runtimeErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')runtimeErrors.push(message.text());});
  await installApiMocks(page);await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:1000});await page.goto('/');
  const analysis=page.getByRole('region',{name:'变量之间',exact:true});await expect(analysis).toBeVisible();
  await expect(analysis.getByRole('img')).toHaveAccessibleName('睡眠时长与统计学成绩散点图，共 22 对完整观测');
  await expect(analysis.locator('svg circle')).toHaveCount(22);await expect(analysis).toContainText('0.556');
  const plot=analysis.getByRole('button',{name:'探索散点',exact:true});
  await plot.scrollIntoViewIfNeeded();
  const point=analysis.locator('[data-point-id="S01"] circle');
  const bounds=await point.boundingBox();expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);
  await expect(analysis.getByRole('status')).toContainText('S01');await expect(analysis.getByRole('status')).toContainText('7.2 小时');
  await page.mouse.move(0,0);await expect(analysis.getByRole('status')).toHaveCount(0);
  await plot.focus();await plot.press('ArrowRight');await expect(analysis.getByRole('status')).toContainText('S01');
  await plot.press('Enter');await expect(plot).toHaveAttribute('aria-pressed','true');
  await page.mouse.move(0,0);await expect(analysis.getByRole('status')).toContainText('已固定');
  await plot.press('Escape');await expect(analysis.getByRole('status')).toHaveCount(0);
  const fit=analysis.getByRole('button',{name:'拟合线',exact:true});await fit.click();await expect(fit).toHaveAttribute('aria-pressed','false');await fit.click();
  expect(await analysis.locator('[data-point-id="S01"]').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  await analysis.getByRole('button',{name:'手机使用',exact:true}).click();
  await expect(analysis.getByRole('img')).toHaveAccessibleName('手机使用与统计学成绩散点图，共 22 对完整观测');
  await expect(analysis).not.toContainText('0.556');await expect(analysis.getByRole('link',{name:'打开数据分析',exact:true})).toHaveAttribute('href','/data');
  const writing=page.getByRole('region',{name:'落笔之前',exact:true});await expect(writing.getByRole('article')).toHaveCount(3);await expect(writing.getByRole('link',{name:'打开研究项目',exact:true})).toHaveAttribute('href','/projects');
  await expect(page.locator('.module-grid .module-card')).toHaveCount(4);await expect(page.locator('.acaora-footer')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  expect(runtimeErrors).toEqual([]);
  await mkdir('outputs/home-introduction-2026-10-26',{recursive:true});
  await page.screenshot({path:`outputs/home-introduction-2026-10-26/home-${width}.png`,fullPage:true,animations:'disabled'});
  await analysis.screenshot({path:`outputs/home-introduction-2026-10-26/analysis-${width}.png`,animations:'disabled'});
  await writing.screenshot({path:`outputs/home-introduction-2026-10-26/writing-${width}.png`,animations:'disabled'});
  if(width===1440){
    await page.emulateMedia({reducedMotion:'no-preference'});
    await analysis.getByRole('button',{name:'睡眠时长',exact:true}).click();
    const motion=await analysis.locator('[data-point-id="S01"]').evaluate(el=>{
      const animation=el.getAnimations()[0];
      if(!animation)return null;
      animation.pause();animation.currentTime=55;
      const start=getComputedStyle(el).transform;animation.finish();
      return {duration:getComputedStyle(el).transitionDuration,interpolates:start!==getComputedStyle(el).transform};
    });
    expect(motion).toEqual({duration:'0.55s, 0.15s',interpolates:true});
    await page.evaluate(()=>{document.documentElement.dataset.interfaceMotion='off';});
    expect(await analysis.locator('[data-point-id="S01"]').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  }
});

test.describe('touch scatter preview',()=>{
  test.use({hasTouch:true,viewport:{width:390,height:844}});
  test('tap fixes a real record without overflowing the chart',async({page})=>{
    await installApiMocks(page);await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
    const analysis=page.getByRole('region',{name:'变量之间',exact:true});
    await analysis.getByRole('button',{name:'探索散点'}).scrollIntoViewIfNeeded();
    const bounds=await analysis.locator('[data-point-id="S11"] circle').boundingBox();expect(bounds).not.toBeNull();
    await page.touchscreen.tap(bounds!.x+bounds!.width/2,bounds!.y+bounds!.height/2);
    await expect(analysis.getByRole('status')).toContainText('S11');await expect(analysis.getByRole('status')).toContainText('94 分');
    await expect(analysis.getByRole('button',{name:'探索散点'})).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await analysis.screenshot({path:'outputs/home-introduction-2026-10-26/analysis-touch.png',animations:'disabled'});
    await analysis.getByRole('button',{name:'取消固定'}).tap();await expect(analysis.getByRole('status')).toHaveCount(0);
  });
});
