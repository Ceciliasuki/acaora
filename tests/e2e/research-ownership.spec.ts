import {expect, test} from '@playwright/test';
import {installApiMocks, type MockProject} from './helpers';
import type {PaperRecord} from '../../app/papers/paper-types';
import type {ProjectEvidence} from '../../app/lib/project-evidence';

const stamp = '2026-10-21T00:00:00.000Z';
function sourcePaper(id: string, title: string): PaperRecord {
  return {id, title, fileName: `${id}.pdf`, addedAt: 1, updatedAt: 2, activeParagraph: 0, paragraphs: Array.from({length: 8}, (_, index) => ({
    id: id === 'cloud-b' && index === 3 ? 'b-stable' : `${id}-${index}`,
    page: index + 1, section: 'Methods',
    original: `Controlled source ${title}, paragraph ${index + 1}. ${'The evidence belongs to this exact source paragraph and must retain its account boundary. '.repeat(12)}`,
    translation: '', note: `${id} source note ${index + 1}`, bookmarked: false, read: false,
  }))};
}

test('RESEARCH-OWNER-01 a cloud-only source link waits for cloud hydration after a local paper loads', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library: false, notes: true})));
  const local = sourcePaper('local-a', 'Local source A');
  const target = sourcePaper('cloud-b', 'Cloud source B');
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [local]});
  await page.goto('/papers?view=reader');
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(local.title);
  // The completed first hydration seeds only A in the real device store.
  const ids = await page.evaluate(async () => {
    const request = indexedDB.open('statlab-paper-memory', 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const transaction = database.transaction('papers', 'readonly');
      const read = transaction.objectStore('papers').getAllKeys();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    database.close();
    return keys;
  });
  expect(ids).toContain(local.id);
  expect(ids).not.toContain(target.id);
  state.cloudPapers = [local, target];
  let release!: () => void;
  const held = new Promise<void>(resolve => {release = resolve;});
  let markRead!: () => void;
  const readStarted = new Promise<void>(resolve => {markRead = resolve;});
  await page.route('**/api/cloud/papers', async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    markRead();
    await held;
    await route.fulfill({status: 200, contentType: 'application/json', headers: {'Cache-Control': 'private, no-store'}, body: JSON.stringify({papers: [local, target], deletions: []})});
  });
  try {
    await page.goto('/papers?paper=cloud-b&paragraph=b-stable');
    await readStarted;
    await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(local.title);
    await expect(page.getByText(/当前账户未找到原论文|当前设备未找到来源|原段落已不存在/)).toHaveCount(0);
    release();
    await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(target.title);
    await expect(page.getByLabel('段落笔记', {exact: true})).toHaveValue('cloud-b source note 4');
    await expect(page.locator('.plab-reading-context')).toContainText('第 4 / 8 段');
  } finally {release();}
});

test('RESEARCH-OWNER-02 account switching closes a loading evidence picker and discards its old project response', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 1000});
  await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library: false, notes: true})));
  const first = sourcePaper('account-a-source', 'Account A source');
  const second = sourcePaper('account-b-source', 'Account B source');
  const privateProject: MockProject = {id: 'private-a-project', title: 'Private account A project', kind: 'paper', status: 'active', metadata: {notes: 'A private note', tasks: []}, created_at: stamp, updated_at: stamp};
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [first], projects: [privateProject]});
  let release!: () => void;
  const held = new Promise<void>(resolve => {release = resolve;});
  let markRead!: () => void;
  const readStarted = new Promise<void>(resolve => {markRead = resolve;});
  let markFinished!: () => void;
  const readFinished = new Promise<void>(resolve => {markFinished = resolve;});
  let projectWrites = 0;
  await page.route('**/api/projects**', async route => {
    if (route.request().method() !== 'GET') {projectWrites++; return route.fallback();}
    markRead();
    await held;
    try {
      await route.fulfill({status: 200, contentType: 'application/json', headers: {'Cache-Control': 'private, no-store'}, body: JSON.stringify({projects: [privateProject]})});
    } catch { /* Aborting the old owner's request is the expected safe outcome. */ }
    finally {markFinished();}
  });
  try {
    await page.goto('/papers?view=reader');
    await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(first.title);
    await page.locator('.plab-rail-actions').getByRole('button', {name: '加入项目', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: '将摘录加入项目'});
    await expect(dialog).toBeVisible();
    await readStarted;
    await expect(dialog.getByText('正在读取项目…')).toBeVisible();
    state.userId = 'second-user';
    state.cloudPapers = [second];
    state.projects = [];
    await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
    await expect(dialog).toHaveCount(0);
    release();
    await readFinished;
    await page.getByRole('button',{name:`打开论文：${second.title}`,exact:true}).click();
    await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(second.title);
    await expect(page.getByText(privateProject.title, {exact: true})).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    expect(projectWrites).toBe(0);
  } finally {release();}
});

