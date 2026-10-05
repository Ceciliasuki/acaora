import {expect, test} from '@playwright/test';
import {installApiMocks} from './helpers';

const first = {
  id: 'regression-a', fileName: 'a.pdf', title: 'Source paper', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: [0, 1].map(index => ({id: `a-${index}`, page: 1, section: index ? 'Methods' : 'Abstract', original: `Source paragraph ${index}. This is a controlled paper used to check persistence and asynchronous result ownership.`, translation: '', note: '', read: false, bookmarked: false})),
};
const second = {...first, id: 'regression-b', title: 'Other paper', paragraphs: first.paragraphs.map(p => ({...p, id: `b-${p.id}`}))};

test.beforeEach(async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library: true, notes: true})));
});

test('editing a note then immediately switching papers preserves the source note after reload', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [first, second]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(first.title);
  await page.getByLabel('段落笔记').fill('Unsaved source note');
  await page.locator('.plab-index-open').filter({hasText: second.title}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(second.title);
  await page.locator('.plab-index-open').filter({hasText: first.title}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Unsaved source note');
  await page.reload();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Unsaved source note');
});

test('a delayed AI translation belongs to its source paragraph even after selection changes', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [first]});
  await page.addInitScript(() => sessionStorage.setItem('statlab-deepseek-key', 'controlled-test-key'));
  let release!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/papers/ai', async route => {
    await pending;
    await route.fulfill({json: {result: {translation: 'Source translation'}, model: 'test', usage: {total_tokens: 1}}});
  });
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(first.title);
  await page.getByRole('button', {name: 'AI 分析', exact: true}).click();
  await page.getByRole('tab', {name: '增强翻译', exact: true}).click();
  const request = page.waitForRequest('**/api/papers/ai');
  await page.getByRole('button', {name: '翻译当前段落', exact: true}).click();
  await request;
  await page.getByRole('button', {name: '阅读与笔记', exact: true}).click();
  await page.locator('.section-chips').getByRole('button', {name: 'Methods', exact: true}).click();
  release();
  await expect.poll(() => (state.requestBodies as typeof first[]).findLast(p => p.id === first.id)?.paragraphs[0].translation).toBe('Source translation');
  const saved = (state.requestBodies as typeof first[]).findLast(p => p.id === first.id)!;
  expect(saved.paragraphs[1].translation).toBe('');
});

test('AI results arriving after a paper switch never overwrite the other paper', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [first, second]});
  await page.addInitScript(() => sessionStorage.setItem('statlab-deepseek-key', 'controlled-test-key'));
  let release!: () => void;
  const pending = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/papers/ai', async route => {await pending; await route.fulfill({json: {result: {plain_explanation: 'Source analysis'}, model: 'test'}});});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(first.title);
  await page.getByRole('button', {name: 'AI 分析', exact: true}).click();
  const request = page.waitForRequest('**/api/papers/ai');
  await page.getByRole('button', {name: '分析当前段落', exact: true}).click();
  await request;
  await page.getByRole('button', {name: '阅读与笔记', exact: true}).click();
  await page.locator('.plab-index-open').filter({hasText: second.title}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(second.title);
  const response = page.waitForResponse('**/api/papers/ai');
  release();
  await response;
  await page.getByLabel('段落笔记').fill('Other note remains independent');
  await expect.poll(() => (state.requestBodies as typeof first[]).findLast(p => p.id === second.id)?.paragraphs[0].note).toBe('Other note remains independent');
  const saved = (state.requestBodies as Array<typeof first & {aiMemory?: unknown}>).findLast(p => p.id === second.id)!;
  expect(saved.aiMemory).toBeUndefined();
});

