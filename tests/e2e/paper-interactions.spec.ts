import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installApiMocks} from './helpers';
import AxeBuilder from '@axe-core/playwright';

const paper = {id: 'interaction-proof', title: 'A controlled reading study: evidence and careful comparison', fileName: 'interaction-proof.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: Array.from({length: 12}, (_, index) => ({id: `interaction-${index}`, page: index + 1, section: ['Introduction', 'Methods', 'Results'][Math.floor(index / 4)], original: `Source paragraph ${index + 1}. ` + 'A reader can examine this controlled example and return to its source without losing the thread of the argument. '.repeat(8), translation: '', note: index === 0 ? 'Existing note at the beginning.' : '', bookmarked: index === 0, read: false}))};

test('Source peek preserves position, owns keyboard focus and navigates only on request', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.getByRole('heading', {name: paper.title, exact: true})).toBeInViewport();
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  const before = await reader.evaluate(el => el.scrollTop);
  const trigger = page.locator('.paper-note-source').getByRole('button', {name: '预览原文第 1 段'});
  await trigger.press('Enter');
  const preview = page.getByRole('dialog', {name: '原文预览：第 1 段'});
  await expect(preview).toBeVisible();
  await expect(preview).toBeFocused();
  const peekBounds = await preview.boundingBox(), triggerBounds = await trigger.boundingBox();
  expect(peekBounds!.y + peekBounds!.height <= triggerBounds!.y || peekBounds!.y >= triggerBounds!.y + triggerBounds!.height).toBe(true);
  await expect(preview.locator('blockquote')).toHaveText(paper.paragraphs[0].original);
  expect(await reader.evaluate(el => el.scrollTop)).toBe(before);
  await preview.press('Escape');
  await expect(preview).toBeHidden(); await expect(trigger).toBeFocused();
  await trigger.press('Enter');
  await preview.getByRole('button', {name: '定位正文', exact: true}).click();
  await expect(preview).toBeHidden();
  await expect(page.getByRole('button', {name: '返回刚才的位置'})).toBeVisible();
});

test('Reading trail returns to an exact paragraph offset and is scoped to the source', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper, {...paper, id: 'other-reading-source', title: 'Another controlled source'}]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await reader.evaluate(el => {el.scrollTop = 480;});
  await expect(page.locator('[data-paragraph-index="0"]')).toHaveAttribute('data-active', 'true');
  const top = await reader.evaluate(el => el.scrollTop);
  await page.getByRole('button', {name: 'Results', exact: true}).click();
  await expect(page.locator('[data-paragraph-index="8"]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', {name: '返回刚才的位置'}).click();
  await expect.poll(async () => Math.abs(await reader.evaluate(el => el.scrollTop) - top)).toBeLessThan(2);
  await page.getByRole('button', {name: 'Methods', exact: true}).click();
  await page.getByRole('button', {name: '论文库', exact: true}).click();
  await page.locator('.plab-index-open').filter({hasText: 'Another controlled source'}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue('Another controlled source');
  await expect(page.getByRole('button', {name: '返回刚才的位置'})).toBeHidden();
});

