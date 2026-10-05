import {expect, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {installApiMocks} from './helpers';

// Actual PDF bytes exercise PDF.js, device storage and canvas rendering.
function textPdf(twoColumns = false, offset = 0, numericTable = false) {
  const streams = Array.from({length: twoColumns ? 1 : 3}, (_, index) => {
    const lines: [number, number, number, string][] = [[18, 40, 750, 'Controlled Reading Tools Study'], [12, 40, 700, 'Abstract']];
    if (twoColumns) {
      for (let row = 0; row < 6; row++) lines.push([10, 40, 680 - row * 20, numericTable ? `111111${row} 222222${row} 333333${row} 444444${row} 555555${row}` : `Left column line ${row + 1} describes the sample and inclusion rules.`]);
      lines.push([12, 540, 700, 'Methods']);
      for (let row = 0; row < 6; row++) lines.push([10, 540, 680 - row * 20 - offset, numericTable ? `666666${row} 777777${row} 888888${row} 999999${row} 000000${row}` : `Right column line ${row + 1} describes model validation and limits.`]);
    } else lines.push([10, 40, 680, `Page ${index + 1} contains a controlled study paragraph with enough text to import. The sample and model are described transparently for validation.`]);
    return lines.map(([size, x, y, text]) => `BT /F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`).join('\n') + '\n0.1 0.3 0.6 rg 40 200 100 80 re f';
  });
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${streams.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${streams.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  streams.forEach((stream, i) => objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1000 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`));
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, i) => {const offset = Buffer.byteLength(body); body += `${i + 1} 0 obj\n${object}\nendobj\n`; return offset;});
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

test('PDF zoom and last page survive close and reload, while mobile overflow stays inside the viewer', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'tools.pdf', mimeType: 'application/pdf', buffer: textPdf()});
  await expect(page.getByLabel('论文标题')).toHaveValue('Controlled Reading Tools Study', {timeout: 30_000});
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await page.getByLabel('原 PDF 页码').fill('2');
  const canvas = page.getByLabel('原 PDF 第 2 页');
  await expect(canvas).toBeVisible();
  const initialWidth = await canvas.evaluate(el => el.getBoundingClientRect().width);
  await page.getByRole('button', {name: '放大原 PDF', exact: true}).click();
  await expect.poll(() => canvas.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(initialWidth);
  await page.getByRole('button', {name: '关闭原 PDF', exact: true}).click();
  await page.reload();
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await expect(page.getByLabel('原 PDF 页码')).toHaveValue('2');
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThan(initialWidth);
  await page.setViewportSize({width: 375, height: 812});
  await page.getByRole('button', {name: '放大原 PDF', exact: true}).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', {name: '适合宽度', exact: true}).click();
  await expect.poll(() => canvas.evaluate(el => el.getBoundingClientRect().width)).toBeLessThan(350);
});

test('two-column import tolerates a one-point baseline offset', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'offset.pdf', mimeType: 'application/pdf', buffer: textPdf(true, 1)});
  await expect(page.getByLabel('论文标题')).toHaveValue('Controlled Reading Tools Study', {timeout: 30_000});
  const text = await page.locator('.plab-reader-scroll').innerText();
  expect(text.indexOf('Right column line 1')).toBeGreaterThan(text.indexOf('Left column line 6'));
});

test('a wide numeric table keeps its row associations instead of becoming text columns', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'table.pdf', mimeType: 'application/pdf', buffer: textPdf(true, 0, true)});
  await expect(page.getByLabel('论文标题')).toHaveValue('Controlled Reading Tools Study', {timeout: 30_000});
  const text = await page.locator('.plab-reader-scroll').innerText();
  expect(text.indexOf('6666660')).toBeGreaterThan(text.indexOf('1111110'));
  expect(text.indexOf('6666660')).toBeLessThan(text.indexOf('1111111'));
});

test('AI paragraph references navigate to their source and mark out-of-range references', async ({page}) => {
  await installApiMocks(page, {signedIn: true});
  await page.addInitScript(() => sessionStorage.setItem('statlab-deepseek-key', 'controlled-key'));
  await page.route('**/api/papers/ai', route => route.fulfill({json: {result: {answer: 'Check P2 and [P999].', citations: [{paragraph: 'P2', quote: 'repeated ten-fold cross-validation'}]}, model: 'test'}}));
  await page.goto('/papers');
  await page.getByRole('button', {name: 'AI 分析', exact: true}).click();
  await page.getByRole('tab', {name: '论文问答', exact: true}).click();
  await page.getByRole('button', {name: '向论文提问', exact: true}).click();
  await expect(page.getByText('P999（无对应段落）', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: '查看原文 P2', exact: true}).first().click();
  await expect(page.locator('[data-active=true]')).toContainText('repeated ten-fold cross-validation');
  await expect(page.locator('[data-active=true]')).toBeInViewport();
});

test('AI original-page links override saved PDF history and stay local', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true});
  await page.addInitScript(() => sessionStorage.setItem('statlab-deepseek-key', 'controlled-key'));
  await page.route('**/api/papers/ai', route => route.fulfill({json: {result: {answer: 'The supporting paragraph is P2.'}, model: 'test'}}));
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'citations.pdf', mimeType: 'application/pdf', buffer: textPdf()});
  await expect(page.getByLabel('论文标题')).toHaveValue('Controlled Reading Tools Study', {timeout: 30_000});
  await page.getByRole('button', {name: '查看原 PDF', exact: true}).click();
  await page.getByLabel('原 PDF 页码').fill('3');
  await page.getByRole('button', {name: '关闭原 PDF', exact: true}).click();
  await page.getByRole('button', {name: 'AI 分析', exact: true}).click();
  await page.getByRole('tab', {name: '论文问答', exact: true}).click();
  await page.getByRole('button', {name: '向论文提问', exact: true}).click();
  await page.getByRole('button', {name: '查看 P2 对应原 PDF 第 2 页', exact: true}).click();
  await expect(page.getByLabel('原 PDF 页码')).toHaveValue('2');
  await expect(page.getByRole('img', {name: '原 PDF 第 2 页', exact: true})).toBeVisible();
  expect(JSON.stringify(state.requestBodies)).not.toMatch(/pdfData|base64|application\/pdf|%PDF/);
  await page.getByRole('button', {name: '关闭原 PDF', exact: true}).click();
  await expect(page.locator('[data-active=true]')).toContainText('Page 2 contains');
});

test('notes export includes the latest unsaved note, chapter, page and original excerpt', async ({page}) => {
  await installApiMocks(page);
  await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library: false, notes: true})));
  await page.goto('/papers');
  await page.getByLabel('段落笔记').fill('Fresh note before debounce **important**');
  await page.getByRole('button', {name: '笔记汇总', exact: true}).click();
  await expect(page.getByRole('region', {name: '笔记汇总'})).toContainText('Fresh note before debounce');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: '导出 Markdown', exact: true}).click();
  const downloaded = await pending;
  const markdown = await readFile((await downloaded.path())!, 'utf8');
  expect(markdown).toContain('# Statistical learning in observational studies: principles and practice');
  expect(markdown).toContain('## Abstract');
  expect(markdown).toContain('P1 · 第 1 页');
  expect(markdown).toContain('Statistical learning methods are widely used');
  expect(markdown).toContain('Fresh note before debounce **important**');
  expect(markdown).toContain('重点检查是否存在数据泄漏');
  await page.screenshot({path: 'test-results/reading-tools-notes-desktop.png'});
});

test('two-column import reads the whole left column before the right column', async ({page}) => {
  await installApiMocks(page);
  await page.goto('/papers');
  await expect(page.getByRole('button', {name: '导入 PDF', exact: true})).toBeEnabled();
  await page.getByLabel('导入英文论文 PDF').setInputFiles({name: 'columns.pdf', mimeType: 'application/pdf', buffer: textPdf(true)});
  await expect(page.getByLabel('论文标题')).toHaveValue('Controlled Reading Tools Study', {timeout: 30_000});
  const text = await page.locator('.plab-reader-scroll').innerText();
  expect(text.indexOf('Left column line 6')).toBeGreaterThan(text.indexOf('Left column line 1'));
  expect(text.indexOf('Right column line 1')).toBeGreaterThan(text.indexOf('Left column line 6'));
  await expect(page.locator('.section-chips').getByRole('button', {name: 'Methods', exact: true})).toBeVisible();
});
