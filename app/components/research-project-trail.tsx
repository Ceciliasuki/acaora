'use client';

import {Suspense, useEffect, useState} from 'react';
import Link from 'next/link';
import {usePathname, useSearchParams} from 'next/navigation';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {authChangeEvent, authFetch, getCurrentUser} from '../lib/auth-client';
import {paperSourceHref, validateProjectEvidence, type ProjectEvidence} from '../lib/project-evidence';
import {projectAnalysisLinks, projectsChangedEvent, researchProjectId, withResearchProject} from '../lib/research-links';
import styles from './research-project-trail.module.css';

type Project = {id: string; title: string; metadata: {notes?: string; evidence?: ProjectEvidence[]; analysisRecords?: unknown}};
type State = {status: 'loading' | 'guest' | 'ready' | 'changed' | 'error'; projects: Project[]; error?: string};

export default function ResearchProjectTrail({paperId}: {paperId?: string}) {
  return <Suspense fallback={null}><ProjectTrail paperId={paperId}/></Suspense>;
}

function ProjectTrail({paperId}: {paperId?: string}) {
  const query = useSearchParams(), path = usePathname();
  const requested = query.get('project'), projectId = researchProjectId(requested);
  const snapshotId = query.get('snapshot');
  const [state, setState] = useState<State>({status: 'loading', projects: []});
  const [choice, setChoice] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, epoch = 0, invalidated = false;
    let controller: AbortController | undefined;
    async function load() {
      const generation = ++epoch;
      controller?.abort();
      const request = new AbortController(); controller = request;
      const current = () => active && generation === epoch && !request.signal.aborted;
      setState({status: 'loading', projects: []}); setChoice('');
      try {
        const user = await getCurrentUser();
        if (!current()) return;
        if (!user) {setState({status: 'guest', projects: []}); return;}
        const response = await authFetch('/api/projects', {signal: request.signal});
        const payload = await response.json() as {projects?: Project[]; error?: string};
        if (!current()) return;
        if (!response.ok) throw new Error(payload.error ?? '项目读取失败。');
        if ((await getCurrentUser())?.id !== user.id || !current()) return;
        setState({status: 'ready', projects: payload.projects ?? []});
      } catch (cause) {
        if (current()) setState({status: 'error', projects: [], error: cause instanceof Error ? cause.message : '项目读取失败。'});
      }
    }
    const changed = () => {invalidated = true; epoch++; controller?.abort(); setState({status: 'changed', projects: []}); setChoice('');};
    const refresh = () => {if (!invalidated) void load();};
    void load();
    window.addEventListener(authChangeEvent, changed);
    window.addEventListener(projectsChangedEvent, refresh);
    return () => {active = false; epoch++; controller?.abort(); window.removeEventListener(authChangeEvent, changed); window.removeEventListener(projectsChangedEvent, refresh);};
  }, [retry]);
  const href = `${path}?${query.toString()}`;
  const independent = withResearchProject(href, null);
  const project = state.projects.find(item => item.id === projectId);
  const related = state.projects.filter(item => paperId
    ? item.metadata.evidence?.some(entry => validateProjectEvidence(entry) && entry.paperId === paperId)
    : snapshotId && projectAnalysisLinks(item.metadata.notes ?? '', item.metadata.analysisRecords).some(link => link.id === snapshotId));
  if (state.status === 'loading') return requested !== null ? <div className={styles.trail} role="status">正在确认研究项目…</div> : null;
  if (state.status === 'changed') return <aside className={styles.trail} aria-label="当前研究项目"><p role="status">账户已变化，项目关联已清空；没有切换到其他项目。</p><button type="button" onClick={() => setRetry(value => value + 1)}>重新确认当前账户的项目</button>{requested !== null && <Link href={independent}>独立使用当前工作台</Link>}</aside>;
  if (state.status === 'guest') return requested !== null ? <aside className={styles.trail} aria-label="当前研究项目"><p>登录后才能确认这个项目；尚未关联任何资料。</p><Link href="/auth">登录</Link><Link href={independent}>独立使用当前工作台</Link></aside> : null;
  if (state.status === 'error') return <aside className={styles.trail} aria-label="当前研究项目"><p role="alert">{state.error} 论文与数据仍可独立使用。</p><button type="button" onClick={() => setRetry(value => value + 1)}>重试读取项目</button>{requested !== null && <Link href={independent}>退出本项目流程</Link>}</aside>;
  if (requested !== null && !project) return <aside className={styles.trail} aria-label="当前研究项目"><p role="alert">无法访问指定项目，可能已删除或账户已变化。没有切换到其他项目。</p><Link href={independent}>独立使用当前工作台</Link></aside>;
  if (project) {
    const source = project.metadata.evidence?.find(validateProjectEvidence);
    return <aside className={styles.trail} aria-label="当前研究项目">
      <div className={styles.copy}><strong>{project.title}</strong><p>{path === '/papers' ? '在笔记或批注中将摘录加入本项目，保留原文位置。' : '保存命名快照后，将分析解释与下一步加入本项目。'}</p></div>
      <nav aria-label="继续当前研究"><Link href={withResearchProject('/projects', project.id)}><ArrowLeft size={15} aria-hidden="true"/>返回项目</Link>{path === '/papers' ? <Link href={withResearchProject('/data', project.id)}>分析数据<ArrowRight size={15} aria-hidden="true"/></Link> : <Link href={withResearchProject(source ? paperSourceHref(source) : '/papers', project.id)}>查阅论文<ArrowRight size={15} aria-hidden="true"/></Link>}<Link href={independent}>退出本项目流程</Link></nav>
    </aside>;
  }
  return <aside className={styles.available} aria-label="研究项目关联">
    {related.length > 0 && <nav aria-label="已关联的研究项目"><span>已用于项目</span>{related.map(item => <Link key={item.id} href={withResearchProject('/projects', item.id)}>{item.title}<ArrowRight size={14} aria-hidden="true"/></Link>)}</nav>}
    <details><summary>为这次研究选择项目</summary><div className={styles.choose}><p>论文摘录、分析解释和下一步任务可汇集到同一项目。选择后仍需手动保存关联。</p>{state.projects.length ? <><label>研究项目<select value={choice} onChange={event => setChoice(event.target.value)}><option value="">选择项目</option>{state.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{state.projects.some(item => item.id === choice) && <Link className={styles.continue} href={withResearchProject(href, choice)}>进入本项目流程<ArrowRight size={15} aria-hidden="true"/></Link>}</> : <Link href="/projects?new=1">建立研究项目</Link>}</div></details>
  </aside>;
}
