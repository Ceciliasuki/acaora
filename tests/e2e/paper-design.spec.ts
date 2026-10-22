import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installApiMocks} from './helpers';
import AxeBuilder from '@axe-core/playwright';

const title = 'A controlled example: how unusually long academic paper titles remain readable across desktop, tablet and mobile layouts without hiding the final words';
const paper = {id: 'design-check', title, fileName: 'design-example.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: ['Abstract', 'Methods', 'Results'].map((section, i) => ({id: `design-${i}`, page: i + 1, section,
    original: 'This is example text for a layout check, not a published research finding. '.repeat(5),
    translation: '', note: '', bookmarked: false, read: false}))};

for (const width of [1440, 1024, 768, 375]) {
  test(`PaperLab long titles wrap completely at ${width}px and remain editable`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
    await page.goto('/papers?view=reader');
    const field = page.getByLabel('论文标题', {exact: true});
    await expect(field).toHaveValue(title);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    expect(await field.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
    if (width > 760) await page.getByRole('button', {name: '编辑标题', exact: true}).click();
    await field.fill('A short title');
    await expect.poll(() => field.evaluate(el => el.clientHeight <= Number.parseFloat(getComputedStyle(el).lineHeight) + 2)).toBe(true);
    await field.fill(title + ' revised');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await page.getByRole('button', {name: 'Methods', exact: true}).click();
    await expect(page.getByRole('button', {name: 'Methods', exact: true})).toHaveAttribute('aria-current', 'location');
    await field.fill(title + ' revised');
    await field.press('Enter');
    await expect(field).not.toBeFocused();
    await expect(field).toHaveValue(title + ' revised');
    expect(await field.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await mkdir('outputs/papers-design-2026-10-13', {recursive: true});
    await page.screenshot({path: `outputs/papers-design-2026-10-13/long-title-${width}.png`, fullPage: true});
  });
}

test('PaperLab title fallback shrinks and resizes without a measurement copy', async ({page}) => {
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS);
    CSS.supports = (property: string, value?: string) => property === 'field-sizing' ? false : value === undefined ? supports(property) : supports(property, value);
  });
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.setViewportSize({width: 1440, height: 900});
  await page.goto('/papers?view=reader');
  await page.addStyleTag({content: 'textarea[aria-label="论文标题"] { field-sizing: fixed !important; }'});
  const field = page.getByLabel('论文标题');
  await expect(field).toHaveValue(title);
  await page.getByRole('button', {name: '编辑标题', exact: true}).click();
  await field.fill(title + ' with fallback');
  await expect.poll(() => field.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
  await page.setViewportSize({width: 375, height: 812});
  await expect.poll(() => field.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
  await field.fill('Short');
  await expect.poll(() => field.evaluate(el => el.clientHeight <= Number.parseFloat(getComputedStyle(el).lineHeight) + 2)).toBe(true);
});

test('PaperLab mobile tabs support directional keyboard focus and one tab stop', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await installApiMocks(page);
  await page.goto('/papers?view=reader');
  await expect(page.getByLabel('论文标题')).toHaveValue(/Statistical learning/);
  const tabs = page.getByRole('tablist', {name: '论文工作台面板'});
  const reader = tabs.getByRole('tab', {name: '阅读', exact: true});
  await expect(tabs.getByRole('tab', {name: '论文库', exact: true})).toHaveAttribute('tabindex', '-1');
  await reader.press('ArrowRight');
  const notes = tabs.getByRole('tab', {name: '笔记', exact: true});
  await expect(notes).toBeFocused();
  await expect(notes).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel('段落笔记')).toBeVisible();
  await page.getByRole('button', {name: '收起笔记', exact: true}).click();
  await expect(reader).toBeFocused();
  await expect(reader).toHaveAttribute('aria-selected', 'true');
  await reader.press('ArrowRight');
  await notes.press('End');
  const search = tabs.getByRole('tab', {name: '检索', exact: true});
  await expect(search).toBeFocused();
  await expect(page.getByLabel('论文检索关键词')).toBeVisible();
  await search.press('Home');
  await expect(tabs.getByRole('tab', {name: '论文库', exact: true})).toBeFocused();
  await page.getByRole('button', {name: '收起论文库', exact: true}).click();
  await expect(reader).toBeFocused();
  await reader.press('ArrowLeft');
  await tabs.getByRole('tab', {name: '论文库', exact: true}).press('ArrowRight');
  await expect(reader).toBeFocused();
  await expect(page.getByRole('region', {name: '论文正文', exact: true})).toBeVisible();
});

test('PaperLab keeps chapter navigation visible without covering a jumped paragraph', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  const longPaper = {...paper, paragraphs: paper.paragraphs.map(p => ({...p, original: p.original.repeat(4)}))};
  await installApiMocks(page, {signedIn: true, cloudPapers: [longPaper]});
  await page.goto('/papers?view=reader');
  await expect(page.getByLabel('论文标题')).toHaveValue(title);
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await reader.press('End');
  const chapters = page.getByRole('navigation', {name: '论文章节', exact: true});
  await expect(chapters).toBeInViewport();
  await expect(page.getByRole('button', {name: 'Results', exact: true})).toHaveAttribute('aria-current', 'location');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await reader.evaluate(root => root.dispatchEvent(new Event('scroll')));
  await expect(page.locator('[data-paragraph-index="2"]')).toHaveAttribute('data-active', 'true');
  const bounds = await chapters.boundingBox();
  const heading = await page.locator('[data-paragraph-index="2"] h2').boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(bounds!.y + bounds!.height);
  expect(await page.evaluate(() => document.fonts.check('19px "Acaora Source Serif"'))).toBe(true);
});

for (const width of [1440, 375]) {
  test(`PaperLab reading and search accessibility smoke at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 900});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await installApiMocks(page);
    await page.goto('/papers?view=reader');
    await expect(page.getByLabel('论文标题')).toHaveValue(/Statistical learning/);
    await mkdir('outputs/papers-design-2026-10-13', {recursive: true});
    await page.screenshot({path: `outputs/papers-design-2026-10-13/reader-${width}.png`, fullPage: true});
    const reading = await new AxeBuilder({page}).include('.plab-shell').analyze();
    expect(reading.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    if (width > 760) await page.getByRole('button', {name: '笔记', exact: true}).click();
    else await page.getByRole('tab', {name: '笔记', exact: true}).click();
    await expect(page.getByLabel('段落笔记')).toBeVisible();
    await page.screenshot({path: `outputs/papers-design-2026-10-13/notes-${width}.png`, fullPage: true});
    if (width > 760) await page.getByRole('button', {name: '学术检索', exact: true}).click();
    else await page.getByRole('tab', {name: '检索', exact: true}).click();
    await expect(page.getByLabel('论文检索关键词')).toBeVisible();
    const search = await new AxeBuilder({page}).include('.plab-shell').analyze();
    expect(search.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await page.screenshot({path: `outputs/papers-design-2026-10-13/search-${width}.png`, fullPage: true});
  });
}