// A real PDF text layer with a three-line title and numbered custom sections.
function manuscriptPdf() {
  const lines: [number, number, string][] = [
    [18, 744, 'Analyzing Academic Abstracts Across Cohorts:'],
    [18, 722, 'A Transparent Validation Study'], [18, 700, 'with Sensitivity Checks'],
    [10, 660, 'Alex Researcher and Robin Scholar'], [12, 625, 'Abstract'],
    [10, 600, 'This study compares academic abstracts using textual features and phrase networks. The analysis uses a transparent dataset and reports uncertainty.'],
    [12, 555, '2 Dataset Construction'],
    [10, 530, 'The dataset contains controlled documents with documented inclusion criteria. Each abstract is checked for duplicates and assigned a stable identifier.'],
    [10, 505, '1 Use complete case analysis'],
    [12, 480, '3.1 Network Construction'],
    [10, 455, 'A phrase network is constructed from co-occurrence counts. Sensitivity checks assess whether the findings depend on threshold selection and preprocessing.'],
    [12, 410, '4 Conclusion'],
    [10, 385, 'The findings describe differences in the controlled sample. Generalization requires external validation and careful consideration of alternative explanations.'],
    [12, 340, 'References'],
    [10, 315, 'This reference entry should not become a paragraph in the reading body even when it is long enough to pass the length threshold.'],
  ];
  const stream = lines.map(([size, y, text]) => `BT /F1 ${size} Tf 1 0 0 1 40 ${y} Tm (${text}) Tj ET`).join('\n') + '\n0.86 0.12 0.16 rg 100 200 80 60 re f';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1200 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {const offset = Buffer.byteLength(body); body += `${index + 1} 0 obj\n${object}\nendobj\n`; return offset;});
  const xref = Buffer.byteLength(body);
  body += `xref\n0 6\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

test('PDF import keeps the multiline title and numbered custom section navigation', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'manuscript.pdf', mimeType: 'application/pdf', buffer: manuscriptPdf()});
  await expect(page.getByLabel('论文标题')).toHaveValue('Analyzing Academic Abstracts Across Cohorts: A Transparent Validation Study with Sensitivity Checks', {timeout: 30_000});
  await expect(page.locator('.section-chips').getByRole('button', {name: 'Dataset Construction', exact: true})).toBeVisible();
  await expect(page.getByText(/1 Use complete case analysis/)).toBeAttached();
  await page.locator('.section-chips').getByRole('button', {name: 'Network Construction', exact: true}).click();
  await expect(page.locator('[data-active=true]')).toContainText('A phrase network is constructed');
  await expect(page.getByText(/This reference entry/)).toHaveCount(0);
});

test('edits made while the target paper storage is slow survive the eventual switch', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [first, second]});
  await page.addInitScript(() => {
    const controlled = window as typeof window & {holdTarget?: boolean; targetBlocked?: boolean; releaseTarget?: () => void};
    const targets = new WeakSet<IDBTransaction>();
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value, key) {
      if (controlled.holdTarget && this.name === 'papers' && value.id === 'regression-b') targets.add(this.transaction);
      return put.call(this, value, key);
    };
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function(...args) {
      const result = transaction.apply(this, args);
      Object.defineProperty(result, 'oncomplete', {set(callback) {
        result.addEventListener('complete', async event => {
          if (targets.has(result) && controlled.holdTarget) {
            controlled.targetBlocked = true;
            await new Promise<void>(resolve => {controlled.releaseTarget = () => {controlled.holdTarget = false; resolve();};});
          }
          callback?.call(result, event);
        });
      }});
      return result;
    };
  });
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(first.title);
  await page.evaluate(() => {(window as typeof window & {holdTarget?: boolean}).holdTarget = true;});
  await page.locator('.plab-index-open').filter({hasText: second.title}).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {targetBlocked?: boolean}).targetBlocked)).toBe(true);
  await page.getByLabel('段落笔记').fill('Edit while storage is pending');
  await page.evaluate(() => (window as typeof window & {releaseTarget?: () => void}).releaseTarget?.());
  await expect(page.getByLabel('论文标题')).toHaveValue(second.title);
  await page.locator('.plab-index-open').filter({hasText: first.title}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Edit while storage is pending');
});

test('original PDF renders its graphic locally and survives reload without entering cloud payloads', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true});
  await page.goto('/papers');
  await expect(page.locator('.library-privacy strong')).not.toHaveText('正在检查账户');
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'manuscript.pdf', mimeType: 'application/pdf', buffer: manuscriptPdf()});
  await expect(page.getByLabel('论文标题')).toHaveValue('Analyzing Academic Abstracts Across Cohorts: A Transparent Validation Study with Sensitivity Checks');
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  const canvas = page.getByLabel('原 PDF 第 1 页');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    const pixel = element.getContext('2d')!.getImageData(Math.floor(element.width * 110 / 1200), Math.floor(element.height * 582 / 792), 1, 1).data;
    return pixel[0] > 200 && pixel[1] < 60 && pixel[2] < 70;
  })).toBe(true);
  await page.screenshot({path: 'outputs/paper-fixes-2026-10-05/original-pdf-desktop.png'});
  await page.getByRole('button', {name: '关闭原 PDF', exact: true}).click();
  await page.getByLabel('段落笔记').fill('Keep the existing note');
  await expect.poll(() => (state.requestBodies as typeof first[]).findLast(p => p.fileName === 'manuscript.pdf')?.paragraphs[0].note).toBe('Keep the existing note');
  await page.reload();
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await expect(canvas).toBeVisible();
  expect(JSON.stringify(state.requestBodies)).not.toMatch(/pdfData|base64|application\/pdf|%PDF/);
  await page.setViewportSize({width: 375, height: 812});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => canvas.evaluate(element => element.getBoundingClientRect().width)).toBeLessThan(350);
  await page.screenshot({path: 'outputs/paper-fixes-2026-10-05/original-pdf-mobile.png'});
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', {name: '原 PDF', exact: true})).toHaveCount(0);
  // The same paper id under another account must not expose this account's PDF.
  state.userId = 'other-account';
  state.cloudPapers = [{...first, id: (state.requestBodies as typeof first[]).findLast(p => p.fileName === 'manuscript.pdf')!.id, title: 'Other account paper'}];
  await page.setViewportSize({width: 1280, height: 900});
  await page.reload();
  await expect(page.getByLabel('论文标题')).toHaveValue('Other account paper');
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await expect(page.getByText(/此设备尚未保存原文件/)).toBeVisible();
  await expect(canvas).toHaveCount(0);
});

test('an unrelated original PDF is rejected and does not change the existing paper', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [first]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(first.title);
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await page.getByLabel('选择当前论文的原 PDF').setInputFiles({name: 'wrong.pdf', mimeType: 'application/pdf', buffer: manuscriptPdf()});
  await expect(page.getByRole('dialog', {name: '原 PDF', exact: true}).getByRole('alert')).toContainText('文件内容与这篇论文不匹配');
  await page.getByRole('button', {name: '关闭原 PDF', exact: true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(first.title);
  await expect(page.getByLabel('段落笔记')).toHaveValue('');
});

test('logging out closes the original PDF and removes the previous account paper from the reader', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [first]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(first.title);
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  state.signedIn = false;
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(page.getByRole('dialog', {name: '原 PDF', exact: true})).toHaveCount(0);
  await expect(page.getByLabel('论文标题')).not.toHaveValue(first.title);
  await expect(page.getByRole('button', {name: '查看原 PDF', exact: true})).toHaveCount(0);
});

test('attaching the original repairs old metadata without replacing paragraph ids or notes', async ({page}) => {
  const old = {...first, title: 'Analyzing Academic Abstracts Across Cohorts:', fileName: 'manuscript.pdf', paragraphs: [
    {...first.paragraphs[0], section: 'Introduction', original: 'Analyzing Academic Abstracts Across Cohorts: A Transparent Validation Study with Sensitivity Checks Alex Researcher and Robin Scholar', note: 'Existing title note'},
    {...first.paragraphs[1], section: 'Abstract', original: '2 Dataset Construction The dataset contains controlled documents with documented inclusion criteria. Each abstract is checked for duplicates and assigned a stable identifier.', note: 'Keep dataset note'},
  ]};
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [old]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(old.title);
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await page.getByLabel('选择当前论文的原 PDF').setInputFiles({name: 'manuscript.pdf', mimeType: 'application/pdf', buffer: manuscriptPdf()});
  await expect(page.getByLabel('原 PDF 第 1 页')).toBeVisible();
  await page.getByRole('button', {name: '关闭原 PDF', exact: true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue('Analyzing Academic Abstracts Across Cohorts: A Transparent Validation Study with Sensitivity Checks');
  await page.locator('.section-chips').getByRole('button', {name: 'Dataset Construction', exact: true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Keep dataset note');
  await expect.poll(() => (state.requestBodies as typeof first[]).findLast(p => p.id === old.id)?.paragraphs[1].section).toBe('Dataset Construction');
  const saved = (state.requestBodies as typeof first[]).findLast(p => p.id === old.id)!;
  expect(saved.paragraphs.map(p => p.id)).toEqual(['a-0', 'a-1']);
  expect(saved.paragraphs.map(p => p.note)).toEqual(['Existing title note', 'Keep dataset note']);
});
