import {expect, test} from '@playwright/test';
import {mkdir, readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks, openPaperLibrary} from './helpers';

const paper = {id: 'workflow-proof', title: 'Source evidence across methods and results', fileName: 'workflow-proof.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: Array.from({length: 12}, (_, index) => ({id: `workflow-${index}`, page: index + 1, section: ['Introduction', 'Methods', 'Results'][Math.floor(index / 4)], original: `Source ${index + 1}. ` + 'The sample estimates require checking assumptions and validation against the original study. '.repeat(8), translation: `第 ${index + 1} 段的已有译文。`, note: index === 0 ? 'Keep the original note.' : '', bookmarked: false, read: false,
    annotations: index < 3 ? [{id: `workflow-mark-${index}`, start: 0, end: 8, quote: `Source ${index + 1}`, comment: index === 1 ? '' : `Interpretation ${index + 1}`, color: ['yellow', 'blue', 'green'][index], createdAt: 100 + index}] : []}))};

function researchPdf(pages = 4) {
  const streams = Array.from({length: pages}, (_, index) => `BT /F1 18 Tf 40 750 Td (Controlled PDF Navigation Study) Tj ET\nBT /F1 12 Tf 40 700 Td (Abstract) Tj ET\nBT /F1 10 Tf 40 680 Td (Page ${index + 1} presents a controlled sample, estimates, validation and evidence for this reading study.) Tj ET\n0.2 0.4 0.6 rg 40 200 100 80 re f`);
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${streams.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  streams.forEach((stream, i) => objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`));
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {const offset = Buffer.byteLength(pdf); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; return offset;});
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test('reference source stays independent, resizes by keyboard, swaps positions and preserves notes', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '原文对照', exact: true}).click();
  const reference = page.getByRole('complementary', {name: '固定原文对照'});
  await expect(reference.getByRole('region', {name: '对照原文'})).toContainText('Source 1.');
  await page.locator('.section-chips').getByRole('button', {name: 'Methods', exact: true}).click();
  await expect(page.locator('[data-paragraph-index="4"]')).toHaveAttribute('data-active', 'true');
  await expect(reference.getByLabel('选择对照段落')).toHaveValue('0');
  await reference.getByLabel('选择对照段落').selectOption('8');
  await expect(page.locator('[data-paragraph-index="4"]')).toHaveAttribute('data-active', 'true');
  const divider = page.getByRole('separator', {name: '调整原文对照宽度'});
  await divider.focus(); await divider.press('ArrowLeft');
  await expect(divider).toHaveAttribute('aria-valuenow', '40');
  const handle = await divider.boundingBox();
  await page.mouse.move(handle!.x + 6, handle!.y + 100); await page.mouse.down();
  await page.mouse.move(handle!.x - 84, handle!.y + 100, {steps: 4}); await page.mouse.up();
  await expect.poll(async () => Number(await divider.getAttribute('aria-valuenow'))).toBeGreaterThan(40);
  await expect(page.locator('[data-paragraph-index="4"]')).toHaveAttribute('data-active', 'true');
  await divider.press('Home'); await expect(divider).toHaveAttribute('aria-valuenow', '30');
  await reference.getByRole('button', {name: '交换阅读位置'}).click();
  await expect(reference.getByLabel('选择对照段落')).toHaveValue('4');
  await expect(page.locator('[data-paragraph-index="8"]')).toHaveAttribute('data-active', 'true');
  await reference.getByRole('button', {name: '显示对照译文'}).click();
  await expect(reference).toContainText('第 5 段的已有译文。');
  await reference.getByRole('button', {name: '关闭原文对照'}).click();
  await expect(page.getByRole('button', {name: '原文对照', exact: true})).toBeFocused();
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  await page.locator('.section-chips').getByRole('button', {name: 'Introduction', exact: true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Keep the original note.');
});

test('preview can become a fixed comparison without moving the main source; paper switches isolate it', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper, {...paper, id: 'other-workflow', title: 'Another source', updatedAt: 0}]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  const entries = page.getByRole('region', {name: '划线批注'});
  await entries.getByRole('button', {name: '预览原文第 3 段'}).press('Enter');
  await page.getByRole('dialog', {name: '原文预览：第 3 段'}).getByRole('button', {name: '固定为对照'}).click();
  await expect(page.getByLabel('选择对照段落')).toHaveValue('2');
  await expect(page.locator('[data-paragraph-index="0"]')).toHaveAttribute('data-active', 'true');
  await openPaperLibrary(page);
  await page.locator('.plab-index-open').filter({hasText: 'Another source'}).click();
  await expect(page.getByRole('complementary', {name: '固定原文对照'})).toHaveCount(0);
});

test('selected annotations export source-linked extracts, keep hidden choices and sort without editing records', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  const entries = page.getByRole('region', {name: '划线批注'});
  await entries.getByLabel('选择 P1 的批注：Source 1').check();
  await entries.getByLabel('筛选批注颜色').selectOption('green');
  await entries.getByLabel('选择当前筛选结果').check();
  await expect(entries).toContainText('已选 2 条（含其他筛选中的批注）');
  const downloading = page.waitForEvent('download');
  await entries.getByRole('button', {name: '导出所选摘录'}).click();
  const downloaded = await downloading;
  const markdown = await readFile((await downloaded.path())!, 'utf8');
  expect(markdown).toContain('P1 · 第 1 页'); expect(markdown).toContain('P3 · 第 3 页');
  expect(markdown).not.toContain('> Source 2'); expect(markdown).toContain('个人评论：\n\nInterpretation 3');
  await entries.getByRole('button', {name: '清除筛选'}).click();
  await entries.getByLabel('批注排序').selectOption('newest');
  await expect(entries.locator('.annotation-entry').first().locator(':scope > blockquote')).toHaveText('Source 3');
  await entries.getByRole('button', {name: '清空选择'}).click();
  await expect(entries.getByRole('button', {name: '导出所选摘录'})).toBeDisabled();
  expect(state.cloudPapers).toEqual([paper]);
});

test('clipboard denial gives a usable export alternative and mobile annotation collection fits the screen', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: () => Promise.reject(new Error('denied'))}}));
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.getByRole('tab', {name: '笔记', exact: true}).click();
  const entries = page.getByRole('region', {name: '划线批注'});
  await entries.getByLabel('选择当前筛选结果').check();
  await entries.getByRole('button', {name: '复制所选摘录'}).click();
  await expect(entries.getByRole('status')).toContainText('剪贴板不可用');
  await expect(entries.getByRole('button', {name: '导出所选摘录'})).toBeEnabled();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('PDF page thumbnails navigate with keyboard, rotation restores and original bytes stay local', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true});
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'navigation.pdf', mimeType: 'application/pdf', buffer: researchPdf()});
  await expect(page.getByLabel('论文标题')).toHaveValue('Controlled PDF Navigation Study', {timeout: 30_000});
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  const pdf = page.getByRole('dialog', {name: '原 PDF', exact: true});
  await pdf.getByRole('button', {name: '页面缩略图'}).click();
  const thumbnails = pdf.getByRole('navigation', {name: '原 PDF 页览'});
  await expect.poll(() => thumbnails.locator('canvas').first().evaluate(el => (el as HTMLCanvasElement).width)).toBeGreaterThan(0);
  await thumbnails.getByRole('button', {name: '查看原 PDF 第 2 页'}).click();
  await expect(pdf.getByLabel('原 PDF 页码')).toHaveValue('2');
  await thumbnails.getByRole('button', {name: '查看原 PDF 第 2 页'}).press('ArrowDown');
  await expect(pdf.getByLabel('原 PDF 页码')).toHaveValue('3');
  await pdf.getByRole('button', {name: '顺时针旋转原 PDF'}).click();
  await expect(pdf.getByRole('button', {name: '顺时针旋转原 PDF'})).toHaveText('旋转 90°');
  const canvas = pdf.getByRole('img', {name: '原 PDF 第 3 页'});
  await expect.poll(() => canvas.evaluate(el => {const r = el.getBoundingClientRect(); return r.width > r.height;})).toBe(true);
  await mkdir('outputs/reader-workflow-2026-10-19', {recursive: true});
  await page.screenshot({path: 'outputs/reader-workflow-2026-10-19/pdf-pages-desktop.png'});
  await pdf.getByRole('button', {name: '关闭原 PDF'}).click();
  await page.reload(); await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await expect(pdf.getByLabel('原 PDF 页码')).toHaveValue('3');
  await expect(pdf.getByRole('button', {name: '顺时针旋转原 PDF'})).toHaveText('旋转 90°');
  await page.setViewportSize({width: 375, height: 812});
  await pdf.getByRole('button', {name: '页面缩略图'}).click();
  await page.screenshot({path: 'outputs/reader-workflow-2026-10-19/pdf-pages-mobile.png'});
  expect(JSON.stringify(state.requestBodies)).not.toMatch(/pdfData|base64|application\/pdf|%PDF/);
});

test('long PDF thumbnail rendering is limited to visible pages and fits mobile', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'long-navigation.pdf', mimeType: 'application/pdf', buffer: researchPdf(80)});
  await expect(page.getByLabel('论文标题')).toHaveValue('Controlled PDF Navigation Study', {timeout: 30_000});
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  const pdf = page.getByRole('dialog', {name: '原 PDF', exact: true});
  await pdf.getByRole('button', {name: '页面缩略图'}).click();
  const thumbnails = pdf.getByRole('navigation', {name: '原 PDF 页览'});
  await expect(thumbnails.getByRole('button')).toHaveCount(80);
  await expect.poll(() => thumbnails.locator('canvas').count()).toBeLessThan(15);
  await thumbnails.getByRole('button', {name: '查看原 PDF 第 1 页'}).press('End');
  await expect(pdf.getByLabel('原 PDF 页码')).toHaveValue('80');
  await page.setViewportSize({width: 375, height: 812});
  await expect.poll(() => pdf.evaluate(el => el.getBoundingClientRect().width <= innerWidth)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('comparison and selection UI render at desktop and mobile with no serious accessibility findings', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await mkdir('outputs/reader-workflow-2026-10-19', {recursive: true});
  await page.getByRole('button', {name: '原文对照', exact: true}).click();
  await page.locator('.section-chips').getByRole('button', {name: 'Results', exact: true}).click();
  await expect(page.getByRole('complementary', {name: '固定原文对照'})).toBeVisible();
  await expect(page.locator('[data-paragraph-index="8"]')).toHaveAttribute('data-active', 'true');
  await expect(page.getByLabel('选择对照段落')).toHaveValue('0');
  await page.screenshot({path: 'outputs/reader-workflow-2026-10-19/comparison-desktop.png'});
  const audit = await new AxeBuilder({page}).include('#paper-reference').include('[role="separator"]').analyze();
  expect(audit.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await page.getByRole('button', {name: '笔记', exact: true}).click();
  const entries = page.getByRole('region', {name: '划线批注'});
  await entries.getByLabel('选择当前筛选结果').check();
  await entries.locator('.annotation-entry').first().scrollIntoViewIfNeeded();
  await page.screenshot({path: 'outputs/reader-workflow-2026-10-19/collection-desktop.png'});
  await page.setViewportSize({width: 375, height: 812});
  await page.getByRole('tab', {name: '笔记', exact: true}).click();
  await entries.locator('.annotation-entry').first().scrollIntoViewIfNeeded();
  await page.screenshot({path: 'outputs/reader-workflow-2026-10-19/collection-mobile.png'});
  const mobileAudit = await new AxeBuilder({page}).include('.paper-annotation-list').analyze();
  expect(mobileAudit.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
});
