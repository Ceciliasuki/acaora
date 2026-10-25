import {expect, test, type Page} from '@playwright/test';
import {mkdir, readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks, type MockProject} from './helpers';
import {emptyResearchDossier, type ProjectAnalysisRecord} from '../../app/lib/project-research';

test.setTimeout(120_000);
const now = '2026-10-24T10:00:00.000Z';
const analysis = (id: string, role: ProjectAnalysisRecord['role'], fingerprint: string, rows: number, coefficient: string): ProjectAnalysisRecord => ({id, snapshotId: `snapshot-${id}`, name: role === 'primary' ? '主模型 · 合成流程验证' : '排除规则敏感性 · 合成流程验证', role, sample: true, method: 'OLS · HC3', context: 'X：睡眠时长；Y：学习成绩；合成记录仅用于验证工作台。', settings: JSON.stringify({outcome: '学习成绩', predictors: ['睡眠时长'], standardErrors: 'HC3'}), dataset: {name: 'synthetic-study.csv', rows, fingerprint: fingerprint.repeat(64), sourceFingerprint: 'a'.repeat(64)}, metrics: [['样本量', String(rows)], ['睡眠时长系数', coefficient]], interpretation: '合成流程验证，不作为真实研究结论。', evidenceIds: ['source-one'], createdAt: now, registeredAt: now});
const project: MockProject = {id: 'professional-project', title: '睡眠与学习成绩 · 研究流程验证', kind: 'paper', status: 'active', created_at: now, updated_at: now, metadata: {goal: '形成可以逐项核对来源的实证研究记录', notes: '原有研究笔记必须保留。', tasks: [{id: 'task-original', text: '核实样本纳入标准', done: false}], evidence: [{id: 'source-one', paperId: 'source-paper', paragraphId: 'methods-2', paperTitle: '研究设计示例文献', fileName: 'synthetic-source.pdf', page: 2, section: 'Methods', quote: 'The sample selection criteria should be specified before interpreting estimates.', comment: '比较样本规则与模型结果。', createdAt: 1}], analysisRecords: [analysis('main', 'primary', 'b', 80, '0.23'), analysis('sensitivity', 'robustness', 'c', 72, '0.18')], research: emptyResearchDossier()}};
const out = 'outputs/professional-research-2026-10-24';
async function screenshot(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir(out, {recursive: true}); await page.screenshot({path: `${out}/${name}.png`, animations: 'disabled'});
}

