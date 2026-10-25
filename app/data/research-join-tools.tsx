'use client';
import {Suspense, useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import {Button} from '../components/ui';
import {authChangeEvent, getCurrentUser} from '../lib/auth-client';
import {uuid, validateLedgerPayload} from '../lib/research-ledger';
import {useResearchLedger} from '../projects/use-research-ledger';
import type {DataSet} from '../stats';
import {acceptedDataFormats, readDataFile} from './file-readers';
import {createJoinReceipt, previewResearchJoin, type JoinPlan, type JoinPreview, type JoinReceipt} from './research-joins';
import styles from './multiple-regression.module.css';

type Props = {data: DataSet; onApply: (data: DataSet, receipt: JoinReceipt) => void | Promise<void>};
type Stage = {id: string; scope: string; left: DataSet; right: DataSet; planKey: string; preview: JoinPreview; receipt: JoinReceipt};
type PendingReceipt = {id: string; ownerId: string; projectId: string; receipt: JoinReceipt};
type PendingView = {scope: string; items: PendingReceipt[]; error: string};
const pendingPrefix = (ownerId: string, projectId: string) => `acaora.join-receipts.v1:${ownerId}:${projectId}:`;
const failure = (cause: unknown) => cause instanceof Error ? cause.message : '操作未完成，输入仍保留，请重试。';
function downloadReceipt(receipt: JoinReceipt) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], {type: 'application/json'})), link = document.createElement('a');
  link.href = url; link.download = 'acaora-join-receipt.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ResearchJoinTools(props: Props) {
  return <Suspense fallback={<p role="status">正在读取合并上下文…</p>}><JoinTools {...props}/></Suspense>;
}

