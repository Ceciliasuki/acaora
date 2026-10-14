import {expect, test} from '@playwright/test';
import {installApiMocks} from './helpers';
import {mkdir} from 'node:fs/promises';

const paper = {id: 'motion-reader', title: 'Reading continuity example', fileName: 'example.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: ['Introduction', 'Methods', 'Results'].map((section, index) => ({id: `motion-${index}`, page: index + 1, section,
    original: 'Example reading text for checking motion and position continuity. '.repeat(20), translation: '', note: '', bookmarked: false, read: false}))};

test('Paper margins interrupt cleanly and never scale or move type vertically', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.getByRole('button', {name: 'Methods', exact: true}).click();
  const paragraph = page.locator('[data-paragraph-id="motion-1"]');
  await expect(paragraph).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByLabel('段落笔记').fill('Keep this draft across interrupted transitions.');
  // Real event dispatch in successive frames avoids Playwright waiting out motion.
  const frames = await page.evaluate(async () => {
    const button = document.querySelector<HTMLButtonElement>('[aria-controls="paper-library"]')!;
    const samples: number[][] = [];
    for (let index = 0; index < 5; index++) {
      button.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      const reader = document.querySelector<HTMLElement>('#paper-reader')!;
      const matrix = new DOMMatrixReadOnly(getComputedStyle(reader).transform);
      samples.push([matrix.a, matrix.d, matrix.f, document.querySelector('#paper-library')!.getAnimations().length]);
    }
    return samples;
  });
  expect(frames.some(sample => sample[3] > 0)).toBe(true);
  expect(frames.every(sample => sample[0] === 1 && sample[1] === 1 && sample[2] === 0)).toBe(true);
  await expect.poll(() => page.locator('#paper-reader').evaluate(el => el.getAnimations().length)).toBe(0);
  await expect(paragraph).toHaveAttribute('data-active', 'true');
  await expect(page.getByLabel('段落笔记')).toHaveValue('Keep this draft across interrupted transitions.');
  const libraryTitle = await page.locator('.plab-index-open strong').boundingBox();
  const filename = await page.locator('.paper-library-filename').boundingBox();
  expect(libraryTitle!.width).toBeGreaterThan(60);
  expect(filename!.y).toBeGreaterThan(libraryTitle!.y + libraryTitle!.height);
  await page.getByRole('button', {name: '收起论文库', exact: true}).click();
  await page.getByRole('button', {name: 'Results', exact: true}).click();
  const chapters = page.getByRole('navigation', {name: '论文章节'});
  await expect.poll(() => chapters.locator('.motion-navigation-marker').evaluate(el => el.getAnimations().length)).toBe(0);
  const selected = await chapters.getByRole('button', {name: 'Results'}).boundingBox();
  const marker = await chapters.locator('.motion-navigation-marker').boundingBox();
  expect(Math.abs(marker!.x - selected!.x)).toBeLessThan(1);
  expect(Math.abs(marker!.width - selected!.width)).toBeLessThan(1);
  await page.mouse.move(1380, 80);
  await expect(page.getByRole('button', {name: '展开或收起主导航'})).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => page.locator('#app-sidebar').evaluate(el => el.getAnimations({subtree: true}).length)).toBe(0);
  expect((await page.locator('#app-sidebar').boundingBox())!.width).toBeLessThanOrEqual(73);
  await mkdir('outputs/papers-motion-2026-10-13', {recursive: true});
  await page.screenshot({path: 'outputs/papers-motion-2026-10-13/margins-desktop.png', animations: 'disabled'});
});

test('Live reduced motion cancels movement while retaining selected state', async ({page}) => {
  await installApiMocks(page);
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(/Statistical learning/);
  await page.evaluate(() => document.querySelector<HTMLButtonElement>('[aria-controls="paper-library"]')!.click());
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('#paper-library')).toBeVisible();
  await expect.poll(() => page.locator('.plab-shell').evaluate(el => el.getAnimations({subtree: true}).length)).toBe(0);
  await page.getByRole('button', {name: '学术检索', exact: true}).click();
  await expect(page.getByLabel('论文检索关键词')).toBeVisible();
  expect(await page.locator('.plab-shell').evaluate(el => el.getAnimations({subtree: true}).length)).toBe(0);
});

test('Mobile transitions retain a query and respond immediately to rapid tab changes', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await installApiMocks(page);
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(/Statistical learning/);
  const tabs = page.getByRole('tablist', {name: '论文工作台面板'});
  await tabs.getByRole('tab', {name: '检索', exact: true}).click();
  await page.getByLabel('论文检索关键词').fill('Continuity test query');
  const overflow = await page.evaluate(async () => {
    const samples: number[] = [];
    for (const id of ['paper-tab-reader', 'paper-tab-ai', 'paper-tab-library', 'paper-tab-search']) {
      document.getElementById(id)!.click();
      await new Promise(resolve => requestAnimationFrame(resolve));
      samples.push(document.documentElement.scrollWidth - innerWidth);
    }
    return samples;
  });
  expect(overflow.every(pixels => pixels <= 1)).toBe(true);
  await expect(tabs.getByRole('tab', {name: '检索', exact: true})).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('论文检索关键词')).toHaveValue('Continuity test query');
  await expect.poll(() => page.locator('#paper-search').evaluate(el => el.getAnimations().length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir('outputs/papers-motion-2026-10-13', {recursive: true});
  await page.screenshot({path: 'outputs/papers-motion-2026-10-13/search-mobile.png', fullPage: true});
});
