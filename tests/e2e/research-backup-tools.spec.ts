import {expect, test, type Page, type Route} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {installApiMocks, type MockProject} from './helpers';
import {createProjectBackup, type LedgerEvent, type ProjectBackup} from '../../app/lib/research-ledger';

test.setTimeout(120_000);
const owner = '22222222-2222-4222-8222-222222222222', nextOwner = '77777777-7777-4777-8777-777777777777';
const projectId = '11111111-1111-4111-8111-111111111111', restoredId = '33333333-3333-4333-8333-333333333333';
const now = '2026-10-24T12:00:00.000Z';
const project: MockProject = {id: projectId, title: '备份流程验证项目', kind: 'paper', status: 'active', metadata: {notes: '原项目笔记，不可覆盖。', tasks: [{id: 'original-task', text: '保留原项目任务', done: false}]}, created_at: now, updated_at: now};
const event: LedgerEvent = {id: '44444444-4444-4444-8444-444444444444', sequence: 1, project_id: projectId, user_id: owner, collection: 'review', entity_id: '55555555-5555-4555-8555-555555555555', revision: 1, payload: {title: '核对备份恢复', category: 'data', severity: 'major', status: 'open', assignee: '', comment: '保留原件与版本。', resolution: '', links: []}, archived: false, created_at: now, origin: null};
type RestoreBody = {backup: ProjectBackup; importId: string; title: string; expectedOwnerId: string};
async function setup(page: Page, put?: (route: Route, body: RestoreBody, attempt: number) => Promise<void>) {
  const state = await installApiMocks(page, {signedIn: true, userId: owner, projects: [structuredClone(project)]});
  const backup = await createProjectBackup({id: project.id, title: project.title, kind: project.kind, status: project.status, metadata: project.metadata, updated_at: project.updated_at}, [event]);
  const writes: RestoreBody[] = [];
  await page.route('**/api/projects/workbench**', async route => {
    const url = new URL(route.request().url());
    if (route.request().method() === 'GET') return route.fulfill({json: url.searchParams.get('mode') === 'backup' ? backup : {project, events: [event]}});
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as RestoreBody; writes.push(body);
      if (put) return put(route, body, writes.length);
      return route.fulfill({json: {projectId: restoredId, reused: false}});
    }
    return route.fulfill({status: 405, json: {error: 'Unexpected test write'}});
  });
  await page.goto(`/projects?project=${projectId}`);
  await page.getByRole('tab', {name: '备份与恢复', exact: true}).click();
  const tools = page.getByRole('region', {name: '项目备份与恢复', exact: true});
  await expect(tools).toBeVisible();
  return {state, backup, writes, tools};
}
const file = (backup: ProjectBackup, name = 'project-backup.json') => ({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup))});
const acknowledge = (page: Page) => page.getByRole('checkbox', {name: '我确认恢复将创建新项目，且备份不含原始文件和本机完整快照', exact: true}).check();

test('real export and validated preview require acknowledgement before creating a new project', async ({page}) => {
  const {backup, writes, state, tools} = await setup(page);
  const pending = page.waitForEvent('download');
  await tools.getByRole('button', {name: '导出完整项目备份', exact: true}).click();
  const download = await pending, exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.manifest).toEqual(backup.manifest); expect(exported.events).toHaveLength(1);
  await tools.getByLabel('选择项目备份 JSON', {exact: true}).setInputFiles(file(exported));
  const preview = tools.getByRole('region', {name: '项目恢复预览', exact: true});
  await expect(preview).toContainText('1 条历史记录'); await expect(preview).toContainText('审阅问题 1 条');
  expect(writes).toHaveLength(0);
  const restore = tools.getByRole('button', {name: '确认创建恢复副本', exact: true});
  await expect(restore).toBeDisabled(); await acknowledge(page);
  await tools.getByLabel('恢复副本名称', {exact: true}).fill('研究记录恢复验证');
  await expect(restore).toBeDisabled(); await acknowledge(page); await restore.click();
  await expect(tools.getByRole('link', {name: '打开恢复后的项目', exact: true})).toHaveAttribute('href', `/projects?project=${restoredId}`);
  await expect(preview).toContainText(projectId); await expect(preview).toContainText(restoredId);
  expect(writes).toHaveLength(1); expect(writes[0].expectedOwnerId).toBe(owner); expect(writes[0].title).toBe('研究记录恢复验证');
  expect(state.projects[0]).toEqual(project);
});

test('altered backup contents are rejected before any restore request', async ({page}) => {
  const {backup, writes, tools} = await setup(page);
  const altered = structuredClone(backup); altered.project.metadata.notes = 'Content changed without updating the hash.';
  await tools.getByLabel('选择项目备份 JSON', {exact: true}).setInputFiles(file(altered, 'altered-backup.json'));
  await expect(tools.getByRole('alert')).toContainText('校验值不符');
  await expect(tools.getByRole('region', {name: '项目恢复预览', exact: true})).toHaveCount(0);
  expect(writes).toHaveLength(0);
});

