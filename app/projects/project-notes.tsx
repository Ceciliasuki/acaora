'use client';

import {useEffect, useRef, useState} from 'react';
import {Button, StatusMessage} from '../components/ui';
import {clearProjectNoteDraft, isProjectNoteDraftDurable, readProjectNoteDraft, storeProjectNoteDraft, type ProjectNoteDraft} from './project-note-drafts';
import styles from './project-notes.module.css';
import Link from 'next/link';
import {projectAnalysisLinks, withResearchProject} from '../lib/research-links';

type Props = {
  readOnly?:boolean;
  ownerId: string;
  projectId: string;
  savedNotes: string;
  savedUpdatedAt: string;
  saving: boolean;
  onSave: (text: string) => Promise<false | {notes: string; updatedAt: string}>;
};

export default function ProjectNotes({readOnly=false,ownerId, projectId, savedNotes, savedUpdatedAt, saving, onSave}: Props) {
  const [draft, setDraft] = useState(() => readProjectNoteDraft(ownerId, projectId));
  const [durable, setDurable] = useState(() => !draft || isProjectNoteDraftDurable(draft));
  const [clearError, setClearError] = useState(false);
  const draftRef = useRef(draft);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [submittedText, setSubmittedText] = useState<string | null>(null);
  const mounted = useRef(true);
  const dirty = Boolean(draft && draft.text !== savedNotes);
  const conflict = Boolean(dirty && draft?.baseNotes !== savedNotes && submittedText !== savedNotes);
  const snapshots=projectAnalysisLinks(savedNotes).map(item => ({...item, href: withResearchProject(item.href, projectId)}));

  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {
    if (!dirty || durable) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', warn);
  return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, durable]);

  function remember(next: ProjectNoteDraft | null) {
    const previous = draftRef.current;
    draftRef.current = next;
    setDraft(next);
    const stored = next ? storeProjectNoteDraft(next) : clearProjectNoteDraft(ownerId, projectId, previous ?? undefined);
    setDurable(stored);
    setClearError(!next && !stored);
  }

  function change(text: string) {
    if (text === savedNotes && submittedText === null) {remember(null); return;}
    const previous = draftRef.current?.text === savedNotes ? null : draftRef.current;
    remember({version: 1, ownerId, projectId, text,
      baseNotes: previous?.baseNotes ?? savedNotes, baseUpdatedAt: previous?.baseUpdatedAt ?? savedUpdatedAt, updatedAt: Date.now()});
  }

  async function save() {
    const submitted = draftRef.current;
    if (!submitted || conflict || saving) return;
    setSubmittedText(submitted.text);
    const result = await onSave(submitted.text);
    if (!mounted.current) {
      if (result) clearProjectNoteDraft(ownerId, projectId, submitted);
      return;
    }
    if (result) {
      const latest = draftRef.current;
      if (latest && latest.text !== submitted.text) {
        remember({...latest, baseNotes: result.notes, baseUpdatedAt: result.updatedAt, updatedAt: Date.now()});
      } else {
        setClearError(!clearProjectNoteDraft(ownerId, projectId, submitted));
        draftRef.current = null; setDraft(null); setDurable(true);
      }
    }
    setSubmittedText(null);
  }

  if(readOnly)return <div><p>共享项目笔记（查看权限）</p><p style={{whiteSpace:'pre-wrap'}}>{savedNotes||'尚无笔记。'}</p></div>;
  return <section className="project-note-card">
    <header><h3>项目笔记</h3></header>
    {snapshots.length>0&&<nav aria-label="关联的本机分析快照">{snapshots.map((snapshot,index)=><p key={index}><Link href={snapshot.href}>打开分析快照：{snapshot.name}</Link><small> · 仅原保存设备与账户可用</small></p>)}</nav>}
    {conflict && <StatusMessage tone="warning" className={styles.conflict}>
      <p>已保存笔记在草稿形成后发生变化。请比较版本，再决定保留哪一份；当前尚未覆盖账户笔记。</p>
      <details><summary>比较草稿与已保存笔记</summary><div className={styles.comparison}>
        <section><h4>已保存到账户</h4><p>{savedNotes || '（空）'}</p></section>
        <section><h4>本机草稿</h4><p>{draft?.text || '（空）'}</p></section>
      </div></details>
      <div className={styles.choices}>
        <Button variant="secondary" onClick={() => {if (draft) remember({...draft, baseNotes: savedNotes, baseUpdatedAt: savedUpdatedAt, updatedAt: Date.now()}); requestAnimationFrame(() => editorRef.current?.focus());}}>恢复草稿继续编辑</Button>
        <Button variant="ghost" onClick={() => {remember(null); requestAnimationFrame(() => editorRef.current?.focus());}}>使用已保存笔记</Button>
      </div>
    </StatusMessage>}
    <textarea ref={editorRef} value={draft?.text ?? savedNotes} readOnly={conflict} onChange={event => change(event.target.value)} placeholder="记录研究思路、导师反馈或待解决的问题…" id="project-notes" aria-label="项目笔记" aria-describedby="project-note-state" />
    <div className="project-note-actions">
      <span id="project-note-state" className="workspace-draft-state" role="status">{dirty ? durable ? '草稿已保存在本机 · 尚未保存到账户' : '草稿暂未写入本机，请勿刷新或关闭页面' : '笔记已保存到账户'}</span>
      <Button disabled={saving || !dirty || conflict} onClick={() => void save()}>{saving ? '保存中…' : '保存笔记'}</Button>
    </div>
    {dirty && !durable && <Button variant="secondary" onClick={() => draft && setDurable(storeProjectNoteDraft(draft))}>重试保存本机草稿</Button>}
    {clearError && <p role="status">本机草稿未能清理，刷新后可能再次提示恢复；账户中的笔记不受影响。</p>}
  </section>;
}
