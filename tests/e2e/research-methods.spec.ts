import {expect, test, type Page} from '@playwright/test';
import {installApiMocks, type MockProject} from './helpers';
import {validateLedgerPayload, type LedgerEvent, type LedgerKind} from '../../app/lib/research-ledger';

test.setTimeout(120000);
const owner = '91000000-0000-4000-8000-000000000001', other = '91000000-0000-4000-8000-000000000002', projectId = '92000000-0000-4000-8000-000000000001', now = '2026-10-25T05:00:00.000Z';
const project: MockProject = {id: projectId, title: '方法与统计规划 · 合成验证', kind: 'paper', status: 'active', metadata: {notes: '既有笔记保持完整。'}, created_at: now, updated_at: now};
type Write = {kind: LedgerKind; entityId: string; expectedRevision: number; payload: Record<string, unknown>; archived: boolean; expectedOwnerId: string};
const event = (collection: LedgerKind, payload: Record<string, unknown>, index: number): LedgerEvent => ({id: `93000000-0000-4000-8000-${String(index).padStart(12, '0')}`, entity_id: `94000000-0000-4000-8000-${String(index).padStart(12, '0')}`, sequence: index, revision: 1, project_id: projectId, user_id: owner, collection, payload, archived: false, created_at: now, origin: null});
const run = (name: string, p: number, index: number) => event('run', {name, specificationId: `95000000-0000-4000-8000-${String(index).padStart(12, '0')}`, protocolId: '', status: 'success', sourceFingerprint: 'a'.repeat(64), dataFingerprint: 'b'.repeat(64), settingsHash: 'c'.repeat(64), engine: 'acaora-stats-v2', sample: true, metrics: [['p', String(p)], ['n', '80']], error: '', startedAt: now, elapsedMs: 5, settings: '{}'}, index);
async function openMethods(page: Page) {await page.getByRole('tab', {name: '方法与检验', exact: true}).click(); const methods = page.getByRole('region', {name: '研究设计与统计规划', exact: true}); await expect(methods).toBeVisible(); return methods;}
async function setup(page: Page, initial: LedgerEvent[] = [], lostFamily = false) {
  const state = await installApiMocks(page, {signedIn: true, userId: owner, projects: [structuredClone(project)]}), events = structuredClone(initial), writes: Write[] = [];
  let lose = lostFamily;
  await page.route('**/api/projects/workbench**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({json: {project: state.projects[0], events}});
    const body = route.request().postDataJSON() as Write; writes.push(body);
    expect(body.expectedOwnerId).toBe(state.userId); expect(validateLedgerPayload(body.kind, body.payload)).toBe(true);
    const latest = events.filter(item => item.entity_id === body.entityId).at(-1);
    if (latest && latest.revision === body.expectedRevision + 1 && JSON.stringify(latest.payload) === JSON.stringify(body.payload)) return route.fulfill({json: {event: latest}});
    if ((latest?.revision ?? 0) !== body.expectedRevision) return route.fulfill({status: 409, json: {error: '模拟并发冲突，输入保留。'}});
    const saved: LedgerEvent = {id: crypto.randomUUID(), entity_id: body.entityId, sequence: events.length + 1, revision: body.expectedRevision + 1, project_id: projectId, user_id: state.userId, collection: body.kind, payload: body.payload, archived: body.archived, created_at: now, origin: null}; events.push(saved);
    if (lose && body.kind === 'family') {lose = false; return route.fulfill({status: 503, json: {error: '模拟检验族响应丢失，输入保留。'}});}
    return route.fulfill({json: {event: saved}});
  });
  await page.goto(`/projects?project=${projectId}`); const methods = await openMethods(page); return {state, events, writes, methods};
}