function JoinTools({data, onApply}: Props) {
  const query = useSearchParams(), projectId = query.get('project') ?? '', baseId = useId();
  const [ownerId, setOwnerId] = useState<string | null>(null), [authReady, setAuthReady] = useState(false);
  const [right, setRight] = useState<DataSet | null>(null), [reading, setReading] = useState(false), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<JoinPlan>(() => ({leftKeys: [data.headers[0] ?? ''], rightKeys: [''], how: 'left', relationship: 'many-to-one', rightPrefix: 'right_', missingKeys: 'reject'}));
  const [stage, setStage] = useState<Stage | null>(null), [ackId, setAckId] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [pendingView, setPendingView] = useState<PendingView>({scope: '', items: [], error: ''});
  const [lastApplied, setLastApplied] = useState<{scope: string; receipt: JoinReceipt} | null>(null);
  const scope = `${ownerId ?? 'guest'}:${projectId}`, planKey = JSON.stringify(plan);
  const ledger = useResearchLedger(ownerId && uuid(projectId) ? ownerId : null, uuid(projectId) ? projectId : '');
  const alive = useRef(false), workEpoch = useRef(0), authEpoch = useRef(0), readSequence = useRef(0), saveLock = useRef(false), memory = useRef(new Map<string, PendingReceipt>());
  const latest = useRef({data, right, planKey, scope, ownerId});
  useLayoutEffect(() => {latest.current = {data, right, planKey, scope, ownerId};}, [data, right, planKey, scope, ownerId]);
  useEffect(() => {
    alive.current = true; let generation = 0;
    const readOwner = async () => {const token = ++generation; try {const user = await getCurrentUser(); if (alive.current && token === generation) {setOwnerId(user?.id ?? null); setAuthReady(true);}} catch (cause) {if (alive.current && token === generation) {setError(`账户暂时无法确认，请刷新本页后重试。${failure(cause)}`); setAuthReady(false);}}};
    const changed = () => {
      authEpoch.current++; workEpoch.current++; readSequence.current++; setAuthReady(false); setOwnerId(null); setRight(null); setStage(null); setAckId(''); setLastApplied(null); setReading(false); setBusy(false); setNotice(''); setError('账户已变化，已清除右表与预览，请重新导入。');
      void readOwner();
    };
    void readOwner(); window.addEventListener(authChangeEvent, changed);
    // These refs are generation tokens; cleanup must invalidate their latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {alive.current = false; generation++; authEpoch.current++; workEpoch.current++; readSequence.current++; window.removeEventListener(authChangeEvent, changed);};
  }, []);
  useLayoutEffect(() => {
    workEpoch.current++; readSequence.current++;
    let active = true;
    queueMicrotask(() => {if (active) {setStage(null); setAckId(''); setBusy(false); setReading(false);}});
    return () => {active = false;};
  }, [data, scope]);
  useEffect(() => {
    authEpoch.current++; let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const loaded = pendingFor(ownerId, projectId); setPendingView({scope, ...loaded});
    });
    return () => {active = false;};
    // pendingFor reads external storage using the explicit identity arguments.
  }, [ownerId, projectId, scope]);

  function pendingFor(owner: string | null, project: string) {
    if (!owner || !uuid(project)) return {items: [] as PendingReceipt[], error: ''};
    const prefix = pendingPrefix(owner, project), items = new Map<string, PendingReceipt>(); let storageError = '';
    for (const item of memory.current.values()) if (item.ownerId === owner && item.projectId === project) items.set(item.id, item);
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index); if (!key?.startsWith(prefix)) continue;
        const raw = localStorage.getItem(key); if (!raw || raw.length > 100000) {storageError = '部分本机合并凭证格式异常，未删除原件。'; continue;}
        let item: PendingReceipt;
        try {item = JSON.parse(raw) as PendingReceipt;} catch {storageError = '部分本机合并凭证格式异常，未删除原件。'; continue;}
        if (!item || !uuid(item.id) || key !== prefix + item.id || item.ownerId !== owner || item.projectId !== project || !validateLedgerPayload('join', item.receipt)) {storageError = '部分本机合并凭证格式异常，未删除原件。'; continue;}
        if (!items.has(item.id)) items.set(item.id, item);
      }
    } catch {storageError = '本机凭证存储不可用；当前页中的凭证仍保留，请下载后再离开。';}
    return {items: [...items.values()].sort((a, b) => a.receipt.createdAt.localeCompare(b.receipt.createdAt) || a.id.localeCompare(b.id)), error: storageError};
  }
  function updatePlan(next: JoinPlan) {workEpoch.current++; setPlan(next); setStage(null); setAckId(''); setError(''); setNotice('设置已变化，请重新预览合并。');}
  const currentStage = stage?.left === data && stage.right === right && stage.planKey === planKey && stage.scope === scope ? stage : null;
  const pending = pendingView.scope === scope ? pendingView.items : [];
  const applied = lastApplied?.scope === scope ? lastApplied.receipt : null;
  const disabled = reading || busy;
  const cloudReady = Boolean(ownerId && uuid(projectId));
  function liveWork(token: number, left: DataSet, expectedRight?: DataSet | null, settings?: string) {
    const current = latest.current;
    return alive.current && token === workEpoch.current && current.data === left && current.scope === scope && (expectedRight === undefined || current.right === expectedRight) && (settings === undefined || current.planKey === settings);
  }
  async function sameAccount(token: number, expectedOwner: string | null) {
    const user = await getCurrentUser();
    if (!alive.current || token !== authEpoch.current || latest.current.scope !== scope) return false;
    if ((user?.id ?? null) !== expectedOwner) {window.dispatchEvent(new Event(authChangeEvent)); return false;}
    return true;
  }
  async function readRight(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || !authReady) return;
    const sequence = ++readSequence.current, token = ++workEpoch.current, left = data, account = authEpoch.current;
    setReading(true); setStage(null); setAckId(''); setError(''); setNotice(`正在本机读取 ${file.name}…`);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('右表文件超过 25 MiB，请先缩小数据。');
      const parsed = await readDataFile(file);
      if (sequence !== readSequence.current || !liveWork(token, left) || !await sameAccount(account, ownerId) || sequence !== readSequence.current || !liveWork(token, left)) return;
      if (!parsed.headers.length || !parsed.rows.length) throw new Error('右表没有可合并的数据行。');
      setRight(parsed); setPlan(current => ({...current, leftKeys: current.leftKeys.map((key, index) => data.headers.includes(key) ? key : data.headers[index] ?? ''), rightKeys: current.leftKeys.map((_, index) => parsed.headers[index] ?? '')}));
      setNotice(`右表已读取：${parsed.name}，${parsed.rows.length} 行、${parsed.headers.length} 列。请核对合并键与基数关系。`);
    } catch (cause) {if (sequence === readSequence.current && liveWork(token, left)) {setError(failure(cause)); setNotice('');}}
    finally {if (alive.current && sequence === readSequence.current) setReading(false);}
  }
  async function preview() {
    if (!right || !authReady || disabled) return;
    const token = ++workEpoch.current, left = data, sourceRight = right, settings = planKey, account = authEpoch.current, frozenPlan = structuredClone(plan);
    setBusy(true); setStage(null); setAckId(''); setError(''); setNotice('正在本机检查合并关系并生成指纹…');
    try {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (!liveWork(token, left, sourceRight, settings)) return;
      const result = previewResearchJoin(left, sourceRight, frozenPlan), receipt = await createJoinReceipt(left, sourceRight, frozenPlan, result);
      if (!liveWork(token, left, sourceRight, settings) || !await sameAccount(account, ownerId) || !liveWork(token, left, sourceRight, settings)) return;
      setStage({id: crypto.randomUUID(), scope, left, right: sourceRight, planKey: settings, preview: result, receipt}); setNotice('合并预览已完成。请核对匹配、排除和样本扩张情况，再确认应用。');
    } catch (cause) {if (liveWork(token, left, sourceRight, settings)) {setError(failure(cause)); setNotice('');}}
    finally {if (alive.current && token === workEpoch.current) setBusy(false);}
  }
  async function saveReceipts(items: PendingReceipt[]) {
    if (!ownerId || !uuid(projectId) || saveLock.current) return;
    const account = authEpoch.current; saveLock.current = true; setSaving(true);
    try {
      for (const item of items) {
        if (!await sameAccount(account, ownerId)) return;
        const saved = await ledger.save('join', item.receipt as unknown as Record<string, unknown>, undefined, false, undefined, item.id);
        if (!await sameAccount(account, ownerId)) return;
        if (!saved) {setError('合并数据已在本机应用，但凭证登记尚未确认。可重试登记；不会重新计算或再次应用数据。'); return;}
        const key = pendingPrefix(ownerId, projectId) + item.id;
        try {
          const stored = localStorage.getItem(key);
          if (stored !== null && stored !== JSON.stringify(item)) throw new Error('本机凭证已有其他修改，未删除原件。');
          localStorage.removeItem(key); memory.current.delete(item.id);
        } catch {setError('凭证已登记，但本机待保存副本无法清除。重试会使用同一标识，不会重复登记。'); return;}
        setPendingView({scope, ...pendingFor(ownerId, projectId)});
      }
      setError(''); setNotice('合并凭证已登记到项目；云端不包含两表的数据行。');
    } catch (cause) {if (alive.current && account === authEpoch.current && latest.current.scope === scope) setError(failure(cause));}
    finally {saveLock.current = false; if (alive.current && account === authEpoch.current) setSaving(false);}
  }
  async function apply() {
    if (!currentStage || ackId !== currentStage.id || disabled) return;
    const ready = currentStage, token = workEpoch.current, account = authEpoch.current;
    setBusy(true); setError(''); let item: PendingReceipt | null = null, appliedSuccessfully = false;
    try {
      if (!await sameAccount(account, ownerId) || !liveWork(token, ready.left, ready.right, ready.planKey)) return;
      if (ownerId && uuid(projectId)) {
        item = {id: crypto.randomUUID(), ownerId, projectId, receipt: structuredClone(ready.receipt)}; memory.current.set(item.id, item);
        try {localStorage.setItem(pendingPrefix(ownerId, projectId) + item.id, JSON.stringify(item));}
        catch {setError('合并凭证只能保留在本页。应用后请下载凭证，离开前完成登记。');}
        setPendingView({scope, ...pendingFor(ownerId, projectId)});
      }
      await onApply(ready.preview.data, structuredClone(ready.receipt));
      appliedSuccessfully = true;
      setLastApplied({scope, receipt: ready.receipt}); setStage(null); setAckId(''); setRight(null);
      setNotice(`已应用合并结果：${ready.receipt.output.rows} 行、${ready.receipt.output.columns} 列。两份原始文件继续由你保留。`);
      if (item) void saveReceipts([item]);
    } catch (cause) {
      if (item && !appliedSuccessfully) {
        memory.current.delete(item.id);
        try {const key = pendingPrefix(item.ownerId, item.projectId) + item.id; if (localStorage.getItem(key) === JSON.stringify(item)) localStorage.removeItem(key);} catch {/* The preview receipt remains valid; data was not silently reapplied. */}
        if (alive.current && account === authEpoch.current) setPendingView({scope, ...pendingFor(ownerId, projectId)});
      }
      if (alive.current && account === authEpoch.current) setError(failure(cause));
    }
    finally {if (alive.current && account === authEpoch.current) setBusy(false);}
  }
  const pairs = plan.leftKeys.map((_, index) => index);
  return <details className={styles.recipe} data-research-join-tools>
    <summary>多表合并与样本流转</summary>
    <section aria-labelledby={`${baseId}-title`} className={styles.workbench}>
      <h3 id={`${baseId}-title`}>合并当前处理表与另一份本机数据</h3>
      <p className={`${styles.help} ${styles.control}`}>左表为当前处理表：{data.name}（{data.rows.length} 行、{data.headers.length} 列）。合并按原始字符串精确匹配，不自动去空格、转换数值或统一日期。先核对统计单位、期间和计量单位。缺失键从不互相匹配。</p>
      <label className={styles.control}>选择右表文件<input type="file" accept={acceptedDataFormats} disabled={disabled || !authReady} onChange={event => void readRight(event)}/></label>
      {!authReady && <p role="status">正在确认账户，尚未读取右表。</p>}
      {right && <p className={styles.control}>右表：{right.name}（{right.rows.length} 行、{right.headers.length} 列）。</p>}
      <fieldset className={styles.settings} disabled={disabled || !right || !authReady}><legend>合并键与关系</legend>
        {pairs.map(index => <div className={styles.controls} key={index}>
          <label className={styles.control}>左表合并键 {index + 1}<select aria-label={`左表合并键 ${index + 1}`} value={data.headers.includes(plan.leftKeys[index]) ? plan.leftKeys[index] : ''} onChange={event => updatePlan({...plan, leftKeys: plan.leftKeys.map((key, i) => i === index ? event.target.value : key)})}><option value="">请选择左表字段</option>{data.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
          <label className={styles.control}>右表合并键 {index + 1}<select aria-label={`右表合并键 ${index + 1}`} value={right?.headers.includes(plan.rightKeys[index]) ? plan.rightKeys[index] : ''} onChange={event => updatePlan({...plan, rightKeys: plan.rightKeys.map((key, i) => i === index ? event.target.value : key)})}><option value="">请选择右表字段</option>{right?.headers.map(header => <option key={header} value={header}>{header}</option>)}</select></label>
          {pairs.length > 1 && <Button variant="ghost" size="sm" aria-label={`移除第 ${index + 1} 组合并键`} onClick={() => updatePlan({...plan, leftKeys: plan.leftKeys.filter((_, i) => i !== index), rightKeys: plan.rightKeys.filter((_, i) => i !== index)})}>移除此组键</Button>}
        </div>)}
        <Button variant="secondary" size="sm" disabled={pairs.length >= 5} onClick={() => updatePlan({...plan, leftKeys: [...plan.leftKeys, ''], rightKeys: [...plan.rightKeys, '']})}>增加一组键</Button>
        <div className={styles.controls}>
          <label className={styles.control}>合并方式<select aria-label="合并方式" value={plan.how} onChange={event => updatePlan({...plan, how: event.target.value as JoinPlan['how']})}><option value="left">左连接：保留全部左表行</option><option value="inner">内连接：只保留匹配行</option><option value="full">全连接：保留两表全部行</option></select></label>
          <label className={styles.control}>预期基数关系<select aria-label="预期基数关系" value={plan.relationship} onChange={event => updatePlan({...plan, relationship: event.target.value as JoinPlan['relationship']})}><option value="many-to-one">多对一：右表键必须唯一</option><option value="one-to-one">一对一：两表键都必须唯一</option><option value="one-to-many">一对多：左表键必须唯一</option></select></label>
          <label className={styles.control}>右表列名前缀<input maxLength={100} value={plan.rightPrefix} onChange={event => updatePlan({...plan, rightPrefix: event.target.value})}/></label>
          <label className={styles.control}>缺失键处理<select aria-label="缺失键处理" value={plan.missingKeys} onChange={event => updatePlan({...plan, missingKeys: event.target.value as JoinPlan['missingKeys']})}><option value="reject">发现缺失键即拒绝合并</option><option value="unmatched">将缺失键明确视为未匹配</option></select></label>
        </div>
      </fieldset>
      <p className={styles.help}>不支持多对多。每张表及输出最多 100,000 行、2,000 列、5,000,000 单元格；预计扩张超过限制会在构建输出表前拒绝。右表字段全部保留前缀，包括右侧合并键。</p>
      <div className={styles.actions}><Button variant="secondary" disabled={disabled || !right || !authReady} onClick={() => void preview()}>预览合并与样本审计</Button>{busy && <Button variant="ghost" onClick={() => {workEpoch.current++; setBusy(false); setStage(null); setAckId(''); setNotice('已取消预览或应用，数据未替换。');}}>取消当前操作</Button>}</div>
      {currentStage && <section aria-label="合并预览与样本审计" className={styles.checkResult}>
        <h4>应用前核对样本流转</h4>
        <dl className={styles.metrics}>{([['左表输入行', currentStage.receipt.audit.leftRows], ['右表输入行', currentStage.receipt.audit.rightRows], ['匹配的左表行', currentStage.receipt.audit.matchedLeft], ['未匹配左表行', currentStage.receipt.audit.unmatchedLeft], ['未匹配右表行', currentStage.receipt.audit.unmatchedRight], ['输出行', currentStage.receipt.audit.outputRows], ['左表重复键组', currentStage.receipt.audit.leftDuplicateKeys], ['右表重复键组', currentStage.receipt.audit.rightDuplicateKeys], ['左表缺键行', currentStage.receipt.audit.leftMissingKeys], ['右表缺键行', currentStage.receipt.audit.rightMissingKeys]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <p className={styles.help}>重复键按不同键组计数，匹配与未匹配按输入行计数。全连接的右侧独有行，其左表字段为空，不会伪造左表观测身份。</p>
        {currentStage.receipt.audit.issues.length > 0 && <ul>{currentStage.receipt.audit.issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll a wide local sample table. */}
        <div className={styles.scroll} role="region" aria-label="合并样本预览，可横向滚动" tabIndex={0}><table><caption>仅展示前 5 行、前 12 列；应用保留全部 {currentStage.preview.data.headers.length} 列。</caption><thead><tr>{currentStage.preview.data.headers.slice(0, 12).map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{currentStage.preview.data.rows.slice(0, 5).map((row, index) => <tr key={index}>{row.slice(0, 12).map((cell, column) => <td key={column}>{cell || '—'}</td>)}</tr>)}</tbody></table></div>
        <label className={styles.check}><input type="checkbox" checked={ackId === currentStage.id} disabled={disabled} onChange={event => setAckId(event.target.checked ? currentStage.id : '')}/>我已核对样本流转，确认将合并表作为新的分析原表，清空当前处理步骤与旧分析显示</label>
        <div className={styles.actions}><Button disabled={disabled || ackId !== currentStage.id} onClick={() => void apply()}>确认应用合并结果</Button><Button variant="secondary" disabled={disabled} onClick={() => downloadReceipt(currentStage.receipt)}>下载此合并凭证 JSON</Button></div>
        <p className={styles.help}>{cloudReady ? '应用时仅将来源名称、合并设置、行数与指纹登记到当前项目，不上传数据行。网络失败时可独立重试凭证登记。' : '本次合并只在当前设备应用；登录并从研究项目进入后才会登记云端凭证。请下载凭证并保留两份源文件。'}</p>
      </section>}
      {applied && <section aria-label="最近应用的合并凭证"><p className={styles.control}>最近一次应用：{applied.name} · {applied.output.rows} 行。输出 SHA-256：{applied.output.fingerprint}</p><Button variant="ghost" onClick={() => downloadReceipt(applied)}>下载最近应用的合并凭证</Button></section>}
      {pending.length > 0 && <section aria-label="待登记的合并凭证"><h4>{pending.length} 份合并凭证尚待确认登记</h4><p className={styles.help}>重试只登记同一份凭证，不重新合并或替换当前数据。</p><Button variant="secondary" disabled={saving || ledger.busy || !cloudReady} onClick={() => void saveReceipts(pending)}>重试登记合并凭证</Button><ul>{pending.map(item => <li key={item.id}>{item.receipt.name} · {item.receipt.createdAt}<Button variant="ghost" size="sm" onClick={() => downloadReceipt(item.receipt)}>下载待登记凭证</Button></li>)}</ul></section>}
      {(reading || busy) && <p role="status">{reading ? '正在本机读取右表…' : '正在本机核对表格与指纹…'}</p>}
      {saving && <p role="status">正在登记合并凭证，原始数据没有上传。</p>}
      {(error || pendingView.scope === scope && pendingView.error) && <p role="alert">{error || pendingView.error}</p>}
      {ledger.error && cloudReady && <p role="alert">{ledger.error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  </details>;
}
