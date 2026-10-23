import {expect, test} from '@playwright/test';
import {installApiMocks, type MockProject} from './helpers';
import type {PaperRecord} from '../../app/papers/paper-types';

const stamp = '2026-10-23T00:00:00.000Z';
const project = (id: string, title = id): MockProject => ({id, title, kind: 'paper', status: 'active', metadata: {notes: `Saved ${id}`, tasks: []}, created_at: stamp, updated_at: stamp});
const paper = (id: string): PaperRecord => ({id, title: `Source ${id}`, fileName: `${id}.pdf`, addedAt: 1, updatedAt: 2, activeParagraph: 1,
  paragraphs: Array.from({length: 3}, (_, i) => ({id: `${id}-paragraph-${i}`, page: i + 1, section: 'Methods', original: `Source ${id} paragraph ${i + 1}. ${'Evidence is specific to this source. '.repeat(15)}`, translation: '', note: `Note ${id}-${i}`, read: false, bookmarked: false}))});

test('RESUME-01 project drafts survive client navigation, reload, and account switching', async ({page}) => {
  const record = project('shared-id', 'Account A project');
  const state = await installApiMocks(page, {signedIn: true, projects: [record]});
  await page.goto('/projects');
  const notes = page.getByLabel('项目笔记', {exact: true});
  await notes.fill('A local draft with its final character。');
  await expect(page.getByRole('status').filter({hasText: '草稿已保存在本机'})).toBeVisible();
  await page.getByRole('link', {name: '设置与隐私', exact: true}).click();
  await expect(page.getByRole('heading', {name: '设置', exact: true})).toBeVisible();
  await page.getByRole('link', {name: '项目空间', exact: true}).click();
  await expect(notes).toHaveValue('A local draft with its final character。');
  await page.reload();
  await expect(notes).toHaveValue('A local draft with its final character。');
  state.userId = 'account-b';
  state.projects = [project('shared-id', 'Account B project')];
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(page.getByRole('heading', {name: 'Account B project', exact: true})).toBeVisible();
  await expect(notes).toHaveValue('Saved shared-id');
  state.userId = 'user-e2e'; state.projects = [record];
  await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(notes).toHaveValue('A local draft with its final character。');
  expect(state.requests.filter(request => request === 'PATCH /api/projects')).toHaveLength(0);
  await page.screenshot({path: 'outputs/batch-a-2026-10-23/project-local-draft.png', fullPage: true});
});

test('RESUME-02 failed cloud saves retain drafts and unavailable local storage warns before reload', async ({page}) => {
  const record = project('failed-save');
  await installApiMocks(page, {signedIn: true, projects: [record]});
  await page.route('**/api/projects?**', route => route.request().method() === 'PATCH'
    ? route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: '模拟保存失败'})}) : route.fallback());
  await page.goto('/projects');
  const notes = page.getByLabel('项目笔记', {exact: true});
  await notes.fill('Durable even when the cloud save fails');
  await page.getByRole('button', {name: '保存笔记', exact: true}).click();
  await expect(page.locator('.project-message[role=alert]')).toContainText('模拟保存失败');
  await page.reload();
  await expect(notes).toHaveValue('Durable even when the cloud save fails');
  await page.evaluate(() => {
    const native = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('acaora:project-note-draft:')) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return native.call(this, key, value);
    };
  });
  await notes.fill('The latest input survives a client-side navigation');
  await expect(page.getByText('草稿暂未写入本机，请勿刷新或关闭页面', {exact: true})).toBeVisible();
  await page.getByRole('link', {name: '设置与隐私', exact: true}).click();
  await expect(page.getByRole('heading', {name: '设置', exact: true})).toBeVisible();
  await page.getByRole('link', {name: '项目空间', exact: true}).click();
  await expect(notes).toHaveValue('The latest input survives a client-side navigation');
  const warning = page.waitForEvent('dialog');
  // Chromium can leave the navigation promise pending after cancelling its
  // beforeunload dialog. Bound that cancelled navigation, not the assertion.
  const reload = page.reload({timeout: 2000}).catch(() => undefined);
  const dialog = await warning;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss(); await reload;
  await expect(notes).toHaveValue('The latest input survives a client-side navigation');
  // Allow fixture teardown without accepting a loss of real user work.
  page.on('dialog', dialog => dialog.accept());
});

test('RESUME-03 a late save rebases newer input without clearing it, including reverting to the old saved text', async ({page}) => {
  const record = project('late-save');
  const state = await installApiMocks(page, {signedIn: true, projects: [record]});
  let release!: () => void;
  const held = new Promise<void>(resolve => {release = resolve;});
  let started!: () => void;
  const waiting = new Promise<void>(resolve => {started = resolve;});
  await page.route('**/api/projects?**', async route => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    const body = route.request().postDataJSON() as MockProject;
    started(); await held;
    state.projects = [{...body, updated_at: '2026-10-23T00:01:00.000Z'}];
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({project: state.projects[0]})});
  });
  await page.goto('/projects');
  const notes = page.getByLabel('项目笔记', {exact: true});
  await notes.fill('The submitted text');
  await page.getByRole('button', {name: '保存笔记', exact: true}).click();
  await waiting;
  await notes.fill(record.metadata.notes!);
  release();
  await expect(page.getByText('项目笔记已保存。', {exact: true})).toBeVisible();
  await expect(notes).toHaveValue(record.metadata.notes!);
  await expect(page.getByRole('button', {name: '保存笔记', exact: true})).toBeEnabled();
  await page.reload();
  await expect(notes).toHaveValue(record.metadata.notes!);
  await expect(page.getByRole('button', {name: '恢复草稿继续编辑', exact: true})).toHaveCount(0);
});