test('causal form constructs measured confounding, diagnoses adjustment and saves a real design', async ({page}) => {
  const {methods, events} = await setup(page), design = methods.getByRole('region', {name: '识别策略与因果图', exact: true});
  await design.getByRole('textbox', {name: '设计标题', exact: true}).fill('处理与结果的条件关联设计'); await design.getByRole('textbox', {name: '估计对象与目标效应', exact: true}).fill('给定图假设下的处理总效应，实际识别仍需核实。');
  await design.getByRole('textbox', {name: '新变量名称', exact: true}).fill('共同原因'); await design.getByRole('button', {name: '添加变量', exact: true}).click();
  await design.getByRole('combobox', {name: '箭头起点', exact: true}).selectOption({label: '共同原因'}); await design.getByRole('combobox', {name: '箭头终点', exact: true}).selectOption({label: '处理变量'}); await design.getByRole('button', {name: '添加方向边', exact: true}).click();
  await design.getByRole('combobox', {name: '箭头终点', exact: true}).selectOption({label: '结果变量'}); await design.getByRole('button', {name: '添加方向边', exact: true}).click();
  await design.getByRole('button', {name: '诊断图内后门路径', exact: true}).click(); await expect(design.getByRole('status')).toContainText('仍有开放路径');
  await design.getByRole('checkbox', {name: '调整：共同原因', exact: true}).check(); await design.getByRole('button', {name: '诊断图内后门路径', exact: true}).click(); await expect(design.getByRole('status')).toContainText('已阻断图内路径'); await expect(design).toContainText('不证明因果识别');
  await expect(design.getByRole('img', {name: /研究者声明的因果关系图/})).toBeVisible(); await design.getByRole('button', {name: '保存研究设计', exact: true}).click(); await expect.poll(() => events.filter(item => item.collection === 'design').length).toBe(1);
  expect((events.find(item => item.collection === 'design')!.payload.graph as {adjustment: string[]}).adjustment).toHaveLength(1);
  await design.getByRole('button', {name: '新建研究设计', exact: true}).click(); await expect(design.getByRole('textbox', {name: '设计标题', exact: true})).toHaveValue(''); await expect(design.getByRole('button', {name: '保存研究设计', exact: true})).toBeVisible();
});

test('conditioning a saved collider descendant opens its path and preserves the original graph version', async ({page}) => {
  const edges = [['A', 'T'], ['A', 'C'], ['B', 'C'], ['B', 'Y'], ['C', 'D'], ['T', 'Y']], labels: Record<string, string> = {T: '处理变量', Y: '结果变量', A: '原因甲', B: '原因乙', C: '碰撞点', D: '碰撞点后代'};
  const saved = event('design', {title: '碰撞点条件化验证', estimand: '图条件下的目标总效应', population: '', timeOrder: '', assumptions: '', threats: '', protocolId: '', graph: {nodes: Object.entries(labels).map(([id, label]) => ({id, label})), edges: edges.map(([from, to]) => ({from, to})), exposure: 'T', outcome: 'Y', adjustment: []}}, 1);
  const {methods, events} = await setup(page, [saved]), design = methods.getByRole('region', {name: '识别策略与因果图', exact: true}); await design.getByRole('combobox', {name: '查看已保存的研究设计', exact: true}).selectOption(saved.entity_id);
  await design.getByRole('button', {name: '诊断图内后门路径', exact: true}).click(); await expect(design.getByRole('status')).toContainText('已阻断图内路径'); await design.getByRole('checkbox', {name: '调整：碰撞点后代', exact: true}).check(); await design.getByRole('button', {name: '诊断图内后门路径', exact: true}).click(); await expect(design.getByRole('status')).toContainText('仍有开放路径');
  await design.getByRole('button', {name: '保存研究设计新版本', exact: true}).click(); await expect.poll(() => events.filter(item => item.collection === 'design').length).toBe(2); expect((events[0].payload.graph as {adjustment: string[]}).adjustment).toEqual([]); expect((events[1].payload.graph as {adjustment: string[]}).adjustment).toEqual(['D']);
});

test('power calculation saves verified normal-approximation results and blocks stale input', async ({page}) => {
  const {methods, events} = await setup(page); await methods.getByRole('tab', {name: '统计功效与精度', exact: true}).click(); const power = methods.getByRole('region', {name: '统计功效与精度规划', exact: true});
  await power.getByRole('textbox', {name: '功效计划名称', exact: true}).fill('两独立组预期效应规划'); await power.getByRole('button', {name: '计算功效、样本量与最小可检测效应', exact: true}).click();
  await expect(power.getByRole('region', {name: '功效计算结果', exact: true})).toContainText('63 人 / 观察单位；两组总计 126'); await power.getByRole('button', {name: '保存功效计划', exact: true}).click(); await expect.poll(() => events.filter(item => item.collection === 'power').length).toBe(1);
  const saved = events.find(item => item.collection === 'power')!.payload; expect(saved.method).toBe('two-independent-normal'); expect((saved.result as {power: number}).power).toBeCloseTo(.8074304194325572, 12); await expect(power).toContainText('不使用非中心 t 分布');
  await power.getByRole('spinbutton', {name: '双侧显著性水平 α', exact: true}).fill('0.01'); await expect(power.getByRole('button', {name: '保存功效计划新版本', exact: true})).toBeDisabled(); await expect(power.getByRole('status').filter({hasText: '输入已变化'})).toBeVisible(); await methods.getByRole('tab', {name: '识别策略与因果图', exact: true}).click(); await methods.getByRole('tab', {name: '统计功效与精度', exact: true}).click(); await expect(power.getByRole('spinbutton', {name: '双侧显著性水平 α', exact: true})).toHaveValue('0.01'); await expect(power.getByRole('button', {name: '保存功效计划新版本', exact: true})).toBeDisabled();
});

