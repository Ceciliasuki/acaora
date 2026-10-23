import {expect, test} from '@playwright/test';
import {installApiMocks} from './helpers';
import {mkdir} from 'node:fs/promises';

test('home hover responds and restores the current pose, including reduced motion', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  const title=page.locator('.home-title-line > span').first();
  await expect.poll(()=>title.evaluate(el=>el.getAnimations().length)).toBe(0);
  const originalTitle=await title.evaluate(el=>getComputedStyle(el).transform);
  await title.hover();
  await expect.poll(()=>title.evaluate(el=>getComputedStyle(el).transform)).not.toBe(originalTitle);
  await page.mouse.move(0,0);
  await expect.poll(()=>title.evaluate(el=>getComputedStyle(el).transform)).toBe(originalTitle);
  const source=page.getByRole('figure',{name:'原文与笔记示例'}).locator('blockquote').locator('..');
  const note=page.getByRole('heading',{name:'我的笔记',exact:true}).locator('..');
  for(const surface of [source,note]) {
    const pose=()=>surface.evaluate(el=>{const s=getComputedStyle(el);return [s.translate,s.rotate,s.scale,s.transform];});
    const initial=await pose();
    await surface.hover();
    await expect.poll(pose).not.toEqual(initial);
    await page.mouse.move(0,0);
    await expect.poll(pose).toEqual(initial);
  }
  const row=page.getByRole('link',{name:'课程学习 阅读课程讲解、完成练习，继续学习进度。'});
  const heading=row.locator('h3');
  const initial=await heading.evaluate(el=>getComputedStyle(el).transform);
  await row.hover();
  await expect.poll(()=>heading.evaluate(el=>getComputedStyle(el).transform)).not.toBe(initial);
  await mkdir('outputs/reference-motion',{recursive:true});
  await page.screenshot({path:'outputs/reference-motion/hover-entry.png'});
  await page.mouse.move(0,0);
  await expect.poll(()=>heading.evaluate(el=>getComputedStyle(el).transform)).toBe(initial);
  await page.emulateMedia({reducedMotion:'reduce'});
  await source.scrollIntoViewIfNeeded();
  const still=await source.evaluate(el=>{const s=getComputedStyle(el);return [s.translate,s.rotate,s.scale,s.transform];});
  await source.hover();
  await expect.poll(()=>source.evaluate(el=>{const s=getComputedStyle(el);return [s.translate,s.rotate,s.scale,s.transform];})).toEqual(still);
});

for (const width of [1440, 375]) test(`homepage demonstration remains usable at ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: 900});
  await page.goto('/');
  const demo = page.getByRole('figure', {name: '原文与笔记示例'});
  const original = await demo.locator('blockquote').innerText();
  await page.getByRole('button', {name: '播放示例', exact: true}).click();
  await expect(demo).toHaveAttribute('data-demo-step', '2');
  await page.getByRole('button', {name: '重播示例', exact: true}).click();
  await page.getByRole('button', {name: '1 阅读原文', exact: true}).click();
  await expect(demo).toHaveAttribute('data-demo-step', '0');
  await expect(demo.locator('blockquote')).toHaveText(original);
  await page.getByRole('button', {name: '2 标出关键句', exact: true}).click();
  await expect(demo.locator('mark')).toHaveAttribute('data-emphasized', 'true');
  await expect(page.getByRole('link', {name: '打开示例工作台，核对原文'})).toHaveAttribute('href', '/papers?view=reader&paper=sample-paper');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('outputs/reference-motion', {recursive: true});
  await page.screenshot({path: `outputs/reference-motion/home-${width}.png`, fullPage: true});
});

test('live reduced motion stops demonstration and leaves every step readable', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: '播放示例', exact: true}).click();
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('[data-demo-step]')).toHaveAttribute('data-demo-step', '2');
  await expect(page.getByRole('button', {name: '重播示例', exact: true})).toBeVisible();
  await expect.poll(() => page.locator('.home-motion').evaluate(root => root.getAnimations({subtree:true}).length)).toBe(0);
  await page.getByRole('button', {name: '1 阅读原文', exact: true}).click();
  await expect(page.locator('[data-demo-step]')).toHaveAttribute('data-demo-step', '0');
});

test('source and new annotation share temporary feedback without changing text', async ({page}) => {
  const text = 'Original evidence remains stable during navigation and annotation. '.repeat(15);
  const paper = {id:'cue-paper', title:'Cue example', fileName:'cue.pdf', addedAt:1,updatedAt:1,activeParagraph:0,
    paragraphs:['Introduction','Methods'].map((section,index)=>({id:`cue-${index}`,section,page:index+1,original:text,translation:'',note:'',read:false,bookmarked:false,annotations:[]}))};
  await page.setViewportSize({width:1440,height:900});
  await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library:false,notes:true})));
  await installApiMocks(page, {signedIn:true,cloudPapers:[paper]});
  await page.goto('/papers?view=reader');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button',{name:'Methods',exact:true}).click();
  const source = page.locator('[data-paragraph-index="1"] [data-original-text]');
  await expect(source).toHaveAttribute('data-reading-cue','true');
  await expect(source).toHaveText(text);
  await page.getByRole('button',{name:'批注当前段落',exact:true}).click();
  await page.getByLabel('批注内容',{exact:true}).fill('核对原文依据');
  await page.getByRole('button',{name:'保存批注',exact:true}).click();
  await expect(page.locator('.annotation-entry[data-reading-cue="true"]')).toHaveCount(1);
  await expect(page.locator('[data-original-text] [data-reading-cue="true"]')).toHaveCount(1);
  const id = await page.locator('.annotation-entry').getAttribute('data-annotation-id');
  await expect(page.locator('[data-original-text] [data-reading-cue="true"]')).toHaveAttribute('data-annotation-id', id!);
  await expect(source).toHaveText(text);
  expect(await source.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await expect.poll(() => page.locator('[data-reading-cue="true"]').count()).toBe(0);
});

test('data guide explains steps without changing the current dataset', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/data');
  await page.getByText('分析步骤',{exact:true}).click();
  await page.getByRole('button',{name:'3 选择方法',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'按研究问题选择估计方法'})).toBeVisible();
  await expect(page.getByRole('button',{name:'3 选择方法',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('course guide is optional and keeps the course entry available', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/courses/STAT-201');
  await page.getByText('学习步骤',{exact:true}).click();
  await page.getByRole('button',{name:'2 看例题',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'沿着例题核对条件'})).toBeVisible();
  await expect(page.getByRole('link',{name:'开始学习概率论与数理统计',exact:true})).toHaveAttribute('href','/courses/STAT-201/lesson-1');
});