test('RESEARCH-OWNER-03 conflict reload preserves a note draft and retry retains latest tasks and evidence', async ({page}) => {
  type EvidenceProject = MockProject & {metadata: MockProject['metadata'] & {evidence: ProjectEvidence[]}};
  const original: EvidenceProject = {id: 'conflict-project', title: 'Research conflict project', kind: 'paper', status: 'active', metadata: {notes: 'Saved original note', tasks: [{id: 'old-task', text: 'Original task', done: false}], evidence: []}, created_at: stamp, updated_at: stamp};
  const entry: ProjectEvidence = {id: 'latest-evidence', paperId: 'cloud-b', paragraphId: 'b-stable', paperTitle: 'Cloud source B', fileName: 'cloud-b.pdf', page: 4, section: 'Methods', quote: 'A source added from another window.', comment: 'Latest source comment.', createdAt: 3};
  const latest: EvidenceProject = {...original, updated_at: '2026-10-21T00:01:00.000Z', metadata: {notes: 'Remote saved note', tasks: [{id: 'latest-task', text: 'Task from another window', done: true}], evidence: [entry]}};
  const state = await installApiMocks(page, {signedIn: true, projects: [original]});
  const sent: Array<EvidenceProject & {expectedUpdatedAt: string; expectedOwnerId: string}> = [];
  await page.route('**/api/projects**', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const body = route.request().postDataJSON() as typeof sent[number];
    sent.push(body);
    expect(new URL(route.request().url()).searchParams.get('id')).toBe(original.id);
    expect(body.expectedOwnerId).toBe(state.userId);
    if (sent.length === 1) {
      state.projects = [latest];
      return route.fulfill({status: 409, contentType: 'application/json', body: JSON.stringify({error: '项目已更新，请重试。'})});
    }
    expect(body.expectedUpdatedAt).toBe(latest.updated_at);
    state.projects = [{...body, updated_at: '2026-10-21T00:02:00.000Z'}];
    return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({project: state.projects[0]})});
  });
  await page.goto('/projects');
  await expect(page.getByRole('heading', {name: original.title, exact: true})).toBeVisible();
  const notes = page.getByLabel('项目笔记', {exact: true});
  await notes.fill('My unsaved note must survive conflict.');
  await page.getByRole('button', {name: '保存笔记', exact: true}).click();
  await expect(page.locator('.project-message[role="alert"]')).toContainText('项目已更新');
  await expect(page.locator('.project-tasks')).toContainText('Task from another window');
  await expect(page.locator('.project-evidence')).toContainText(entry.quote);
  await expect(notes).toHaveValue('My unsaved note must survive conflict.');
  await page.getByRole('button', {name: '保存笔记', exact: true}).click();
  await expect(page.getByText('项目笔记已保存。', {exact: true})).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[0].expectedUpdatedAt).toBe(original.updated_at);
  expect(sent[1].metadata.notes).toBe('My unsaved note must survive conflict.');
  expect(sent[1].metadata.tasks).toEqual(latest.metadata.tasks);
  expect(sent[1].metadata.evidence).toEqual([entry]);
});
