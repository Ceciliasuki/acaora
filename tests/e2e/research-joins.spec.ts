import {expect, test, type Page, type Route} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {installApiMocks, type MockProject} from './helpers';
import type {LedgerEvent} from '../../app/lib/research-ledger';
import type {JoinReceipt} from '../../app/data/research-joins';

test.setTimeout(90000);
const owner = '91000000-0000-4000-8000-000000000001', projectId = '92000000-0000-4000-8000-000000000001', otherOwner = '93000000-0000-4000-8000-000000000001', now = '2026-10-25T05:00:00.000Z';
const left = 'id,year,y\nA,2023,10\nA,2024,11\nB,2024,12\nC,2024,13';
const right = 'code,sector\nB,BetaCompany\nA,AlphaCompany\nD,DeltaCompany';
const project: MockProject = {id: projectId, title: '多表合并真实流程验证', kind: 'data', status: 'active', metadata: {}, created_at: now, updated_at: now};
type Write = {kind: string; entityId: string; expectedOwnerId: string; payload: JoinReceipt};
const csv = (name: string, content: string) => ({name, mimeType: 'text/csv', buffer: Buffer.from(content)});
async function setup(page: Page, reply?: (route: Route, event: LedgerEvent, attempt: number) => Promise<void>) {
  const state = await installApiMocks(page, {signedIn: true, userId: owner, projects: [project]}), events: LedgerEvent[] = [], writes: Write[] = [];
  await page.route('**/api/projects/workbench**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({json: {project, events}});
    const body = route.request().postDataJSON() as Write; writes.push(body);
    const event: LedgerEvent = events.find(item => item.entity_id === body.entityId) ?? {id: crypto.randomUUID(), sequence: events.length + 1, project_id: projectId, user_id: owner, entity_id: body.entityId, collection: 'join', revision: 1, archived: false, payload: body.payload as unknown as Record<string, unknown>, created_at: now, origin: null};
    if (!events.some(item => item.id === event.id)) events.push(event);
    return reply ? reply(route, event, writes.length) : route.fulfill({json: {event}});
  });
  await page.goto(`/data?project=${projectId}`);
  await page.getByLabel('选择数据文件', {exact: true}).setInputFiles(csv('left.csv', left));
  await expect(page.getByText(/已读取 left.csv/)).toBeVisible();
  const tools = page.locator('[data-research-join-tools]'); await tools.locator(':scope > summary').click();
  await expect(tools.getByLabel('选择右表文件', {exact: true})).toBeEnabled();
  return {state, events, writes, tools};
}
async function loadRight(tools: ReturnType<Page['locator']>, content = right, name = 'right.csv') {
  await tools.getByLabel('选择右表文件', {exact: true}).setInputFiles(csv(name, content));
  await expect(tools.getByRole('status').filter({hasText: '右表已读取'})).toBeVisible();
}
async function preview(tools: ReturnType<Page['locator']>) {
  await tools.getByRole('button', {name: '预览合并与样本审计', exact: true}).click();
  const region = tools.getByRole('region', {name: '合并预览与样本审计', exact: true}); await expect(region).toBeVisible(); return region;
}
async function apply(tools: ReturnType<Page['locator']>) {
  await tools.getByRole('checkbox', {name: '我已核对样本流转，确认将合并表作为新的分析原表，清空当前处理步骤与旧分析显示', exact: true}).check();
  await tools.getByRole('button', {name: '确认应用合并结果', exact: true}).click();
}

test('CSV join audit, invalidated preview and explicit apply update the actual parent data without uploading rows', async ({page}) => {
  const {tools, events, writes} = await setup(page); await loadRight(tools);
  const audit = await preview(tools);
  await expect(audit.getByText('匹配的左表行', {exact: true}).locator('..')).toContainText('3');
  await expect(audit.getByText('未匹配左表行', {exact: true}).locator('..')).toContainText('1');
  await expect(audit.getByText('未匹配右表行', {exact: true}).locator('..')).toContainText('1');
  await expect(audit.getByText('输出行', {exact: true}).locator('..')).toContainText('4');
  await expect(tools.getByRole('button', {name: '确认应用合并结果', exact: true})).toBeDisabled(); expect(writes).toHaveLength(0);
  await tools.getByRole('textbox', {name: '右表列名前缀', exact: true}).fill('firm_'); await expect(audit).toHaveCount(0);
  const updated = await preview(tools), pendingDownload = page.waitForEvent('download'); await updated.getByRole('button', {name: '下载此合并凭证 JSON', exact: true}).click();
  const download = await pendingDownload, receipt = JSON.parse(await readFile((await download.path())!, 'utf8')) as JoinReceipt;
  expect(receipt.audit.outputRows).toBe(4); expect(receipt.plan.rightPrefix).toBe('firm_'); expect(receipt.left.fingerprint).toMatch(/^[a-f0-9]{64}$/); expect(JSON.stringify(receipt)).not.toContain('AlphaCompany');
  await apply(tools);
  await expect(page.locator('#preview').getByRole('columnheader', {name: 'firm_sector', exact: true})).toBeVisible();
  await expect(page.locator('#preview').getByRole('cell', {name: 'AlphaCompany', exact: true})).toHaveCount(2);
  await expect.poll(() => events.filter(event => event.collection === 'join').length).toBe(1);
  expect(writes[0].payload.audit.matchedLeft).toBe(3); expect(writes[0].payload.output.rows).toBe(4); expect(writes[0].expectedOwnerId).toBe(owner); expect(JSON.stringify(writes)).not.toContain('AlphaCompany'); expect(JSON.stringify(writes)).not.toContain('"rows":[');
});