for (const width of [1440, 375]) test(`empirical research design, traceable findings and saved-record export ${width}px`, async ({page}) => {
  await page.setViewportSize({width, height: width === 375 ? 812 : 1100});
  const state = await installApiMocks(page, {signedIn: true, projects: [structuredClone(project)]});
  await page.goto('/projects?project=professional-project');
  const workspace = page.getByRole('region', {name: '研究工作台', exact: true});
  await workspace.getByLabel('研究问题', {exact: true}).fill('在既定样本与控制条件下，睡眠时长与学习成绩存在怎样的关联？');
  await workspace.getByLabel('研究假设', {exact: true}).fill('假设关联为正，但观察性设计仍可能存在未观测混杂。');
  await workspace.getByLabel('数据来源', {exact: true}).fill('合成研究数据，仅用于验证界面流程。');
  await workspace.getByLabel('分析与识别策略', {exact: true}).fill('OLS 与 HC3 标准误；只作条件关联解释，不据此确认因果。');
  await expect(workspace.getByRole('status')).toContainText('研究草稿已保存在本机');
  await page.reload();
  await expect(workspace.getByLabel('研究问题', {exact: true})).toHaveValue(/既定样本/);
  await workspace.getByText('样本、变量、稳健性与局限', {exact: true}).click();
  await workspace.getByLabel('样本与排除规则', {exact: true}).fill('记录纳入与排除规则，不按显著性调整样本。');
  await workspace.getByLabel('变量与测量', {exact: true}).fill('睡眠时长按小时记录，学习成绩按同一评分标准测量。');
  await workspace.getByLabel('稳健性与敏感性检查', {exact: true}).fill('比较不同纳入规则，并保留不一致结果。');
  await workspace.getByLabel('已知局限', {exact: true}).fill('观察性设计；结果对样本规则可能敏感。');
  await workspace.getByRole('button', {name: '保存研究记录', exact: true}).click();
  await expect(workspace.getByRole('status')).toContainText('显示账户已保存记录');
  expect(state.projects[0].metadata.notes).toBe(project.metadata.notes);
  expect(state.projects[0].metadata.tasks).toEqual(project.metadata.tasks);
  await workspace.getByRole('tab', {name: '分析台账', exact: true}).click();
  await workspace.getByLabel('分析 A', {exact: true}).selectOption('main');
  await workspace.getByLabel('分析 B', {exact: true}).selectOption('sensitivity');
  await expect(workspace.getByText(/处理表指纹不同/)).toBeVisible();
  const table = workspace.getByRole('table', {name: '已保存的分析摘要'});
  await expect(table).toContainText('0.23'); await expect(table).toContainText('0.18');
  await workspace.getByRole('tabpanel', {name: '分析台账', exact: true}).scrollIntoViewIfNeeded();
  await screenshot(page, `analysis-register-${width}`);
  await workspace.getByRole('tab', {name: '结论与证据', exact: true}).click();
  await workspace.getByRole('button', {name: '新增研究结论', exact: true}).click();
  await workspace.getByLabel('结论陈述 1', {exact: true}).fill('两种样本规则下的登记系数均为正，仍需核对识别假设与不确定性。');
  await workspace.getByLabel('研究者判读 1', {exact: true}).selectOption('supported');
  await workspace.getByRole('button', {name: '保存研究记录', exact: true}).click();
  await expect(workspace.getByRole('alert')).toContainText('至少关联一条');
  await workspace.getByRole('checkbox', {name: '论文摘录 1：研究设计示例文献 · source-one', exact: true}).check();
  await workspace.getByRole('checkbox', {name: '分析记录 1：主模型 · 合成流程验证', exact: true}).check();
  await workspace.getByRole('checkbox', {name: '分析记录 1：排除规则敏感性 · 合成流程验证', exact: true}).check();
  await workspace.getByLabel('局限与替代解释 1', {exact: true}).fill('系数同号不等同于显著、稳健或因果成立；尚需未观测混杂与测量误差检查。');
  await workspace.getByRole('button', {name: '保存研究记录', exact: true}).click();
  await expect(workspace.getByRole('status')).toContainText('显示账户已保存记录');
  const finding = state.projects[0].metadata.research!.findings[0];
  expect(finding.evidenceIds).toEqual(['source-one']); expect(finding.analysisIds).toEqual(['main', 'sensitivity']);
  await workspace.locator('summary').filter({hasText: finding.statement}).click();
  await workspace.getByRole('tabpanel', {name: '结论与证据', exact: true}).scrollIntoViewIfNeeded();
  await screenshot(page, `finding-sources-${width}`);
  const pending = page.waitForEvent('download'); await workspace.getByRole('button', {name: '导出研究档案', exact: true}).click();
  const file = await pending, markdown = await readFile((await file.path())!, 'utf8');
  expect(markdown).toContain('不构成预注册'); expect(markdown).toContain('0.23'); expect(markdown).toContain(project.metadata.evidence![0].quote);
  expect(markdown).toContain('数据类别：示例数据');
  expect(markdown).toContain('/papers?paper=source-paper&paragraph=methods-2&project=professional-project');
  const pendingJson = page.waitForEvent('download'); await workspace.getByRole('button', {name: '导出研究记录 JSON', exact: true}).click();
  const jsonFile = await pendingJson, json = JSON.parse(await readFile((await jsonFile.path())!, 'utf8'));
  expect(json.project.research.findings[0].statement).toBe(finding.statement);
  expect(json.project.analyses).toHaveLength(2); expect(json.boundaries.sourceRowsIncluded).toBe(false); expect(json.boundaries.preregistered).toBe(false);
  const audit = await new AxeBuilder({page}).include('section[aria-labelledby$="-title"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.filter(entry => entry.impact === 'serious' || entry.impact === 'critical')).toEqual([]);
  if (width === 1440) {
    await page.locator('.project-evidence').getByRole('button', {name: '移除关联', exact: true}).click();
    await expect(workspace.getByRole('alert')).toContainText('部分关联材料已移除');
    expect(state.projects[0].metadata.research!.findings[0].statement).toBe(finding.statement);
  }
});

test('a concurrent research update keeps the local draft and latest unrelated project content', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, projects: [structuredClone(project)]});
  await page.goto('/projects?project=professional-project');
  const workspace = page.getByRole('region', {name: '研究工作台', exact: true});
  await workspace.getByLabel('研究问题', {exact: true}).fill('我的本机研究方案草稿');
  let held = true;
  await page.route('**/api/projects?**', async route => {
    if (!held || route.request().method() !== 'PATCH') return route.fallback();
    held = false;
    state.projects[0].metadata.research!.protocol.question = '另一操作刚保存的研究问题';
    state.projects[0].metadata.notes = '最新笔记，不可被研究方案覆盖。';
    state.projects[0].metadata.tasks!.push({id: 'latest-task', text: '其他操作新增任务', done: false});
    return route.fulfill({status: 409, json: {error: '研究记录已有其他修改。'}});
  });
  await workspace.getByRole('button', {name: '保存研究记录', exact: true}).click();
  await expect(workspace.getByRole('alert')).toContainText('本机草稿保留');
  await expect(workspace.getByLabel('研究问题', {exact: true})).toHaveValue('我的本机研究方案草稿');
  await expect(workspace.getByRole('button', {name: '保存研究记录', exact: true})).toBeDisabled();
  await workspace.getByText('比较账户中最新的研究记录', {exact: true}).click();
  await expect(workspace.getByRole('alert').locator('pre')).toContainText('另一操作刚保存的研究问题');
  await workspace.getByRole('button', {name: '已比较，确认采用研究草稿', exact: true}).click();
  await workspace.getByRole('button', {name: '保存研究记录', exact: true}).click();
  await expect(workspace.getByRole('status')).toContainText('显示账户已保存记录');
  expect(state.projects[0].metadata.notes).toBe('最新笔记，不可被研究方案覆盖。');
  expect(state.projects[0].metadata.tasks).toHaveLength(2);
  expect(state.projects[0].metadata.analysisRecords).toHaveLength(2);
});

test('research drafts remain isolated when another account opens the same project id', async ({page}) => {
  const state = await installApiMocks(page, {signedIn: true, projects: [structuredClone(project)]});
  await page.goto('/projects?project=professional-project');
  const workspace = page.getByRole('region', {name: '研究工作台', exact: true});
  await workspace.getByLabel('研究问题', {exact: true}).fill('第一账户的未保存研究问题');
  state.userId = 'new-research-owner'; state.projects = [structuredClone(project)];
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(workspace.getByLabel('研究问题', {exact: true})).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('acaora.research-draft.v1:user-e2e:professional-project'))).toContain('第一账户的未保存研究问题');
  expect(await page.evaluate(() => localStorage.getItem('acaora.research-draft.v1:new-research-owner:professional-project'))).toBeNull();
});