test('complete hypothesis family preserves missing results, retries one plan and saves corrected p values as a revision', async ({page}) => {
  const first = run('预声明检验一', .01, 1), second = run('预声明检验二', .04, 2), {methods, events, writes} = await setup(page, [first, second], true); await methods.getByRole('tab', {name: '假设族与多重检验', exact: true}).click(); const family = methods.getByRole('region', {name: '假设族与多重检验', exact: true});
  await family.getByRole('textbox', {name: '检验族名称', exact: true}).fill('同一研究问题的两个预声明检验'); await family.getByRole('textbox', {name: '假设 1 内容', exact: true}).fill('第一项预期效应'); await family.getByRole('button', {name: '添加假设', exact: true}).click(); await family.getByRole('textbox', {name: '假设 2 内容', exact: true}).fill('第二项预期效应'); await family.getByRole('textbox', {name: '检验族范围与修订依据', exact: true}).fill('完整研究问题族，预先保留全部两项。'); await family.getByRole('button', {name: '保存检验族计划', exact: true}).click(); await expect(methods.getByRole('alert')).toContainText('模拟检验族响应丢失');
  await methods.getByRole('tab', {name: '统计功效与精度', exact: true}).click(); await methods.getByRole('tab', {name: '假设族与多重检验', exact: true}).click(); await family.getByRole('button', {name: '保存检验族计划', exact: true}).click(); await expect(family.getByRole('status')).toContainText('已保存'); expect(events.filter(item => item.collection === 'family')).toHaveLength(1); expect(writes[0].entityId).toBe(writes[1].entityId);
  await family.getByRole('button', {name: '对完整假设族计算校正', exact: true}).click(); await expect(family.getByRole('alert')).toContainText('仍有缺失结果'); expect(events.filter(item => item.collection === 'family')).toHaveLength(1);
  await family.getByRole('combobox', {name: '假设 1 的结果运行', exact: true}).selectOption(first.entity_id); await family.getByRole('combobox', {name: '假设 1 的 p 值指标', exact: true}).selectOption('p'); await family.getByRole('button', {name: '对完整假设族计算校正', exact: true}).click(); await expect(family.getByRole('alert')).toContainText('仍有缺失结果');
  await family.getByRole('combobox', {name: '假设 2 的结果运行', exact: true}).selectOption(second.entity_id); await family.getByRole('combobox', {name: '假设 2 的 p 值指标', exact: true}).selectOption('p'); await family.getByRole('textbox', {name: '检验族范围与修订依据', exact: true}).fill('补齐原定两项运行的 p 值，并对完整族采用 Holm；未删除无结果项。'); await family.getByRole('button', {name: '对完整假设族计算校正', exact: true}).click(); await family.getByRole('button', {name: '保存检验族结果新版本', exact: true}).click(); await expect.poll(() => events.filter(item => item.collection === 'family').length).toBe(2);
  const plans = events.filter(item => item.collection === 'family'); expect(plans[0].payload.phase).toBe('planned'); expect((plans[0].payload.hypotheses as {p: number | null}[]).every(row => row.p === null)).toBe(true); expect((plans[1].payload.hypotheses as {adjusted: number}[]).map(row => row.adjusted)).toEqual([.02, .04]); expect(writes.at(-1)!.expectedRevision).toBe(1);
});

test('unsaved method drafts remain isolated between accounts and recover for their original owner', async ({page}) => {
  const {methods, state, writes} = await setup(page); await methods.getByRole('textbox', {name: '设计标题', exact: true}).fill('仅甲账户可恢复的方法草稿'); state.userId = other; await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change'))); const switched = await openMethods(page); await expect(switched.getByRole('textbox', {name: '设计标题', exact: true})).toHaveValue('');
  state.userId = owner; await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change'))); const restored = await openMethods(page); await expect(restored.getByRole('textbox', {name: '设计标题', exact: true})).toHaveValue('仅甲账户可恢复的方法草稿'); expect(writes).toHaveLength(0);
});
