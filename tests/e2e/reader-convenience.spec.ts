import {expect, test, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks} from './helpers';

const paper = {id: 'convenience-proof', title: 'Following evidence without losing a reading position', fileName: 'convenience-proof.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: Array.from({length: 24}, (_, i) => ({id: `convenience-${i}`, page: 1 + Math.floor(i / 3) * 2, section: ['Introduction', 'Methods', 'Results'][Math.floor(i / 8)],
    original: `Evidence paragraph ${i + 1}. ` + 'This controlled passage provides context for estimates, evidence and limitations. '.repeat(14), translation: '', note: '', bookmarked: false, read: false}))};
const active = (page: Page, index: number) => expect(page.locator(`[data-paragraph-index="${index}"]`)).toHaveAttribute('data-active', 'true');
async function locate(page: Page, paragraph: number) {
  await page.getByRole('button', {name: '跳转位置', exact: true}).click();
  await page.getByLabel('目标位置', {exact: true}).fill(String(paragraph));
  await page.getByLabel('目标位置', {exact: true}).press('Enter');
  await active(page, paragraph - 1);
}

test('direct location validates numbers, preserves context on errors and distinguishes extracted pages', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers?view=reader'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await reader.press('Control+Alt+g');
  const panel = page.getByRole('region', {name: '跳转位置', exact: true});
  const target = panel.getByLabel('目标位置', {exact: true});
  await expect(target).toBeFocused(); await expect(target).toHaveValue('1');
  for (const value of ['0', '2.5', '999']) {
    await target.fill(value); await target.press('Enter');
    await expect(panel.getByRole('alert')).toBeVisible(); await expect(target).toHaveAttribute('aria-invalid', 'true'); await active(page, 0);
  }
  await target.fill('9'); await target.press('Enter'); await active(page, 8);
  await expect(panel).toBeHidden(); await expect(reader).toBeFocused();
  await page.getByRole('button', {name: '跳转位置', exact: true}).click();
  await panel.getByLabel('定位方式').selectOption('page');
  await target.fill('2'); await target.press('Enter');
  await expect(panel.getByRole('alert')).toContainText('没有已提取段落'); await active(page, 8);
  await target.fill('3'); await target.press('Enter'); await active(page, 3);
  await page.getByRole('button', {name: '跳转位置', exact: true}).click();
  await target.press('Escape'); await expect(panel).toBeHidden();
  await expect(page.getByRole('button', {name: '跳转位置', exact: true})).toBeFocused();
});

test('back and forward retain exact offsets, support keyboard traversal and discard the replaced branch', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers?view=reader'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await page.evaluate(() => document.fonts.ready);
  await reader.evaluate(el => {el.scrollTop = 480;}); await active(page, 0);
  const top = await reader.evaluate(el => el.scrollTop);
  await locate(page, 9); await locate(page, 17);
  await reader.press('Alt+ArrowLeft'); await active(page, 8);
  await reader.press('Alt+ArrowLeft'); await active(page, 0);
  await expect.poll(async () => Math.abs(await reader.evaluate(el => el.scrollTop) - top)).toBeLessThan(2);
  await reader.press('Alt+ArrowRight'); await active(page, 8);
  await reader.press('Alt+ArrowRight'); await active(page, 16);
  await page.getByRole('button', {name: '返回刚才的位置', exact: true}).click(); await active(page, 8);
  await locate(page, 22);
  await expect(page.getByRole('button', {name: '前进到下一处阅读位置'})).toBeDisabled();
  await page.getByRole('button', {name: '返回刚才的位置', exact: true}).click(); await active(page, 8);
  await page.getByRole('button', {name: '前进到下一处阅读位置'}).click(); await active(page, 21);
});

test('history selection keeps intermediate forward destinations and resets on another paper', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper, {...paper, id: 'other-convenience', title: 'Another evidence source'}]});
  await page.goto('/papers?view=reader'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await locate(page, 9); await locate(page, 17);
  await page.getByText('阅读轨迹', {exact: true}).click();
  await page.getByRole('navigation', {name: '阅读轨迹', exact: true}).getByRole('button', {name: 'Introduction · 第 1 段', exact: true}).click();
  await active(page, 0);
  await page.getByRole('button', {name: '前进到下一处阅读位置'}).click(); await active(page, 8);
  await page.getByRole('button', {name: '前进到下一处阅读位置'}).click(); await active(page, 16);
  await page.getByRole('button', {name: '论文库', exact: true}).click();
  await page.locator('.plab-index-open').filter({hasText: 'Another evidence source'}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue('Another evidence source');
  await expect(page.getByRole('button', {name: '前进到下一处阅读位置'})).toBeHidden();
  await expect(page.getByRole('button', {name: '返回刚才的位置'})).toBeHidden();
});

test('mobile source jumps offer return and forward while preserving the source offset', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers?view=reader'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await locate(page, 4);
  const offset = () => page.locator('[data-paragraph-index="3"]').evaluate(el => el.getBoundingClientRect().top - document.querySelector('.paper-reading-navigation')!.getBoundingClientRect().bottom);
  const before = await offset();
  await locate(page, 20);
  await page.getByRole('button', {name: '返回刚才的位置', exact: true}).click(); await active(page, 3);
  await expect.poll(async () => Math.abs(await offset() - before)).toBeLessThan(2);
  await page.getByRole('button', {name: '前进到下一处阅读位置'}).click(); await active(page, 19);
});

for (const width of [1440, 768, 375]) test(`location and history controls fit ${width}px and expose accessible keyboard help`, async ({page}) => {
  await page.setViewportSize({width, height: 900}); await page.emulateMedia({reducedMotion: 'reduce'});
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers?view=reader'); await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await locate(page, 9);
  await page.getByRole('button', {name: 'Results', exact: true}).click(); await active(page, 16);
  await page.getByRole('button', {name: '跳转位置', exact: true}).click();
  await page.getByText('阅读区快捷键', {exact: true}).click();
  const panel = page.getByRole('region', {name: '跳转位置', exact: true});
  await expect(panel).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const violations = (await new AxeBuilder({page}).include('.plab-shell').analyze()).violations;
  expect(violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
  await mkdir('outputs/reader-convenience-2026-10-21', {recursive: true});
  await page.screenshot({path: `outputs/reader-convenience-2026-10-21/location-${width}.png`});
});