test('RESUME-04 a restored draft requires an explicit choice when the account version changed', async ({page}) => {
  const record = project('remote-conflict');
  const state = await installApiMocks(page, {signedIn: true, projects: [record]});
  await page.goto('/projects');
  const notes = page.getByLabel('项目笔记', {exact: true});
  await notes.fill('My retained local draft');
  state.projects = [{...record, updated_at: '2026-10-23T00:02:00.000Z', metadata: {...record.metadata, notes: 'New account version'}}];
  await page.reload();
  await expect(notes).toHaveValue('My retained local draft');
  await expect(notes).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', {name: '保存笔记', exact: true})).toBeDisabled();
  await page.getByText('比较草稿与已保存笔记', {exact: true}).click();
  await expect(page.getByText('New account version', {exact: true})).toBeVisible();
  await page.screenshot({path: 'outputs/batch-a-2026-10-23/project-conflict.png', fullPage: true});
  await page.setViewportSize({width: 375, height: 812});
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({path: 'outputs/batch-a-2026-10-23/project-conflict-mobile.png', fullPage: true});
  await page.getByRole('button', {name: '使用已保存笔记', exact: true}).click();
  await expect(notes).toHaveValue('New account version');
  await expect(notes).toBeFocused();
  await page.reload();
  await expect(notes).toHaveValue('New account version');
  expect(state.requests.filter(request => request === 'PATCH /api/projects')).toHaveLength(0);
});

test('RESUME-05 recent entries open exact projects and papers, including refresh and back navigation', async ({page}) => {
  await page.setViewportSize({width: 1440, height: 900});
  await page.addInitScript(() => localStorage.setItem('acaora:paper-panels', JSON.stringify({library: false, notes: true})));
  const first = paper('paper-a'), second = paper('paper-b');
  await installApiMocks(page, {signedIn: true, projects: [project('project-a'), project('project-b')], cloudPapers: [first, second]});
  await page.goto('/dashboard');
  const recent = page.getByRole('region', {name: '最近更新', exact: true});
  await expect(recent.getByRole('link')).toHaveCount(4);
  await recent.getByRole('link', {name: /project-b/}).click();
  await expect(page).toHaveURL(/project=project-b/);
  await expect(page.getByRole('heading', {name: 'project-b', exact: true})).toBeVisible();
  await page.getByRole('group', {name: '项目列表', exact: true}).getByRole('button', {name: /project-a/}).click();
  await expect(page).toHaveURL(/project=project-a/);
  await page.goBack();
  await expect(page.getByRole('heading', {name: 'project-b', exact: true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'project-b', exact: true})).toBeVisible();
  await page.getByRole('link', {name: '总览', exact: true}).click();
  await recent.getByRole('link', {name: /Source paper-b/}).click();
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(second.title);
  await expect(page.getByLabel('段落笔记', {exact: true})).toHaveValue('Note paper-b-1');
  await page.reload();
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(second.title);
  await page.goto(`/papers?view=reader&paper=${first.id}&paragraph=${first.paragraphs[2].id}`);
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(first.title);
  await expect(page.getByLabel('段落笔记', {exact: true})).toHaveValue('Note paper-a-2');
  await page.goBack();
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveValue(second.title);
});

test('RESUME-06 invalid or inaccessible targets never fall back to another record', async ({page}) => {
  const record = paper('visible-paper');
  const state = await installApiMocks(page, {signedIn: true, projects: [project('visible-project')], cloudPapers: [record]});
  await page.goto('/projects?project=unavailable-project');
  await expect(page.getByRole('heading', {name: '无法打开指定项目', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'visible-project', exact: true})).toHaveCount(0);
  await page.getByRole('button', {name: '返回项目列表', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'visible-project', exact: true})).toBeVisible();
  state.userId = 'another-owner'; state.projects = [];
  await page.goto('/projects?project=visible-project');
  await expect(page.getByRole('heading', {name: '无法打开指定项目', exact: true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/papers?view=reader&paper=unavailable-paper');
  await expect(page.getByText(/当前账户未找到原论文/)).toBeVisible();
  await expect(page.getByRole('region', {name: '论文列表', exact: true})).toBeVisible();
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveCount(0);
  await page.goto('/papers?view=reader&paper=visible-paper&paragraph=unavailable-paragraph');
  await expect(page.getByText(/原段落已不存在/)).toBeVisible();
  await expect(page.getByRole('region', {name: '论文列表', exact: true})).toBeVisible();
  await expect(page.getByLabel('论文标题', {exact: true})).toHaveCount(0);
});
