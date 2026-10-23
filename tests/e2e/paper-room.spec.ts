import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installApiMocks} from './helpers';

const paper = {id: 'reading-room', title: 'Evidence, uncertainty and the practice of careful reading', fileName: 'reading-room-example.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: ['Introduction', 'Methods', 'Results'].map((section, index) => ({id: `room-${index}`, page: index + 1, section,
    original: 'This example examines how research evidence is interpreted. A useful reading environment lets the reader return to the source, compare the method with the conclusion, and record an independent judgment. '.repeat(6),
    translation: '', note: '', bookmarked: false, read: false}))};

for (const width of [1440, 1024]) {
  test(`Reading room at ${width}px keeps title in the paper and library out of its measure`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library: true, notes: false})));
    await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
    await page.goto('/papers?view=reader');
    const title = page.getByLabel('论文标题');
    await expect(title).toHaveValue(paper.title);
    await expect(page.locator('#paper-library')).toBeHidden();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await title.evaluate(el => Boolean(el.closest('[aria-label="论文正文"]')))).toBe(true);
    const reader = page.getByRole('region', {name: '论文正文', exact: true});
    const before = await reader.boundingBox();
    await page.getByRole('button', {name: '论文库', exact: true}).click();
    await expect(page.locator('#paper-library')).toBeVisible();
    const after = await reader.boundingBox();
    expect(Math.abs(before!.width - after!.width)).toBeLessThan(2);
    await page.getByRole('button', {name: '收起论文库'}).press('Escape');
    await expect(page.locator('#paper-library')).toBeHidden();
    await expect(page.getByRole('button', {name: '论文库', exact: true})).toBeFocused();
    await page.getByRole('button', {name: 'Results', exact: true}).click();
    await expect(title).not.toBeInViewport();
    await expect(page.getByRole('navigation', {name: '论文章节'})).toBeInViewport();
    await page.getByRole('button', {name: '笔记', exact: true}).click();
    await expect(page.locator('.plab-reading-context')).toContainText('Results');
    await page.getByLabel('段落笔记').fill('Return to the source before accepting this conclusion.');
    await expect(page.getByLabel('段落笔记')).toHaveValue('Return to the source before accepting this conclusion.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await mkdir('outputs/papers-room-2026-10-14', {recursive: true});
    await page.screenshot({path: `outputs/papers-room-2026-10-14/notes-${width}.png`, animations: 'disabled'});
    await page.getByRole('button', {name: '专注阅读', exact: true}).click();
    await reader.evaluate(el => {el.scrollTop = 0;});
    await expect(title).toBeInViewport();
    await page.screenshot({path: `outputs/papers-room-2026-10-14/reader-${width}.png`, animations: 'disabled'});
    await page.getByRole('button', {name: '学术检索', exact: true}).click();
    await expect(page.getByLabel('论文检索关键词')).toBeVisible();
    await page.screenshot({path: `outputs/papers-room-2026-10-14/search-${width}.png`, animations: 'disabled'});
  });
}

test('Reading room on mobile keeps all tools reachable without changing the paper', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers?view=reader');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await mkdir('outputs/papers-room-2026-10-14', {recursive: true});
  await page.screenshot({path: 'outputs/papers-room-2026-10-14/reader-mobile.png', fullPage: true, animations: 'disabled'});
  const tabs = page.getByRole('tablist', {name: '论文工作台面板'});
  await tabs.getByRole('tab', {name: '论文库', exact: true}).click();
  await page.locator('.plab-index-open').click();
  await expect(tabs.getByRole('tab', {name: '阅读', exact: true})).toHaveAttribute('aria-selected', 'true');
  await tabs.getByRole('tab', {name: '阅读', exact: true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await tabs.getByRole('tab', {name: '笔记', exact: true}).click();
  await page.getByLabel('段落笔记').fill('A mobile reading note.');
  await page.screenshot({path: 'outputs/papers-room-2026-10-14/notes-mobile.png', fullPage: true, animations: 'disabled'});
  await tabs.getByRole('tab', {name: '检索', exact: true}).click();
  await expect(page.getByLabel('论文检索关键词')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({path: 'outputs/papers-room-2026-10-14/search-mobile.png', fullPage: true, animations: 'disabled'});
});

test('Entering the reading room suspends the hidden light field and restores its preference on return', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await installApiMocks(page, {signedIn: true});
  await page.goto('/dashboard');
  const canvas = page.locator('.light-curtain canvas');
  await expect(canvas).toHaveAttribute('data-motion', /paused|unavailable/);
  const available = await canvas.getAttribute('data-motion') !== 'unavailable';
  await page.getByRole('button', {name: '开启背景动效'}).click();
  if (available) await expect(canvas).toHaveAttribute('data-motion', 'running');
  await page.locator('#app-sidebar').getByRole('link', {name: '论文研究', exact: true}).click();
  await page.getByRole('button', {name: '打开示例论文', exact: true}).click();
  await expect(page.getByLabel('论文标题')).toBeVisible();
  await expect(page.locator('.light-curtain')).toBeHidden();
  await expect(page.getByRole('button', {name: '暂停背景动效'})).toBeHidden();
  if (available) await expect(canvas).toHaveAttribute('data-motion', 'hidden');
  await page.locator('#app-sidebar').getByRole('link', {name: '总览', exact: true}).click();
  await expect(page.getByRole('heading', {name: '总览', exact: true})).toBeVisible();
  await expect(page.locator('.light-curtain')).toBeVisible();
  await expect(page.getByRole('button', {name: '暂停背景动效'})).toBeVisible();
  if (available) await expect(canvas).toHaveAttribute('data-motion', 'running');
});
