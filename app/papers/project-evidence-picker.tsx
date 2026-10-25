'use client';

import Link from 'next/link';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Button, Dialog, FormField, Select, Textarea} from '../components/ui';
import {authChangeEvent, authFetch, getCurrentUser} from '../lib/auth-client';
import {evidenceDuplicateKey, validateProjectEvidence, type ProjectEvidence, type ProjectEvidenceDraft} from '../lib/project-evidence';
import {projectsChangedEvent} from '../lib/research-links';

type Project = {
  id: string;
  title: string;
  kind: string;
  status: string;
  metadata: Record<string, unknown> & {evidence?: ProjectEvidence[]};
  updated_at: string;
};

export default function ProjectEvidencePicker({draft, ownerId, projectId = null, onClose, onSaved}: {
  draft: ProjectEvidenceDraft;
  ownerId: string;
  projectId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [comment, setComment] = useState(draft.comment);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const controllerRef = useRef<AbortController | null>(null);
  const closeRef = useRef(onClose);
  const savedRef = useRef(onSaved);
  const lockRef = useRef(false);
  useEffect(() => {closeRef.current = onClose; savedRef.current = onSaved;}, [onClose, onSaved]);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    const accountChanged = () => {controller.abort(); closeRef.current();};
    window.addEventListener(authChangeEvent, accountChanged);
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (controller.signal.aborted) return;
        if (user?.id !== ownerId) {accountChanged(); return;}
        const response = await authFetch('/api/projects', {signal: controller.signal});
        const payload = await response.json() as {projects?: Project[]; error?: string};
        if (controller.signal.aborted) return;
        const current = await getCurrentUser();
        if (controller.signal.aborted) return;
        if (current?.id !== ownerId) {accountChanged(); return;}
        if (!response.ok) throw new Error(payload.error ?? '项目读取失败，请稍后重新打开。');
        const records = payload.projects ?? [];
        setProjects(records);
        setSelectedId(projectId === null ? records[0]?.id ?? '' : records.find(item => item.id === projectId)?.id ?? '');
        if (projectId !== null && !records.some(item => item.id === projectId)) setError('当前研究项目不可访问，请重新选择项目；未自动改用其他项目。');
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '项目读取失败。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => {
      controller.abort();
      window.removeEventListener(authChangeEvent, accountChanged);
    };
  }, [ownerId, projectId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const controller = controllerRef.current;
    if (!controller || controller.signal.aborted || lockRef.current || !selectedId) return;
    lockRef.current = true;
    setSaving(true);
    setError('');
    setFeedback('');
    const signal = controller.signal;
    const checkOwner = async () => {
      if (signal.aborted) return false;
      const user = await getCurrentUser();
      if (signal.aborted) return false;
      if (user?.id === ownerId) return true;
      controller.abort();
      closeRef.current();
      return false;
    };
    try {
      if (!await checkOwner()) return;
      // Read the latest whole record to retain notes/tasks added since this dialog opened.
      const latestResponse = await authFetch('/api/projects', {signal});
      const latestPayload = await latestResponse.json() as {projects?: Project[]; error?: string};
      if (!await checkOwner()) return;
      if (!latestResponse.ok) throw new Error(latestPayload.error ?? '无法读取最新项目，未加入摘录。');
      const project = latestPayload.projects?.find(item => item.id === selectedId);
      if (!project) throw new Error('这个项目已不存在，请关闭后重新选择。');
      const evidence = project.metadata.evidence ?? [];
      if (!Array.isArray(evidence) || !evidence.every(validateProjectEvidence)) throw new Error('项目中的来源记录格式异常，未覆盖原有内容。');
      if (evidence.some(item => evidenceDuplicateKey(item) === evidenceDuplicateKey(draft))) {
        setFeedback('这条摘录已在项目中，无需重复加入。');
        return;
      }
      const entry: ProjectEvidence = {...draft, comment, id: crypto.randomUUID(), createdAt: Date.now()};
      if (!validateProjectEvidence(entry)) throw new Error('摘录内容过长或来源信息不完整，请缩短摘录后重试。');
      if (!project.updated_at) throw new Error('项目缺少版本信息，未覆盖原有内容。');
      if (!await checkOwner()) return;
      const response = await authFetch(`/api/projects?id=${encodeURIComponent(project.id)}`, {
        method: 'PATCH', signal, headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...project, metadata: {...project.metadata, evidence: [...evidence, entry]}, expectedUpdatedAt: project.updated_at, expectedOwnerId:ownerId}),
      });
      const payload = await response.json() as {project?: Project; error?: string};
      if (!await checkOwner()) return;
      if (response.status === 409) throw new Error('项目刚刚有其他修改，请再次点击加入以读取最新内容。');
      if (!response.ok || !payload.project) throw new Error(payload.error ?? '加入项目失败，请重试。');
      window.dispatchEvent(new Event(projectsChangedEvent));
      savedRef.current();
    } catch (cause) {
      if (!signal.aborted) setError(cause instanceof Error ? cause.message : '加入项目失败，请重试。');
    } finally {
      lockRef.current = false;
      if (!signal.aborted) setSaving(false);
    }
  }

  return <Dialog open title="将摘录加入项目" description="原文、来源位置和个人评论分别保存。" busy={saving} onClose={onClose}>
    <form className="plab-evidence-picker" onSubmit={event => void save(event)}>
      <p>{draft.paperTitle} · 第 {draft.page} 页 · {draft.section}</p>
      <blockquote>{draft.quote}</blockquote>
      {loading ? <p role="status">正在读取项目…</p> : projects.length ? <>
        <FormField label="选择项目"><Select value={selectedId} disabled={saving} onChange={event => {setSelectedId(event.target.value); setFeedback('');}}><option value="">选择项目</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</Select></FormField>
        <FormField label="个人评论"><Textarea value={comment} maxLength={5000} rows={4} disabled={saving} onChange={event => setComment(event.target.value)} /></FormField>
      </> : !error && <p>还没有项目。<Link href="/projects?new=1">先建立一个项目空间</Link>，再回来加入摘录。</p>}
      {error && <p className="ui-field-error" role="alert">{error}</p>}
      {feedback && <p role="status">{feedback}</p>}
      <footer><Button variant="secondary" disabled={saving} onClick={onClose}>取消</Button><Button type="submit" disabled={loading || !selectedId} loading={saving}>加入项目</Button></footer>
    </form>
  </Dialog>;
}
