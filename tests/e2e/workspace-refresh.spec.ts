import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installApiMocks, type MockProject} from './helpers';

const project: MockProject = {
  id: 'redesign-project', title: '示例：课程研究计划', kind: 'paper', status: 'active',
  metadata: {goal: '整理原文依据，完成课程研究报告。', notes: '示例笔记：先核对变量定义。', tasks: [{id: 'review-sources', text: '核对论文中的研究方法', done: false}]},
  created_at: '2026-10-12T00:00:00Z', updated_at: '2026-10-12T00:00:00Z',
};
const paper = {
  id: 'redesign-paper', title: '示例：研究方法与原文依据', fileName: 'example.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 0,
  paragraphs: ['Introduction', 'Methods', 'Results'].map((section, i) => ({id: `sample-${i}`, page: i + 1, section,
    original: 'Demonstration text. This paragraph describes how the source material, research method, and findings should be checked before making a conclusion. '.repeat(8),
    translation: '', note: '示例笔记：对照原文核查。', bookmarked: false, read: false})),
};

for (const width of [1440, 375]) {
  test(`workspace redesign ${width}px preserves task access and captures proposed visuals`, async ({page}) => {
    await page.setViewportSize({width, height: width === 375 ? 812 : 1000});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await installApiMocks(page, {signedIn: true, projects: [project], cloudPapers: [paper]});
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await mkdir('outputs/workspace-redesign-2026-10-12', {recursive: true});
    for (const [path, heading] of [['courses', '课程中心'], ['papers', '论文研究'], ['data', '数据分析'], ['projects', '项目空间'], ['settings', '设置']]) {
      await page.goto(`/${path}`);
      await expect(page.getByRole('heading', {name: heading, exact: true, level: 1})).toBeVisible();
      if (path === 'papers') await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
      if (path === 'projects') await expect(page.getByRole('heading', {name: project.title, exact: true})).toBeVisible();
      if (path === 'settings') await expect(page.locator('#settings-name')).toHaveValue('测试同学');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      await page.screenshot({path: `outputs/workspace-redesign-2026-10-12/${path}-${width}.png`, fullPage: path !== 'papers', animations: 'disabled'});
    }
    expect(errors).toEqual([]);
  });
}

test('selection motion is interruptible and reduced motion still identifies the active mode', async ({page}) => {
  await installApiMocks(page, {signedIn: true, cloudPapers: [paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  const modes = page.getByRole('navigation', {name: '论文工作模式'});
  await modes.getByRole('button', {name: '学术检索', exact: true}).click();
  expect(await modes.locator('.motion-navigation-marker').evaluate(element => element.getAnimations().length)).toBeGreaterThan(0);
  await modes.getByRole('button', {name: 'AI 分析', exact: true}).click();
  await modes.getByRole('button', {name: '阅读与笔记', exact: true}).click();
  await expect(modes.getByRole('button', {name: '阅读与笔记', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', {name: '论文正文', exact: true})).toBeVisible();
  await page.emulateMedia({reducedMotion: 'reduce'});
  await modes.getByRole('button', {name: '学术检索', exact: true}).click();
  await expect.poll(() => modes.evaluate(element => element.getAnimations({subtree: true}).length)).toBe(0);
  const selected = modes.getByRole('button', {name: '学术检索', exact: true});
  await expect(selected).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => {
    const button = await selected.boundingBox();
    const marker = await modes.locator('.motion-navigation-marker').boundingBox();
    return Boolean(button && marker && Math.abs(button.x - marker.x) < 1 && Math.abs(button.width - marker.width) < 1);
  }).toBe(true);
});
