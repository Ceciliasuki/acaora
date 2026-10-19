import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks, openPaperLibrary} from './helpers';

const sections = ['Introduction', 'Study population', 'Estimation methods', 'Robustness checks', 'Discussion', 'Conclusion'];
const paper = {id: 'reader-navigation-proof', title: 'Reading research evidence with context', fileName: 'reader-navigation-proof.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: Array.from({length: 24}, (_, index) => ({id: `nav-${index}`, page: Math.floor(index / 2) + 1, section: sections[Math.floor(index / 4)],
    original: `Evidence sample ${index + 1}. ` + 'The study compares model estimates and discusses uncertainty, validation and limitations. '.repeat(5),
    translation: '', note: index === 0 ? 'Existing source note.' : '', bookmarked: index === 0, read: false,
    annotations: index < 3 ? [{id: `mark-${index}`, start: 0, end: 8, quote: 'Evidence', comment: index === 1 ? '' : `Check estimate ${index + 1}`, color: ['yellow', 'blue', 'green'][index], createdAt: 100 + index}] : []}))};

test('literal find highlights original text across annotation boundaries and cycles without taking input focus', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  const original = page.locator('[data-paragraph-index="0"] [data-original-text]');
  await page.getByRole('button', {name: '文内查找', exact: true}).click();
  const find = page.getByRole('region', {name: '文内查找', exact: true});
  const input = find.getByRole('searchbox');
  await input.fill('Evidence sample');
  await expect(find.getByRole('status')).toContainText('24 个段落匹配');
  await expect(original).toHaveText(paper.paragraphs[0].original);
  await expect(original.locator('mark')).toHaveCount(2);
  await input.press('Enter');
  await input.press('Enter');
  await expect(page.locator('[data-paragraph-index="1"]')).toHaveAttribute('data-active', 'true');
  await expect(input).toBeFocused();
  await input.press('Shift+Enter');
  await expect(page.locator('[data-paragraph-index="0"]')).toHaveAttribute('data-active', 'true');
  await input.fill('[P999]');
  await expect(find.getByRole('status')).toContainText('原文中没有匹配');
  await expect(find.getByRole('button', {name: '下一个匹配段落'})).toBeDisabled();
  await input.fill('evidence');
  await find.getByLabel('区分大小写').check();
  await expect(find.getByRole('status')).toContainText('原文中没有匹配');
  await find.getByRole('button', {name: '清除查找与高亮'}).click();
  await expect(page.locator('[data-original-text] mark')).toHaveCount(0);
  await input.press('Escape');
  await expect(find).toBeHidden();
  await expect(page.getByRole('button', {name: '文内查找', exact: true})).toBeFocused();
});

test('filterable chapter directory jumps to the source and uses the existing return trail', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '章节目录', exact: true}).click();
  const directory = page.getByRole('region', {name: '章节目录', exact: true});
  await expect(directory.getByRole('navigation').getByRole('button')).toHaveCount(6);
  await directory.getByRole('searchbox').fill('conclusion');
  await expect(directory.getByRole('navigation').getByRole('button')).toHaveCount(1);
  await directory.getByRole('button', {name: 'Conclusion 第 11 页 · 4 段'}).click();
  await expect(directory).toBeHidden();
  await expect(page.locator('[data-paragraph-index="20"]')).toHaveAttribute('data-active', 'true');
  await expect(page.locator('[data-paragraph-index="20"]')).toBeInViewport();
  await page.getByRole('button', {name: '返回刚才的位置'}).click();
  await expect(page.locator('[data-paragraph-index="0"]')).toHaveAttribute('data-active', 'true');
});

test('new annotations preserve exact source offsets while search marks wrap the selected text', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '文内查找', exact: true}).click();
  await page.getByRole('searchbox', {name: '查找论文原文'}).fill('sample');
  await page.getByRole('button', {name: '关闭文内查找'}).click();
  await page.locator('[data-paragraph-index="3"] [data-original-text]').evaluate(element => {
    const text = element.textContent!;
    const start = text.indexOf('sample'), end = start + 'sample 4'.length;
    function boundary(offset: number): [Node, number] {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {const length = node.textContent!.length; if (offset <= length) return [node, offset]; offset -= length;}
      throw new Error('Offset outside source');
    }
    const range = document.createRange(); range.setStart(...boundary(start)); range.setEnd(...boundary(end));
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
  });
  await page.keyboard.press('Alt+a');
  await expect(page.getByLabel('批注内容')).toBeVisible();
  await page.getByLabel('批注内容').fill('Exact offset from a search highlight.');
  await page.getByRole('button', {name: '保存批注', exact: true}).click();
  const entry = page.locator('.annotation-entry').filter({hasText: 'Exact offset from a search highlight.'});
  await expect(entry.locator(':scope > blockquote')).toHaveText('sample 4');
  await expect(page.locator('[data-paragraph-index="3"] [data-original-text]')).toHaveText(paper.paragraphs[3].original);
  await expect.poll(() => state.requestBodies.some(body => JSON.stringify(body).includes('Exact offset from a search highlight.'))).toBe(true);
  await page.reload();
  await expect(entry.locator(':scope > blockquote')).toHaveText('sample 4');
});

