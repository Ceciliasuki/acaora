'use client';

import {useEffect, useId, useRef, useState, type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowRight, Download, Plus} from 'lucide-react';
import {Button, Dialog} from '../components/ui';
import {navigateTabs} from '../components/tab-keyboard';
import {paperSourceHref, validateProjectEvidence} from '../lib/project-evidence';
import {withResearchProject} from '../lib/research-links';
import {analysisRoles, analysisSnapshotHref, buildResearchExport, emptyResearchDossier, findingAssessments, missingFindingSources, protocolFields, validateProjectAnalyses, validateResearchDossier, type ResearchDossier, type ResearchExportProject, type ResearchFinding} from '../lib/project-research';
import {readResearchDraft, writeResearchDraft, type ResearchDraft} from './research-drafts';
import styles from './project-research-workspace.module.css';

export function downloadResearchText(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name;
  anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
type Props = {ownerId: string; project: ResearchExportProject; saving: boolean; onSave: (research: ResearchDossier) => Promise<boolean>};
const views = [['design', '研究设计'], ['analyses', '分析台账'], ['findings', '结论与证据']] as const;

export default function ProjectResearchWorkspace({ownerId, project, saving, onSave}: Props) {
  const saved = validateResearchDossier(project.metadata.research) ? project.metadata.research : emptyResearchDossier();
  const signature = JSON.stringify(saved);
  const invalidSaved = project.metadata.research !== undefined && !validateResearchDossier(project.metadata.research)
    || project.metadata.analysisRecords !== undefined && !validateProjectAnalyses(project.metadata.analysisRecords);
  const analyses = validateProjectAnalyses(project.metadata.analysisRecords) ? project.metadata.analysisRecords : [];
  const evidence = (project.metadata.evidence ?? []).filter(validateProjectEvidence);
  const [initial] = useState(() => readResearchDraft(ownerId, project.id));
  const [draft, setDraft] = useState<ResearchDraft | null>(initial.draft);
  const raw = useRef(initial.raw);
  const [blocked, setBlocked] = useState(Boolean(initial.error && initial.raw));
  const [durable, setDurable] = useState(!initial.error);
  const [error, setError] = useState(initial.error);
  const [view, setView] = useState<typeof views[number][0]>('design');
  const [discard, setDiscard] = useState(false);
  const [leftId, setLeftId] = useState(''), [rightId, setRightId] = useState('');
  const base = useId();
  const value = draft?.value ?? saved;
  const dirty = Boolean(draft && JSON.stringify(draft.value) !== signature);
  const conflict = Boolean(dirty && draft?.baseline !== signature);
  const disabled = saving || blocked || invalidSaved;
  const left = analyses.find(entry => entry.id === leftId), right = analyses.find(entry => entry.id === rightId);
  const metrics = [...new Set([...(left?.metrics.map(([key]) => key) ?? []), ...(right?.metrics.map(([key]) => key) ?? [])])];
  useEffect(() => {
    if (!dirty || durable) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, durable]);

  function change(next: ResearchDossier, baseline = draft?.baseline ?? signature) {
    if (disabled) return;
    if (JSON.stringify(next) === signature) {
      const cleared = writeResearchDraft(ownerId, project.id, null, raw.current);
      if (cleared.ok) {raw.current = null; setDraft(null); setDurable(true); setError(''); return;}
    }
    const entry: ResearchDraft = {version: 1, ownerId, projectId: project.id, baseline, value: next};
    setDraft(entry); setError('');
    const result = writeResearchDraft(ownerId, project.id, entry, raw.current);
    setDurable(result.ok); if (result.ok) raw.current = result.raw;
  }
  function updateFinding(finding: ResearchFinding) {change({...value, findings: value.findings.map(entry => entry.id === finding.id ? finding : entry)});}
  async function save(event: FormEvent) {
    event.preventDefault(); if (disabled || !dirty || conflict) return;
    if (!validateResearchDossier(value)) {setError('请补写每条结论的内容；作出“倾向支持”等判读前，至少关联一条论文摘录或分析记录。'); return;}
    if (await onSave(value)) {
      const result = writeResearchDraft(ownerId, project.id, null, raw.current);
      if (result.ok) raw.current = null;
      setDraft(null); setDurable(true);
      setError(result.ok ? '' : '账户记录已保存；另一标签页的本机草稿被保留，请核对后处理。');
    }
  }
  function discardDraft() {
    const result = writeResearchDraft(ownerId, project.id, null, raw.current);
    if (!result.ok) {setError('本机草稿已被另一标签页修改或无法清理，未覆盖它。请先导出你的草稿。'); setDiscard(false); return;}
    raw.current = null; setDraft(null); setDurable(true); setBlocked(false); setError(''); setDiscard(false);
  }
  function exportSaved(format: 'md' | 'json') {
    try {
      if (invalidSaved) throw new Error('账户研究记录格式异常，未生成不完整档案。请保留原记录并排查。');
      const report = buildResearchExport(project), name = `acaora-research-${project.id.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)}`;
      downloadResearchText(format === 'md' ? report.markdown : report.json, `${name}.${format}`, format === 'md' ? 'text/markdown;charset=utf-8' : 'application/json');
    } catch (cause) {setError(cause instanceof Error ? cause.message : '档案导出失败。');}
  }
  return <section className={styles.workspace} aria-labelledby={`${base}-title`}>
    <header className={styles.header}><div><h3 id={`${base}-title`}>研究工作台</h3><p>明确研究设计，将模型结果与支撑材料连接到研究结论。</p></div><div className={styles.actions}><Button variant="secondary" size="sm" onClick={() => exportSaved('md')}><Download size={15} aria-hidden="true"/>导出研究档案</Button><Button variant="ghost" size="sm" onClick={() => exportSaved('json')}>导出研究记录 JSON</Button></div></header>
    <p className={styles.scope}>导出仅包含已保存记录，不含原始文件、数据行或完整本机快照。研究方案属于工作记录，不构成预注册。</p>
    {invalidSaved && <p role="alert" className={styles.error}>账户研究记录格式不受支持，已停止编辑以保护原件。任务、笔记和论文仍保留。</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {blocked && <div className={styles.actions}><Button variant="secondary" onClick={() => downloadResearchText(raw.current ?? '', 'acaora-research-draft-original.txt', 'text/plain')}>导出本机草稿原件</Button><Button variant="ghost" onClick={() => setDiscard(true)}>使用已保存记录重新编辑</Button></div>}
    {conflict && <div className={styles.conflict} role="alert"><p>账户中的研究记录已有更新。你的本机草稿保留，暂未覆盖账户记录。</p><details><summary>比较账户中最新的研究记录</summary><pre>{JSON.stringify(saved, null, 2)}</pre></details><p>确认采用草稿会替换研究设计与结论；最新任务、笔记、论文和分析台账保留。</p><Button variant="secondary" disabled={disabled} onClick={() => change(value, signature)}>已比较，确认采用研究草稿</Button></div>}
    <div role="tablist" tabIndex={-1} aria-label="研究记录分区" className={styles.tabs} onKeyDown={navigateTabs}>{views.map(([key, label]) => <button key={key} type="button" role="tab" id={`${base}-${key}`} aria-controls={`${base}-${key}-panel`} aria-selected={view === key} tabIndex={view === key ? 0 : -1} onClick={() => setView(key)}>{label}</button>)}</div>
    <form onSubmit={event => void save(event)}>
      <div role="tabpanel" id={`${base}-design-panel`} aria-labelledby={`${base}-design`} hidden={view !== 'design'} className={styles.panel}>
        <div className={styles.fields}>{protocolFields.slice(0, 4).map(([key, label, hint]) => <label key={key}>{label}<textarea aria-label={label} maxLength={2000} rows={3} value={value.protocol[key]} disabled={disabled} placeholder={hint} onChange={event => change({...value, protocol: {...value.protocol, [key]: event.target.value}})}/></label>)}</div>
        <details className={styles.extra}><summary>样本、变量、稳健性与局限</summary><div className={styles.fields}>{protocolFields.slice(4).map(([key, label, hint]) => <label key={key}>{label}<textarea aria-label={label} maxLength={2000} rows={3} value={value.protocol[key]} disabled={disabled} placeholder={hint} onChange={event => change({...value, protocol: {...value.protocol, [key]: event.target.value}})}/></label>)}</div></details>
      </div>
      <div role="tabpanel" id={`${base}-analyses-panel`} aria-labelledby={`${base}-analyses`} hidden={view !== 'analyses'} className={styles.panel}>
        <p className={styles.help}>登记摘要、数据指纹、模型设置与研究者解释随项目保存；完整快照仍在原设备。旧快照链接保留在“研究资料”和项目笔记中。</p>
        {analyses.length > 0 ? <><div className={styles.comparison}><label>分析 A<select aria-label="分析 A" value={left?.id ?? ''} onChange={event => setLeftId(event.target.value)}><option value="">选择对照记录</option>{analyses.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><label>分析 B<select aria-label="分析 B" value={right?.id ?? ''} onChange={event => setRightId(event.target.value)}><option value="">选择对照记录</option>{analyses.filter(entry => entry.id !== left?.id).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label></div>
          {left && right && left.id !== right.id && <><p role="status" className={styles.comparisonNote}>{left.dataset.fingerprint === right.dataset.fingerprint ? '处理表指纹一致，仍需核对变量、规格和单位。' : '处理表指纹不同，差异可能来自样本或处理步骤变化。'}对照展示登记值，不会自动重算或判断模型优劣。{(left.sample || right.sample) && '包含示例数据登记，仅用于流程演示。'}</p><div className={styles.tableWrap} role="region" aria-label="分析登记对照表，可横向滚动"><button type="button" className="sr-only" aria-label="使用左右方向键横向滚动分析登记对照表" onKeyDown={event => {if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); event.currentTarget.parentElement?.scrollBy({left:event.key === 'ArrowRight' ? 160 : -160});}}>横向滚动表格</button><table><caption>已保存的分析摘要</caption><thead><tr><th>指标</th><th>{left.name}</th><th>{right.name}</th></tr></thead><tbody>{metrics.map(key => <tr key={key}><th scope="row">{key}</th><td>{left.metrics.find(([name]) => name === key)?.[1] ?? '—'}</td><td>{right.metrics.find(([name]) => name === key)?.[1] ?? '—'}</td></tr>)}</tbody></table></div></>}
          <div className={styles.records}>{analyses.map(record => <details key={record.id}><summary><strong>{record.name}</strong><span>{analysisRoles[record.role]} · {record.method}{record.sample ? ' · 示例数据' : ''}</span></summary><p>{record.dataset.name} · 登记行数 {record.dataset.rows} · 快照时间 {record.createdAt}</p><p className={styles.fingerprint}>处理表 SHA-256：{record.dataset.fingerprint}</p><p>{record.context}</p><p><strong>研究者解释：</strong>{record.interpretation}</p><details><summary>登记时的模型设置</summary><pre>{record.settings}</pre></details><Link href={analysisSnapshotHref(record, project.id)}>打开本机完整快照<ArrowRight size={14} aria-hidden="true"/></Link><p className={styles.help}>换设备后仍可读本登记摘要；打开完整快照需导入原备份并重新选择数据文件。</p>{record.evidenceIds.map(key => {const source = evidence.find(entry => entry.id === key); return source ? <p key={key}><Link href={withResearchProject(paperSourceHref(source), project.id)}>核对论文摘录：{source.paperTitle}</Link></p> : <p key={key} className={styles.error}>论文摘录关联已失效：{key}</p>;})}</details>)}</div></> : <p className={styles.empty}>还没有结构化分析记录。完成分析、保存命名快照后，在“关联快照到项目”中登记用途、解释与论文来源。<Link href={withResearchProject('/data', project.id)}>进入数据分析<ArrowRight size={14} aria-hidden="true"/></Link></p>}
      </div>
      <div role="tabpanel" id={`${base}-findings-panel`} aria-labelledby={`${base}-findings`} hidden={view !== 'findings'} className={styles.panel}>
        <p className={styles.help}>判读由研究者填写，平台不据此确认因果关系或统计结论。保留不一致的证据、局限与替代解释。</p>
        {!value.findings.length && <p className={styles.empty}>尚未记录结论。将一条明确陈述与论文摘录、分析记录对应起来，再判断证据是否充分。</p>}
        <div className={styles.findings}>{value.findings.map((finding, index) => <details key={finding.id} open={!saved.findings.some(entry => entry.id === finding.id)}><summary><strong>{finding.statement || `新结论 ${index + 1} · 待补写`}</strong><span>{finding.withdrawn ? '已撤下 · 保留记录' : findingAssessments[finding.assessment]}</span></summary>
          <label>结论陈述<textarea aria-label={`结论陈述 ${index + 1}`} rows={3} maxLength={2000} disabled={disabled} value={finding.statement} onChange={event => updateFinding({...finding, statement: event.target.value})}/></label>
          <label>研究者判读<select aria-label={`研究者判读 ${index + 1}`} disabled={disabled} value={finding.assessment} onChange={event => updateFinding({...finding, assessment: event.target.value as ResearchFinding['assessment']})}>{Object.entries(findingAssessments).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <fieldset disabled={disabled}><legend>关联支撑材料</legend>{!evidence.length && !analyses.length && <p>先在论文或数据工作台保存关联，再回来选择材料。</p>}{evidence.map(entry => <label key={entry.id} className={styles.check}><input type="checkbox" aria-label={`论文摘录 ${index + 1}：${entry.paperTitle} · ${entry.id}`} checked={finding.evidenceIds.includes(entry.id)} onChange={event => updateFinding({...finding, evidenceIds: event.target.checked ? [...finding.evidenceIds, entry.id] : finding.evidenceIds.filter(key => key !== entry.id)})}/><span>{entry.paperTitle} · 第 {entry.page} 页<small>{entry.quote.slice(0, 140)}</small></span></label>)}{analyses.map(entry => <label key={entry.id} className={styles.check}><input type="checkbox" aria-label={`分析记录 ${index + 1}：${entry.name}`} checked={finding.analysisIds.includes(entry.id)} onChange={event => updateFinding({...finding, analysisIds: event.target.checked ? [...finding.analysisIds, entry.id] : finding.analysisIds.filter(key => key !== entry.id)})}/><span>{entry.name}<small>{analysisRoles[entry.role]} · {entry.method}{entry.sample ? ' · 示例数据' : ''}</small></span></label>)}</fieldset>
          {missingFindingSources(finding, evidence, analyses).length > 0 && <p role="alert" className={styles.error}>部分关联材料已移除，需要重新核对：{missingFindingSources(finding, evidence, analyses).join('、')}。原结论没有自动删除。</p>}
          <label>局限与替代解释<textarea aria-label={`局限与替代解释 ${index + 1}`} rows={3} maxLength={2000} disabled={disabled} value={finding.limitations} onChange={event => updateFinding({...finding, limitations: event.target.value})}/></label>
          <Button variant="ghost" disabled={disabled} onClick={() => updateFinding({...finding, withdrawn: !finding.withdrawn})}>{finding.withdrawn ? '恢复此结论' : '撤下此结论并保留记录'}</Button>{!saved.findings.some(entry => entry.id === finding.id) && <Button variant="ghost" disabled={disabled} onClick={() => change({...value, findings: value.findings.filter(entry => entry.id !== finding.id)})}>移除此条未保存结论</Button>}
        </details>)}</div>
        <Button variant="secondary" disabled={disabled || value.findings.length >= 20} onClick={() => change({...value, findings: [...value.findings, {id: crypto.randomUUID(), statement: '', assessment: 'unreviewed', limitations: '', evidenceIds: [], analysisIds: [], withdrawn: false}]})}><Plus size={15} aria-hidden="true"/>新增研究结论</Button>
      </div>
      <footer className={styles.saveBar}><span role="status">{dirty ? durable ? '研究草稿已保存在本机 · 尚未保存到账户' : '草稿暂未写入本机，请勿关闭或离开页面' : '显示账户已保存记录'}</span><div className={styles.actions}>{dirty && <Button variant="ghost" disabled={saving} onClick={() => setDiscard(true)}>放弃本机草稿</Button>}<Button type="submit" disabled={disabled || !dirty || conflict} loading={saving}>保存研究记录</Button></div></footer>
    </form>
    <Dialog open={discard} title="放弃未保存的研究草稿？" description="账户中已保存的研究记录保留。仅清理本机这份未保存草稿。" confirmLabel="放弃草稿并显示已保存记录" destructive onConfirm={discardDraft} onClose={() => setDiscard(false)}/>
  </section>;
}
