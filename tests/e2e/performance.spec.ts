import {expect, test} from '@playwright/test';
import {installApiMocks} from './helpers';

const paper = {
  id: 'performance-paper', title: 'Controlled performance paper', fileName: 'performance.pdf',
  addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: Array.from({length: 80}, (_, index) => ({
    id: `performance-${index}`, page: index + 1, section: `Section ${index}`,
    original: 'A controlled paragraph for measuring reading and persistence costs. '.repeat(15),
    translation: '', note: '', read: false, bookmarked: false,
  })),
};

test('PERF-01 idle workspace does not continuously render a decorative background', async ({page}, testInfo) => {
  await installApiMocks(page, {signedIn: true});
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.setViewportSize({width: 1600, height: 900});
  await page.addInitScript(() => {
    let draws = 0;
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {draws++; return draw.apply(this, args);};
    Object.defineProperty(window, '__backgroundDraws', {get: () => draws});
  });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', {name: '总览', exact: true})).toBeVisible();
  await expect(page.locator('.light-curtain canvas')).toHaveAttribute('data-motion', /paused|unavailable/);
  const start = await page.evaluate(() => (window as unknown as {__backgroundDraws: number}).__backgroundDraws);
  await page.waitForTimeout(2000);
  const draws = await page.evaluate(() => (window as unknown as {__backgroundDraws: number}).__backgroundDraws) - start;
  await testInfo.attach('background-cost', {body: JSON.stringify({intervalMs: 2000, draws}), contentType: 'application/json'});
  expect(draws).toBe(0);
  if (await page.locator('.light-curtain canvas').getAttribute('data-motion') !== 'unavailable') {
    await expect(page.getByRole('button', {name: '开启背景动效'})).toBeVisible();
  }
});

test('PERF-02 reading position survives reload without full-paper uploads at each pause', async ({page}, testInfo) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  const start = state.requests.length;
  for (const index of [2, 4, 6]) {
    await page.getByRole('button', {name: `Section ${index}`, exact: true}).click();
    await expect(page.locator(`[data-paragraph-index="${index}"]`)).toHaveAttribute('data-active', 'true');
    await page.waitForTimeout(700);
  }
  const requests = state.requests.slice(start);
  await testInfo.attach('reading-cost', {body: JSON.stringify({requests}), contentType: 'application/json'});
  expect(requests.filter(value => value === 'PUT /api/cloud/papers')).toHaveLength(0);
  expect(requests.filter(value => value === 'GET /api/profile')).toHaveLength(0);
  await page.reload();
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('[data-paragraph-index="6"]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByLabel('段落笔记').fill('Content edits must still be saved promptly.');
  await expect.poll(() => state.requestBodies.some(value => (value as typeof paper).paragraphs?.[6]?.note === 'Content edits must still be saved promptly.')).toBe(true);
});

test('PERF-03 note saving does not reload the sidebar profile', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.sidebar-profile-link')).toContainText('测试同学');
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  await page.waitForTimeout(300);
  const count = state.requests.filter(value => value === 'GET /api/profile').length;
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByLabel('段落笔记').fill('A small edit.');
  await expect.poll(() => state.requests.includes('PUT /api/cloud/papers')).toBe(true);
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  await page.waitForTimeout(300);
  expect(state.requests.filter(value => value === 'GET /api/profile')).toHaveLength(count);
});

test('PERF-04 scrolling during a pending note save preserves the latest cursor', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByLabel('段落笔记').fill('A note saved while reading continues.');
  await page.getByRole('button', {name: 'Section 4', exact: true}).click();
  await expect(page.locator('[data-paragraph-index="4"]')).toHaveAttribute('data-active', 'true');
  await expect.poll(() => (state.requestBodies.at(-1) as typeof paper | undefined)?.activeParagraph).toBe(4);
  await page.reload();
  await expect(page.locator('[data-paragraph-index="4"]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', {name: 'Section 0', exact: true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('A note saved while reading continues.');
});

test('PERF-05 switching papers restores the target device cursor before updating recency', async ({page}) => {
  const other = {...paper, id: 'performance-other', title: 'Other controlled paper'};
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper, other]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  // The target cursor may have been saved immediately before a previous tab
  // closed, before the interval could upload a complete PaperRecord.
  await page.evaluate(({id, addedAt}) => localStorage.setItem(`acaora:reading-position:${JSON.stringify(['user-e2e', id, addedAt])}`, JSON.stringify({index: 6, updatedAt: Date.now()})), other);
  await page.getByRole('button', {name: '论文库', exact: true}).click();
  await page.getByRole('button', {name: `${other.title} 80 段 · 已读 0%`, exact: true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(other.title);
  await expect(page.locator('[data-paragraph-index="6"]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', {name: `${paper.title} 80 段 · 已读 0%`, exact: true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: `${other.title} 80 段 · 已读 0%`, exact: true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(other.title);
  await expect(page.locator('[data-paragraph-index="6"]')).toHaveAttribute('data-active', 'true');
});

test('PERF-06 continuous reading commits its latest position once per interval', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  await page.clock.install();
  await page.getByRole('button', {name: 'Section 2', exact: true}).click();
  await page.getByRole('button', {name: 'Section 6', exact: true}).click();
  expect(state.requests.filter(value => value === 'PUT /api/cloud/papers')).toHaveLength(0);
  await page.clock.fastForward(15_000);
  await expect.poll(() => (state.requestBodies.at(-1) as typeof paper | undefined)?.activeParagraph).toBe(6);
  expect(state.requests.filter(value => value === 'PUT /api/cloud/papers')).toHaveLength(1);
});

test('PERF-07 editing notes does not snap the reader back to the paragraph start', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByRole('button', {name: 'Section 4', exact: true}).click();
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await reader.hover();
  await page.mouse.wheel(0, 80);
  await page.waitForTimeout(200);
  const scrollTop = await reader.evaluate(node => node.scrollTop);
  await page.getByLabel('段落笔记').fill('Editing must leave the scroll position steady.');
  await expect.poll(() => state.requestBodies.length).toBeGreaterThan(0);
  expect(await reader.evaluate(node => node.scrollTop)).toBeCloseTo(scrollTop, 0);
});

test('PERF-08 an account switch cancels the pending cursor commit and isolates device history', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  await page.clock.install();
  await page.getByRole('button', {name: 'Section 6', exact: true}).click();
  await expect(page.locator('[data-paragraph-index="6"]')).toHaveAttribute('data-active', 'true');
  state.userId = 'other-performance-user';
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(page.locator('[data-paragraph-index="0"]')).toHaveAttribute('data-active', 'true');
  await page.clock.fastForward(16_000);
  await page.waitForTimeout(700);
  expect(state.requests.filter(value => value === 'PUT /api/cloud/papers')).toHaveLength(0);
});
