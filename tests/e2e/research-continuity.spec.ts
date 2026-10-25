import {expect, test, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installApiMocks, type MockProject} from './helpers';
import type {PaperRecord} from '../../app/papers/paper-types';
import type {ProjectEvidence} from '../../app/lib/project-evidence';

test.setTimeout(120_000);

const now = '2026-10-24T08:00:00.000Z';
const paper: PaperRecord = {id: 'continuity-paper', title: '睡眠与学习：研究方法', fileName: 'methods.pdf', addedAt: 1, updatedAt: 1, activeParagraph: 1,
  paragraphs: ['Introduction', 'Methods'].map((section, index) => ({id: `continuity-${index}`, section, page: index + 1,
    original: `${section}: The study compares sleep duration and learning outcomes. Measurements and uncertainty should be checked against the original source.`, translation: '', note: '保留独立阅读笔记', read: false, bookmarked: false}))};
const evidence: ProjectEvidence = {id: 'evidence-original', paperId: paper.id, paragraphId: 'continuity-1', paperTitle: paper.title, fileName: paper.fileName, page: 2, section: 'Methods', quote: 'The study compares sleep duration and learning outcomes.', comment: '先核对方法', createdAt: 1};
const other: MockProject = {id: 'other-project', title: '另一项研究', kind: 'paper', status: 'active', metadata: {notes: '其他项目不可改写'}, created_at: now, updated_at: now};
const project: MockProject & {metadata: MockProject['metadata'] & {evidence: ProjectEvidence[]}} = {id: 'sleep-project', title: '睡眠与学习成绩研究', kind: 'paper', status: 'active', metadata: {notes: '保留原有研究思路', tasks: [], evidence: [evidence]}, created_at: now, updated_at: now};
const out = 'outputs/research-continuity-2026-10-24';
async function capture(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir(out, {recursive: true});
  await page.screenshot({path: `${out}/${name}.png`, animations: 'disabled'});
}