test('lost response and file reselection reuse one operation; an explicit independent copy gets a new id', async ({page}) => {
  const created = new Map<string, string>();
  const {backup, writes, tools} = await setup(page, async (route, body, attempt) => {
    const reused = created.has(body.importId);
    if (!reused) created.set(body.importId, created.size === 0 ? restoredId : '66666666-6666-4666-8666-666666666666');
    if (attempt === 1) return route.abort('failed');
    return route.fulfill({json: {projectId: created.get(body.importId), reused}});
  });
  await tools.getByLabel('选择项目备份 JSON', {exact: true}).setInputFiles(file(backup));
  await tools.getByLabel('恢复副本名称', {exact: true}).fill('同一恢复操作');
  await acknowledge(page); await tools.getByRole('button', {name: '确认创建恢复副本', exact: true}).click();
  await expect(tools.getByRole('alert')).toContainText('结果未能确认');
  await expect(tools.getByLabel('恢复副本名称', {exact: true})).toHaveValue('同一恢复操作');
  await tools.getByLabel('选择项目备份 JSON', {exact: true}).setInputFiles(file(backup));
  await tools.getByLabel('恢复副本名称', {exact: true}).fill('同一恢复操作');
  await acknowledge(page); await tools.getByRole('button', {name: '确认创建恢复副本', exact: true}).click();
  await expect(tools.getByRole('status')).toContainText('没有再建立重复项目');
  expect(writes[1].importId).toBe(writes[0].importId); expect(created.size).toBe(1);
  await tools.getByRole('checkbox', {name: '明确另建一份独立副本（不同于上次相同备份的恢复操作）', exact: true}).check();
  await acknowledge(page); await tools.getByRole('button', {name: '确认创建恢复副本', exact: true}).click();
  await expect(tools.getByRole('status')).toContainText('已创建新的项目副本');
  expect(writes[2].importId).not.toBe(writes[0].importId); expect(created.size).toBe(2);
});

test('an account change discards a late file parse before exposing its project title', async ({page}) => {
  await page.addInitScript(() => {
    const original = File.prototype.text;
    const target = window as typeof window & {releaseBackupRead?: () => Promise<void>; backupReadHeld?: boolean};
    File.prototype.text = function () {
      if (this.name !== 'held-backup.json') return original.call(this);
      target.backupReadHeld = true;
      return new Promise<string>(resolve => {target.releaseBackupRead = () => original.call(this).then(resolve);});
    };
  });
  const {state, writes, tools} = await setup(page);
  const privateBackup = await createProjectBackup({id: project.id, title: '仅备份中存在的旧账户标题', kind: project.kind, status: project.status, metadata: project.metadata, updated_at: now}, [event]);
  await tools.getByLabel('选择项目备份 JSON', {exact: true}).setInputFiles(file(privateBackup, 'held-backup.json'));
  await expect.poll(() => page.evaluate(() => Boolean((window as typeof window & {backupReadHeld?: boolean}).backupReadHeld))).toBe(true);
  state.userId = nextOwner; state.projects = [{...structuredClone(project), title: '新账户研究项目'}];
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(page.getByRole('heading', {name: '新账户研究项目', exact: true})).toBeVisible();
  await page.evaluate(() => (window as typeof window & {releaseBackupRead?: () => Promise<void>}).releaseBackupRead?.());
  await expect(page.getByText('仅备份中存在的旧账户标题', {exact: false})).toHaveCount(0); expect(writes).toHaveLength(0);
});

test('an account change aborts a pending restore and suppresses a late success link', async ({page}) => {
  let release: () => void = () => {}, markStarted: () => void = () => {};
  const held = new Promise<void>(resolve => {release = resolve;}), started = new Promise<void>(resolve => {markStarted = resolve;});
  const {state, backup, tools} = await setup(page, async route => {
    markStarted(); await held;
    try {await route.fulfill({json: {projectId: restoredId, reused: false}});} catch { /* Aborting the old account request is expected. */ }
  });
  await tools.getByLabel('选择项目备份 JSON', {exact: true}).setInputFiles(file(backup));
  await acknowledge(page); await tools.getByRole('button', {name: '确认创建恢复副本', exact: true}).click(); await started;
  state.userId = nextOwner; state.projects = [{...structuredClone(project), title: '新账户研究项目'}];
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(page.getByRole('heading', {name: '新账户研究项目', exact: true})).toBeVisible();
  release();
  await expect(page.getByRole('link', {name: '打开恢复后的项目', exact: true})).toHaveCount(0);
});
