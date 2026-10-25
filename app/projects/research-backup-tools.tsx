'use client';

import {useEffect, useId, useRef, useState, type ChangeEvent} from 'react';
import Link from 'next/link';
import {Button} from '../components/ui';
import {authChangeEvent, authFetch, getCurrentUser} from '../lib/auth-client';
import {ledgerKinds, MAX_BACKUP_BYTES, parseProjectBackup, researchHash, uuid, type ProjectBackup} from '../lib/research-ledger';
import type {ResearchLedger} from './use-research-ledger';
import styles from './project-research-workspace.module.css';

type Stage = {backup: ProjectBackup; fileName: string; title: string; acknowledged: boolean; fresh: boolean; freshId: string};
type View = {identity: string; phase: 'idle' | 'reading' | 'exporting' | 'preview' | 'restoring' | 'invalid'; stage: Stage | null; error: string; notice: string; restored: {projectId: string; reused: boolean} | null};
const empty = (identity: string): View => ({identity, phase: 'idle', stage: null, error: '', notice: '', restored: null});
const operationKey = (ownerId: string, stage: Stage) => JSON.stringify([ownerId, stage.backup.manifest.projectHash, stage.backup.manifest.eventsHash, stage.title.trim()]);
async function restoreOperationId(ownerId: string, stage: Stage) {
  const hash = await researchHash({operation: 'acaora-project-restore-v1', ownerId, projectHash: stage.backup.manifest.projectHash, eventsHash: stage.backup.manifest.eventsHash, title: stage.title.trim()});
  const characters = hash.slice(0, 32).split(''); characters[12] = '5'; characters[16] = ((parseInt(characters[16], 16) & 3) | 8).toString(16);
  const value = characters.join(''); return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
function downloadBackup(backup: ProjectBackup) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = `acaora-project-backup-${backup.project.id}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ResearchBackupTools({ownerId, projectId, ledger}: {ownerId: string; projectId: string; ledger: ResearchLedger}) {
  const identity = JSON.stringify([ownerId, projectId]);
  const [stored, setStored] = useState<View>(() => empty(identity));
  const view = stored.identity === identity ? stored : empty(identity);
  const stage = view.stage;
  const [derived, setDerived] = useState<{identity: string; key: string; id: string} | null>(null);
  const epoch = useRef(0), sequence = useRef(0), alive = useRef(false), invalid = useRef(false), controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null), titleId = useId();
  const busy = ['reading', 'exporting', 'restoring'].includes(view.phase) || ledger.busy;
  const key = stage ? operationKey(ownerId, stage) : '';
  const operationId = stage?.fresh ? stage.freshId : derived?.identity === identity && derived.key === key ? derived.id : '';
  const current = (token: number, operation: number) => alive.current && !invalid.current && epoch.current === token && sequence.current === operation;
  useEffect(() => {
    alive.current = true; invalid.current = false; epoch.current++; sequence.current++;
    const changed = () => {invalid.current = true; epoch.current++; sequence.current++; controller.current?.abort(); setDerived(null); setStored({...empty(identity), phase: 'invalid', error: '账户已变化，已清除备份预览并停止显示旧账户恢复结果。请重新打开项目后选择文件。'}); if (input.current) input.current.value = '';};
    window.addEventListener(authChangeEvent, changed);
    // Numeric identity tokens must invalidate the latest operation at cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {alive.current = false; epoch.current++; sequence.current++; controller.current?.abort(); window.removeEventListener(authChangeEvent, changed);};
  }, [identity]);
  useEffect(() => {
    if (!stage || !stage.title.trim() || stage.title.trim().length > 120) return;
    let active = true; const token = epoch.current;
    void restoreOperationId(ownerId, stage).then(id => {if (active && alive.current && !invalid.current && epoch.current === token) setDerived({identity, key, id});}).catch(() => {if (active && alive.current && !invalid.current && epoch.current === token) setStored(previous => previous.identity === identity ? {...previous, error: '无法生成恢复重试标识，请更新浏览器或使用 HTTPS 页面。'} : previous);});
    return () => {active = false;};
    // Only content identity and the normalised title change the default token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, identity, key]);

  function updateStage(change: Partial<Stage>) {
    if (!stage || busy || view.phase === 'invalid') return;
    setStored({...view, stage: {...stage, ...change}, error: '', notice: '', restored: null});
  }
  async function ownerMatches(token: number, operation: number) {
    const user = await getCurrentUser();
    if (!current(token, operation)) return false;
    if (user?.id === ownerId) return true;
    invalid.current = true; epoch.current++; sequence.current++; controller.current?.abort(); setDerived(null);
    setStored({...empty(identity), phase: 'invalid', error: '账户已变化，未继续读取或显示旧账户的恢复内容。请重新打开项目。'});
    if (input.current) input.current.value = '';
    return false;
  }
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || invalid.current) return;
    const token = epoch.current, operation = ++sequence.current; controller.current?.abort();
    setDerived(null); setStored({...empty(identity), phase: 'reading', notice: `正在核对 ${file.name}…`});
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('项目备份超过 20 MB，未读取或写入账户。');
      if (!await ownerMatches(token, operation)) return;
      const text = await file.text(); if (!current(token, operation)) return;
      const backup = await parseProjectBackup(text); if (!current(token, operation)) return;
      if (!await ownerMatches(token, operation)) return;
      const title = `${backup.project.title.slice(0, 112)}（恢复副本）`;
      setStored({...empty(identity), phase: 'preview', stage: {backup, fileName: file.name, title, acknowledged: false, fresh: false, freshId: crypto.randomUUID()}, notice: '备份结构与校验值已通过。尚未向账户写入任何恢复记录。'});
    } catch (cause) {if (current(token, operation)) setStored({...empty(identity), error: `${file.name}：${cause instanceof Error ? cause.message : '备份无法读取。'} 原文件保留，未导入。`});}
  }
  async function exportBackup() {
    if (busy || invalid.current) return;
    const token = epoch.current, operation = ++sequence.current;
    setStored({...view, phase: 'exporting', error: '', notice: ''});
    try {
      if (!await ownerMatches(token, operation)) return;
      const backup = await ledger.backup(); if (!current(token, operation)) return;
      if (!await ownerMatches(token, operation)) return;
      if (!backup) throw new Error('备份导出未能确认，请检查研究记录读取状态后重试。');
      const checked = await parseProjectBackup(JSON.stringify(backup));
      if (!await ownerMatches(token, operation)) return;
      if (checked.project.id !== projectId) throw new Error('备份返回的项目与当前项目不一致，未下载。');
      downloadBackup(checked);
      setStored({...view, phase: stage ? 'preview' : 'idle', error: '', notice: '已导出项目主体和全部研究记录版本；原始文件及本机完整快照未包含在备份中。'});
    } catch (cause) {if (current(token, operation)) setStored({...view, phase: stage ? 'preview' : 'idle', error: cause instanceof Error ? cause.message : '备份导出失败。'});}
  }
  async function restore() {
    if (busy || !stage || !stage.acknowledged || !stage.title.trim() || stage.title.trim().length > 120 || !operationId || invalid.current || view.restored) return;
    const token = epoch.current, operation = ++sequence.current, request = new AbortController(); controller.current?.abort(); controller.current = request;
    setStored({...view, phase: 'restoring', error: '', notice: ''});
    try {
      if (!await ownerMatches(token, operation)) return;
      const response = await authFetch('/api/projects/workbench', {method: 'PUT', signal: request.signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify({backup: stage.backup, importId: operationId, title: stage.title.trim(), expectedOwnerId: ownerId})});
      const result = await response.json() as {projectId?: string; reused?: boolean; error?: string};
      if (!current(token, operation) || request.signal.aborted) return;
      if (!await ownerMatches(token, operation)) return;
      if (!response.ok) throw new Error(result.error ?? '项目恢复失败，输入已保留。');
      if (!uuid(result.projectId) || typeof result.reused !== 'boolean') throw new Error('服务器返回的恢复结果无法确认，请保留相同文件和名称重试。');
      setStored({...view, phase: 'preview', error: '', restored: {projectId: result.projectId, reused: result.reused}, notice: result.reused ? '已找到此恢复操作先前创建的副本，没有再建立重复项目。' : '已创建新的项目副本，原项目没有被覆盖或合并。'});
    } catch (cause) {if (current(token, operation) && !request.signal.aborted) setStored({...view, phase: 'preview', error: `恢复未完成或结果未能确认：${cause instanceof Error ? cause.message : '网络请求失败。'} 输入已保留；使用相同文件和名称重试将核对同一恢复操作。`});}
  }
  const counts = stage ? Object.entries(ledgerKinds).map(([kind, label]) => ({label, count: stage.backup.events.filter(event => event.collection === kind).length})).filter(entry => entry.count > 0) : [];
  return <section aria-label="项目备份与恢复">
    <h4>项目备份与恢复</h4><p className={styles.help}>备份包含项目主体、研究记录与版本历史。恢复只创建新的项目副本，不覆盖、合并或删除现有项目；原始 PDF、数据文件及本机完整快照需另行保管。</p>
    <div className={styles.actions}><Button variant="secondary" disabled={busy || view.phase === 'invalid' || ledger.loading} onClick={() => void exportBackup()}>{view.phase === 'exporting' ? '正在导出…' : '导出完整项目备份'}</Button><label>选择项目备份 JSON<input ref={input} aria-label="选择项目备份 JSON" type="file" accept="application/json,.json" disabled={busy && view.phase !== 'reading' || view.phase === 'invalid'} onChange={event => void choose(event)}/></label></div>
    {view.error && <p className={styles.error} role="alert">{view.error}</p>}{view.notice && <p role="status" className={styles.help}>{view.notice}</p>}
    {stage && <section aria-label="项目恢复预览"><h4>核对恢复内容</h4><p>{stage.backup.project.title} · {stage.fileName} · 导出时间 {stage.backup.exportedAt}</p><p>{stage.backup.events.length} 条历史记录，{new Set(stage.backup.events.map(event => event.entity_id)).size} 项研究条目。{counts.map(entry => `${entry.label} ${entry.count} 条`).join('；')}</p>
      <dl><dt>原项目标识</dt><dd className={styles.fingerprint}>{stage.backup.project.id}</dd><dt>恢复操作标识</dt><dd className={styles.fingerprint}>{operationId || '正在生成稳定重试标识…'}</dd><dt>新项目标识</dt><dd className={styles.fingerprint}>{view.restored?.projectId ?? '确认恢复后由服务器创建；原标识保留在来源记录中。'}</dd></dl>
      <details><summary>核对备份校验值</summary><p className={styles.fingerprint}>项目 SHA-256：{stage.backup.manifest.projectHash}</p><p className={styles.fingerprint}>记录 SHA-256：{stage.backup.manifest.eventsHash}</p></details>
      <div className={styles.fields}><label htmlFor={titleId}>恢复副本名称<input id={titleId} aria-label="恢复副本名称" maxLength={120} disabled={busy} value={stage.title} onChange={event => updateStage({title: event.target.value, acknowledged: false, freshId: crypto.randomUUID()})}/></label></div>
      <label><input type="checkbox" disabled={busy} checked={stage.fresh} onChange={event => updateStage({fresh: event.target.checked, acknowledged: false})}/>明确另建一份独立副本（不同于上次相同备份的恢复操作）</label>
      <p className={styles.help}>默认使用账户、备份校验值和副本名称生成稳定标识。请求中断后保留相同文件与名称，可确认先前的恢复结果；勾选另建副本才会使用新的独立操作标识。</p>
      <label><input type="checkbox" aria-label="我确认恢复将创建新项目，且备份不含原始文件和本机完整快照" disabled={busy} checked={stage.acknowledged} onChange={event => updateStage({acknowledged: event.target.checked})}/>我确认恢复将创建新项目，且备份不含原始文件和本机完整快照</label>
      <div className={styles.actions}><Button disabled={busy || !stage.acknowledged || !stage.title.trim() || !operationId || Boolean(view.restored)} onClick={() => void restore()}>{view.phase === 'restoring' ? '正在恢复…' : '确认创建恢复副本'}</Button>{view.restored && <Link href={`/projects?${new URLSearchParams({project: view.restored.projectId})}`}>打开恢复后的项目</Link>}</div>
    </section>}
  </section>;
}