test('duplicate right keys are refused; selecting a different explicit relation never permits many-to-many', async ({page}) => {
  const {tools, writes} = await setup(page); await loadRight(tools, 'code,sector\nA,One\nA,Two\nB,Three');
  await tools.getByRole('button', {name: '预览合并与样本审计', exact: true}).click();
  await expect(tools.getByRole('alert')).toContainText('右表 1 个重复键组'); await expect(tools.getByRole('region', {name: '合并预览与样本审计', exact: true})).toHaveCount(0); expect(writes).toHaveLength(0);
  await tools.getByRole('combobox', {name: '预期基数关系', exact: true}).selectOption('one-to-many');
  await tools.getByRole('button', {name: '预览合并与样本审计', exact: true}).click(); await expect(tools.getByRole('alert')).toContainText('左表键唯一');
  await expect(page.locator('#preview').getByRole('columnheader', {name: 'right_sector', exact: true})).toHaveCount(0);
});

test('lost cloud response retries the same receipt ID without applying the merge twice', async ({page}) => {
  const {tools, events, writes} = await setup(page, async (route, event, attempt) => route.fulfill({status: attempt === 1 ? 503 : 200, json: attempt === 1 ? {error: '模拟登记响应丢失'} : {event}}));
  await loadRight(tools); await preview(tools); await apply(tools);
  const retry = tools.getByRole('button', {name: '重试登记合并凭证', exact: true}); await expect(retry).toBeEnabled();
  await expect(page.locator('#preview').getByRole('columnheader', {name: 'right_sector', exact: true})).toBeVisible();
  await retry.click(); await expect(tools.getByRole('region', {name: '待登记的合并凭证', exact: true})).toHaveCount(0);
  expect(writes).toHaveLength(2); expect(writes[0].entityId).toBe(writes[1].entityId); expect(events.filter(event => event.collection === 'join')).toHaveLength(1);
  await expect(page.locator('#preview').getByRole('columnheader', {name: 'right_right_sector', exact: true})).toHaveCount(0);
});

test('an account switch discards a late right-file read before exposing or applying its data', async ({page}) => {
  const {tools, state, writes} = await setup(page);
  await page.evaluate(() => {
    const original = File.prototype.text; type WindowWithRead = Window & {__joinReadStarted?: boolean; __releaseJoinRead?: () => void};
    File.prototype.text = function() {if (this.name !== 'right-late.csv') return original.call(this); (window as WindowWithRead).__joinReadStarted = true; return new Promise<string>(resolve => {(window as WindowWithRead).__releaseJoinRead = () => {void original.call(this).then(resolve);};});};
  });
  await tools.getByLabel('选择右表文件', {exact: true}).setInputFiles(csv('right-late.csv', 'code,private\nA,DoNotExposeLateRight'));
  await expect.poll(() => page.evaluate(() => Boolean((window as Window & {__joinReadStarted?: boolean}).__joinReadStarted))).toBe(true);
  state.userId = otherOwner; await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(tools.getByText('账户已变化，已清除右表与预览，请重新导入。', {exact:true})).toBeVisible();
  await page.evaluate(() => (window as Window & {__releaseJoinRead?: () => void}).__releaseJoinRead?.());
  await expect(tools.getByText(/右表已读取/)).toHaveCount(0); await expect(tools.getByText('DoNotExposeLateRight', {exact: true})).toHaveCount(0); await expect(tools.getByRole('region', {name: '合并预览与样本审计', exact: true})).toHaveCount(0); expect(writes).toHaveLength(0);
});

test('an account switch during fingerprinting discards a late preview and prevents apply', async ({page}) => {
  const {tools, state, writes} = await setup(page); await loadRight(tools, 'code,private\nA,OnlyDelayedRightValue\nB,Second');
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle); let hold = true; type WindowWithDigest = Window & {__joinDigestStarted?: boolean; __releaseJoinDigest?: () => void};
    crypto.subtle.digest = function(algorithm: AlgorithmIdentifier, bytes: BufferSource) {
      if (!hold || !new TextDecoder().decode(bytes).includes('OnlyDelayedRightValue')) return original(algorithm, bytes);
      hold = false; (window as WindowWithDigest).__joinDigestStarted = true;
      return new Promise<ArrayBuffer>((resolve, reject) => {(window as WindowWithDigest).__releaseJoinDigest = () => {void original(algorithm, bytes).then(resolve, reject);};});
    };
  });
  await tools.getByRole('button', {name: '预览合并与样本审计', exact: true}).click();
  await expect.poll(() => page.evaluate(() => Boolean((window as Window & {__joinDigestStarted?: boolean}).__joinDigestStarted))).toBe(true);
  state.userId = otherOwner; await page.evaluate(() => window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(tools.getByText('账户已变化，已清除右表与预览，请重新导入。', {exact:true})).toBeVisible();
  await page.evaluate(() => (window as Window & {__releaseJoinDigest?: () => void}).__releaseJoinDigest?.());
  await expect(tools.getByRole('region', {name: '合并预览与样本审计', exact: true})).toHaveCount(0); await expect(tools.getByRole('button', {name: '确认应用合并结果', exact: true})).toHaveCount(0); expect(writes).toHaveLength(0);
});