test('Returning to an AI report also restores the hidden reader anchor', async ({page}) => {
  const source = {...paper, aiMemory: {paragraph: {}, chats: [], summary: {action: 'summary', title: 'Saved controlled summary', data: {answer: 'Check [P9] before continuing.'}, createdAt: 1}}};
  await installApiMocks(page, {signedIn: true, cloudPapers: [source]});
  await page.goto('/papers'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await reader.evaluate(el => {el.scrollTop = 480;});
  const top = await reader.evaluate(el => el.scrollTop);
  await page.getByRole('button', {name: 'AI 分析', exact: true}).click();
  await page.getByRole('tab', {name: '全文报告', exact: true}).click();
  await page.getByRole('button', {name: '查看原文 P9', exact: true}).click();
  await expect(page.locator('[data-paragraph-index="8"]')).toHaveAttribute('data-active', 'true');
  await page.getByRole('button', {name: '返回刚才的位置'}).click();
  await expect(page.getByRole('button', {name: 'AI 分析', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', {name: '阅读与笔记', exact: true}).click();
  await expect.poll(async () => Math.abs(await reader.evaluate(el => el.scrollTop) - top)).toBeLessThan(2);
});

test('Pinned notes edit their own source while the reader moves', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByRole('button', {name: '固定笔记', exact: true}).click();
  await page.getByRole('button', {name: 'Results', exact: true}).click();
  await expect(page.locator('.plab-reading-context')).toContainText('Introduction');
  await page.getByLabel('段落笔记').fill('Pinned to the first source paragraph.');
  await expect(page.locator('.plab-rail-head')).toContainText('已保存到设备');
  const written = () => (state.requestBodies as Array<typeof paper>).filter(item => item.id === paper.id).at(-1);
  await expect.poll(() => written()?.paragraphs[0].note).toBe('Pinned to the first source paragraph.');
  expect(written()?.paragraphs[8].note).toBe('');
  await page.getByRole('button', {name: '取消固定', exact: true}).click();
  await expect(page.locator('.plab-reading-context')).toContainText('Results');
});

test('Analyzing a pinned note keeps its context and a route back to the prior reading position', async ({page}) => {
  const source = {...paper, aiMemory: {paragraph: {}, chats: [], summary: {action: 'summary', title: 'Controlled summary', data: {answer: 'Source P9.'}, createdAt: 1}}};
  await installApiMocks(page, {signedIn: true, cloudPapers: [source]});
  await page.goto('/papers'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByRole('button', {name: '固定笔记', exact: true}).click();
  await page.getByRole('button', {name: 'Results', exact: true}).click();
  await page.getByRole('button', {name: '分析当前段落', exact: true}).click();
  await expect(page.locator('.ai-console-context')).toContainText('1 / 12');
  await page.getByRole('tab', {name: '全文报告', exact: true}).click();
  await page.getByRole('button', {name: '查看原文 P9', exact: true}).click();
  await page.getByRole('button', {name: '返回刚才的位置'}).click();
  await expect(page.locator('.ai-console-context')).toContainText('1 / 12');
  await page.getByRole('button', {name: '阅读与笔记', exact: true}).click();
  await page.getByRole('button', {name: '返回刚才的位置'}).click();
  await expect(page.locator('[data-paragraph-index="8"]')).toHaveAttribute('data-active', 'true');
});

test('Desktop library Escape works from the trigger and AI tabs follow keyboard semantics', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  const trigger = page.getByRole('button', {name: '论文库', exact: true});
  await trigger.click();
  await expect(page.getByRole('button', {name: '收起论文库'})).toBeFocused();
  await trigger.press('Escape');
  await expect(page.locator('#paper-library')).toBeHidden(); await expect(trigger).toBeFocused();
  await page.getByRole('button', {name: 'AI 分析', exact: true}).click();
  const tabs = page.getByRole('tablist', {name: 'AI 研究功能'});
  await tabs.getByRole('tab', {name: '段落拆解'}).press('ArrowRight');
  await expect(tabs.getByRole('tab', {name: '全文报告'})).toBeFocused();
  await expect(tabs.getByRole('tab', {name: '全文报告'})).toHaveAttribute('aria-selected', 'true');
  expect(await tabs.locator('[tabindex="0"]').count()).toBe(1);
  await expect(page.getByRole('tabpanel', {name: '全文报告'})).toBeVisible();
});

test('Explicit title editing can cancel without modifying the paper and confirms a real save', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.getByRole('heading', {name: paper.title, exact: true})).toBeVisible();
  await expect(page.getByLabel('论文标题')).toHaveAttribute('readonly', '');
  await page.getByRole('button', {name: '编辑标题', exact: true}).click();
  await page.getByLabel('论文标题').fill('Cancelled draft'); await page.getByLabel('论文标题').press('Escape');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '编辑标题', exact: true}).click();
  await page.getByLabel('论文标题').fill('Confirmed title'); await page.getByRole('button', {name: '保存标题'}).click();
  await expect.poll(() => (state.requestBodies as Array<typeof paper>).filter(item => item.id === paper.id).at(-1)?.title).toBe('Confirmed title');
});

for (const width of [1024,1440]) test(`Desktop at ${width}px fits the window with notes and offers adjustable type @a11y`, async ({page}) => {
  await page.setViewportSize({width, height: 768});
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByLabel('正文字号').selectOption('22');
  await expect(page.locator('.plab-body')).toHaveCSS('font-size', '22px');
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  expect(await page.locator('.plab-workbench').evaluate(el => el.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  const results = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(results.violations.filter(v => ['serious','critical'].includes(v.impact ?? ''))).toEqual([]);
  await mkdir('outputs/papers-interactions-2026-10-14', {recursive: true});
  await page.screenshot({path: `outputs/papers-interactions-2026-10-14/desktop-${width}.png`, animations: 'disabled'});
});

test('Demo notes describe their actual lifetime', async ({page}) => {
  await installApiMocks(page); await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(/Statistical learning/);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await expect(page.locator('.plab-rail-head')).toContainText('本次演示有效');
  await expect(page.getByRole('status').filter({hasText: '示例演示'})).toBeVisible();
});

test('A failed device write is reported and can be retried without losing the note', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    (window as typeof window & {restorePaperPut?: () => void}).restorePaperPut = () => {IDBObjectStore.prototype.put = original;};
    IDBObjectStore.prototype.put = function(value, key) {
      if (this.name === 'papers') throw new DOMException('Controlled device quota failure', 'QuotaExceededError');
      return key === undefined ? original.call(this, value) : original.call(this, value, key);
    };
  });
  await page.getByLabel('段落笔记').fill('Keep this note through a failed local save.');
  await expect(page.locator('.plab-rail-head')).toContainText('设备保存未完成');
  await expect(page.getByLabel('段落笔记')).toHaveValue('Keep this note through a failed local save.');
  await page.evaluate(() => (window as typeof window & {restorePaperPut?: () => void}).restorePaperPut?.());
  await page.getByRole('button', {name: '重试保存', exact: true}).click();
  await expect(page.locator('.plab-rail-head')).toContainText('已保存到设备');
  await page.reload(); await expect(page.getByLabel('段落笔记')).toHaveValue('Keep this note through a failed local save.');
});