for (const width of [1440, 375]) test(`research stays with the chosen project through paper, analysis and return ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: width === 375 ? 812 : 1000});
  await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library: false, notes: true})));
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [paper], projects: [other, structuredClone(project)]});
  await page.goto('/projects?project=sleep-project');
  const materials = page.getByRole('region', {name: '研究资料', exact: true});
  await materials.getByRole('link', {name: paper.title, exact: true}).click();
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(paper.title);
  await expect(page).toHaveURL(/paragraph=continuity-1.*project=sleep-project/);
  const trail = page.getByRole('complementary', {name: '当前研究项目', exact: true});
  await expect(trail).toContainText(project.title);
  if (width === 375) await page.getByRole('tab', {name: '笔记', exact: true}).click();
  await page.locator('.plab-rail-actions').getByRole('button', {name: '加入项目', exact: true}).click();
  const picker = page.getByRole('dialog', {name: '将摘录加入项目'});
  await expect(picker.getByLabel('选择项目', {exact: true})).toHaveValue(project.id);
  await picker.getByLabel('个人评论', {exact: true}).fill('需要结合分析检查的原文方法');
  await picker.getByRole('button', {name: '加入项目', exact: true}).click();
  await expect(picker).not.toBeVisible();
  expect((state.projects[1].metadata as typeof project.metadata).evidence).toHaveLength(2);
  await trail.getByRole('link', {name: '分析数据', exact: true}).click();
  await expect(page).toHaveURL(/\/data\?project=sleep-project$/);
  await expect(trail).toContainText(project.title);
  await capture(page, `data-context-${width}`);
  await page.getByText('保存快照与导出复现包', {exact: true}).click();
  await page.getByLabel('分析快照名称', {exact: true}).fill('睡眠描述统计 · 第一版');
  await page.getByRole('button', {name: '保存命名快照', exact: true}).click();
  await page.getByRole('link', {name: '查看快照并关联项目', exact: true}).click();
  const snapshot = page.getByRole('region', {name: '已保存分析快照', exact: true});
  await expect(snapshot).toContainText('睡眠描述统计 · 第一版');
  await snapshot.getByText('关联快照到项目', {exact: true}).click();
  await expect(snapshot.getByRole('combobox', {name: '关联项目', exact: true})).toHaveValue(project.id);
  await snapshot.getByLabel('分析解释', {exact: true}).fill('这是示例数据的描述统计，用于检查研究流程，不能代替真实研究结果。');
  await snapshot.getByLabel('下一步任务（可选）', {exact: true}).fill('导入真实研究数据并核对变量');
  await snapshot.getByRole('button', {name: '保存关联与下一步', exact: true}).click();
  await expect.poll(() => state.projects[1].metadata.analysisRecords?.length).toBe(1);
  expect(state.projects[1].metadata.analysisRecords?.[0]).toMatchObject({role:'exploratory',name:'睡眠描述统计 · 第一版',interpretation:'这是示例数据的描述统计，用于检查研究流程，不能代替真实研究结果。'});
  expect(state.projects[1].metadata.analysisRecords?.[0].dataset.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(state.projects[1].metadata.analysisRecords?.[0].sample).toBe(true);
  await snapshot.getByRole('link', {name: '打开关联项目', exact: true}).click();
  await expect(materials).toContainText('睡眠描述统计 · 第一版');
  await expect(page.locator('#project-notes')).toHaveValue(/保留原有研究思路/);
  await expect(page.locator('.project-tasks')).toContainText('导入真实研究数据并核对变量');
  expect(state.projects[0]).toEqual(other);
  await materials.scrollIntoViewIfNeeded();
  await capture(page, `project-materials-${width}`);
  await materials.getByRole('link', {name: '睡眠描述统计 · 第一版', exact: true}).click();
  await expect(snapshot).toContainText('睡眠描述统计 · 第一版');
  await expect(trail).toContainText(project.title);
  await trail.getByRole('link', {name: '查阅论文', exact: true}).click();
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(paper.title);
  if (width === 375) await page.getByRole('tab', {name: '笔记', exact: true}).click();
  await expect(page.getByLabel('段落笔记', {exact: true})).toHaveValue('保留独立阅读笔记');
});

test('missing or changed accounts do not silently substitute a research project', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, projects: [other, project]});
  await page.goto('/data?project=missing-project');
  const trail = page.getByRole('complementary', {name: '当前研究项目', exact: true});
  await expect(trail).toContainText('没有切换到其他项目');
  await expect(trail).not.toContainText(other.title);
  expect(state.requests.filter(value => value === 'PATCH /api/projects')).toHaveLength(0);
  await page.goto('/data?project=sleep-project');
  await expect(trail).toContainText(project.title);
  state.userId = 'different-owner'; state.projects = [];
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(trail).toContainText('没有切换到其他项目');
  await expect(trail).not.toContainText(project.title);
  await trail.getByRole('link', {name: '独立使用当前工作台', exact: true}).click();
  await expect(page).not.toHaveURL(/project=/);
  await page.goto('/courses');
  await expect(page.getByRole('complementary', {name: '当前研究项目', exact: true})).toHaveCount(0);
  await expect(page.getByRole('complementary', {name: '研究项目关联', exact: true})).toHaveCount(0);
});

test('independent paper reading shows existing project links without creating another association', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, projects: [project], cloudPapers: [paper]});
  await page.goto('/papers?paper=continuity-paper&paragraph=continuity-1');
  const related = page.getByRole('navigation', {name: '已关联的研究项目', exact: true});
  await expect(related.getByRole('link', {name: project.title, exact: true})).toBeVisible();
  expect(state.requests.filter(value => value === 'PATCH /api/projects')).toHaveLength(0);
  await related.getByRole('link', {name: project.title, exact: true}).click();
  await expect(page.getByRole('heading', {name: project.title, exact: true})).toBeVisible();
});