test('annotation filters combine quote, comment, color and comment presence without changing records', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  const annotations = page.getByRole('region', {name: '划线批注', exact: true});
  await expect(annotations.locator('.annotation-entry')).toHaveCount(3);
  await annotations.getByLabel('有评论', {exact: true}).check();
  await expect(annotations.locator('.annotation-entry')).toHaveCount(2);
  await annotations.getByLabel('筛选批注颜色').selectOption('green');
  await expect(annotations.locator('.annotation-entry')).toHaveCount(1);
  await annotations.getByLabel('搜索批注').fill('estimate 3');
  await expect(annotations.locator('.annotation-entry')).toHaveCount(1);
  await annotations.getByLabel('搜索批注').fill('missing result');
  await expect(annotations.getByRole('status')).toContainText('显示 0 / 3 条');
  await annotations.getByRole('button', {name: '清除筛选'}).click();
  await expect(annotations.locator('.annotation-entry')).toHaveCount(3);
  await expect(page.getByLabel('段落笔记')).toHaveValue('Existing source note.');
  expect(state.cloudPapers).toEqual([paper]);
});

test('find state is scoped to the current paper and keyboard shortcut is scoped to the reader', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper, {...paper, id: 'other-reader-proof', title: 'Another reading source', updatedAt: 0}]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await reader.focus(); await reader.press('Control+f');
  const find = page.getByRole('region', {name: '文内查找', exact: true});
  await expect(find.getByRole('searchbox')).toBeFocused();
  await find.getByRole('searchbox').fill('Evidence');
  await page.getByRole('button', {name: 'AI 分析', exact: true}).click();
  await expect(find).toBeHidden();
  await page.getByRole('button', {name: '阅读与笔记', exact: true}).click();
  await openPaperLibrary(page);
  await page.locator('.plab-index-open').filter({hasText: 'Another reading source'}).click();
  await page.getByRole('button', {name: '文内查找', exact: true}).click();
  await expect(find.getByRole('searchbox')).toHaveValue('');
  await expect(page.locator('[data-original-text] mark')).toHaveCount(0);
});

test('desktop and mobile navigation stay visible, fit the viewport and expose accessible controls', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await mkdir('outputs/reader-navigation-2026-10-18', {recursive: true});
  await page.getByRole('button', {name: '文内查找', exact: true}).click();
  const find = page.getByRole('region', {name: '文内查找', exact: true});
  await find.getByRole('searchbox').fill('validation');
  await page.screenshot({path: 'outputs/reader-navigation-2026-10-18/find-desktop.png'});
  const desktopAxe = await new AxeBuilder({page}).include('[popover]:popover-open').analyze();
  expect(desktopAxe.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([]);
  await find.getByRole('button', {name: '关闭文内查找'}).click();
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.getByLabel('筛选批注颜色').selectOption('green');
  await page.getByRole('region', {name: '划线批注', exact: true}).scrollIntoViewIfNeeded();
  await page.screenshot({path: 'outputs/reader-navigation-2026-10-18/annotations-desktop.png'});
  await page.setViewportSize({width: 375, height: 812});
  await page.getByRole('tab', {name: '阅读', exact: true}).click();
  await page.getByRole('button', {name: '章节目录', exact: true}).click();
  const directory = page.getByRole('region', {name: '章节目录', exact: true});
  const bounds = await directory.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: 'outputs/reader-navigation-2026-10-18/outline-mobile.png'});
  await directory.getByRole('searchbox').press('Escape');
  await page.getByRole('button', {name: '文内查找', exact: true}).click();
  await find.getByRole('searchbox').fill('sample');
  await find.getByRole('searchbox').press('Enter');
  await expect(find).toBeVisible();
  await page.screenshot({path: 'outputs/reader-navigation-2026-10-18/find-mobile.png'});
});
