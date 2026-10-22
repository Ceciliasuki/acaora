"use client";

import craft from '../operational-craft.module.css';
import styles from "../focused-workspaces.module.css";
import AppSidebar from "../components/app-sidebar";
import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, FileSearch, GraduationCap, PenLine, Plus, Users, X, type LucideIcon } from "lucide-react";

import { FormEvent, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { authFetch, getCurrentUser } from "../lib/auth-client";
import { Button, Dialog, ErrorState, PageHeader } from "../components/ui";
import MotionNavigation from '../components/motion-navigation';
import {paperSourceHref, validateProjectEvidence, type ProjectEvidence} from '../lib/project-evidence';

type Viewer = { id: string; email?: string } | null;
type Task = { id: string; text: string; done: boolean };
type ProjectMetadata = {
  goal?: string;
  deadline?: string;
  notes?: string;
  tasks?: Task[];
  evidence?: ProjectEvidence[];
};
type Project = {
  id: string;
  title: string;
  kind: string;
  status: "active" | "paused" | "completed";
  metadata: ProjectMetadata;
  created_at: string;
  updated_at: string;
};

const kindOptions = [
  { value: "course", label: "课程项目", icon: BookOpen },
  { value: "paper", label: "论文研究", icon: FileSearch },
  { value: "data", label: "数据分析", icon: BarChart3 },
  { value: "writing", label: "学术写作", icon: PenLine },
  { value: "group", label: "团队协作", icon: Users },
  { value: "career", label: "成长规划", icon: GraduationCap },
] satisfies Array<{ value: string; label: string; icon: LucideIcon }>;

const statusLabels = { active: "进行中", paused: "已暂停", completed: "已完成" };

function kindInfo(kind: string) {
  return kindOptions.find((item) => item.value === kind) ?? kindOptions[0];
}

function projectProgress(project: Project) {
  const tasks = project.metadata.tasks ?? [];
  if (!tasks.length) return project.status === "completed" ? 100 : 0;
  return Math.round(tasks.filter((task) => task.done).length / tasks.length * 100);
}

export default function ProjectsPage() {
  const [viewer, setViewer] = useState<Viewer>(null);
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});
  const operationLock = useRef(false);
  const accountEpoch = useRef(0);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [query, setQuery] = useState("");
  const [taskFilters, setTaskFilters] = useState<Record<string,"all"|"todo"|"done">>({});
  const taskListRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "active">("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  /* A failed load is its own state: without it the page rendered a zeroed register
     and the "create your first project" empty state, i.e. it read "we could not
     fetch your data" as "you have no data". */
  const [loadError, setLoadError] = useState("");

  const filteredProjects = useMemo(() => projects.filter(project => (filter !== "active" || project.status === "active") && `${project.title} ${project.metadata.goal ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [filter, projects, query]);
  const visibleSelectedId = filteredProjects.some((project) => project.id === selectedId) ? selectedId : filteredProjects[0]?.id ?? "";
  const selected = projects.find((project) => project.id === visibleSelectedId) ?? null;
  const taskText = selected ? taskDrafts[selected.id] ?? "" : "";
  const notes = selected ? noteDrafts[selected.id] ?? selected.metadata.notes ?? "" : "";
  const taskFilter = selected ? taskFilters[selected.id] ?? "all" : "all";
  const allTasks = selected?.metadata.tasks ?? [];
  const visibleTasks = allTasks.filter(task => taskFilter === "all" || (taskFilter === "done" ? task.done : !task.done));
  const remainingCount = allTasks.filter(task => !task.done).length;
  const activeCount = projects.filter((project) => project.status === "active").length;

  useEffect(() => {
    let active = true;
    const epochs = accountEpoch;
    const load = () => {
    if(!active)return;
    const epoch = ++accountEpoch.current;
    setProjects([]); setViewer(null); setLoaded(false); setShowCreate(false); setDeleteOpen(false); setNoteDrafts({}); setTaskDrafts({}); setMessage(''); setLoadError('');
    void getCurrentUser()
      .then(async (user) => {
        if (!active || epoch !== accountEpoch.current) return;
        setViewer(user);
        if (!user) return;
        const response = await authFetch("/api/projects");
        const data = await response.json() as { projects?: Project[]; error?: string };
        if (!active || epoch !== accountEpoch.current) return;
        if (!response.ok) throw new Error(data.error ?? "项目读取失败。");
        const nextProjects = data.projects ?? [];
        setProjects(nextProjects);
        const requested = new URLSearchParams(window.location.search).get('project');
        setSelectedId(nextProjects.find(project=>project.id===requested)?.id ?? nextProjects[0]?.id ?? '');
        if (new URLSearchParams(window.location.search).get("new") === "1" || !nextProjects.length) setShowCreate(true);
      })
      .catch((error: unknown) => {if(active && epoch===accountEpoch.current)setLoadError(error instanceof Error ? error.message : '项目读取失败。');})
      .finally(() => {if(active && epoch===accountEpoch.current)setLoaded(true);});
    };
    queueMicrotask(load);
    window.addEventListener('acaora:auth-change',load);
    return ()=>{active=false; epochs.current++; window.removeEventListener('acaora:auth-change',load);};
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operationLock.current) return;
    operationLock.current = true;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    const epoch = accountEpoch.current;
    try {
      if ((await getCurrentUser())?.id !== viewer?.id || epoch !== accountEpoch.current) throw new Error('账户已切换，请重新操作。');
      const response = await authFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          expectedOwnerId: viewer?.id,
          kind: form.get("kind"),
          status: "active",
          metadata: { goal: form.get("goal"), deadline: form.get("deadline"), notes: "", tasks: [] },
        }),
      });
      const payload = await response.json() as { project?: Project; error?: string };
      if (epoch !== accountEpoch.current) return;
      if (!response.ok || !payload.project) throw new Error(payload.error ?? "创建项目失败。");
      setProjects((current) => [payload.project!, ...current]);
      setSelectedId(payload.project.id);
      setShowCreate(false);
      setMessageTone("success");
      setMessage("项目已创建，可以开始拆解任务了。");
    } catch (error) {
      if (epoch !== accountEpoch.current) return;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "创建项目失败。");
    } finally {
      operationLock.current = false;
      setSaving(false);
    }
  }

  async function saveProject(next: Project, successMessage = "项目已保存。") {
    if (operationLock.current) return false;
    operationLock.current = true;
    setSaving(true);
    setMessage("");
    const epoch = accountEpoch.current;
    try {
      if ((await getCurrentUser())?.id !== viewer?.id || epoch !== accountEpoch.current) throw new Error('账户已切换，请重新操作。');
      const response = await authFetch(`/api/projects?id=${encodeURIComponent(next.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({...next,expectedUpdatedAt:next.updated_at,expectedOwnerId:viewer?.id}),
      });
      const payload = await response.json() as { project?: Project; error?: string };
      if (epoch !== accountEpoch.current) return false;
      if (response.status === 409) {
        const latest = await authFetch('/api/projects');
        const data = await latest.json() as {projects?:Project[]};
        if (epoch !== accountEpoch.current) return false;
        if (latest.ok && data.projects) setProjects(data.projects);
      }
      if (!response.ok || !payload.project) throw new Error(payload.error ?? "项目保存失败。");
      setProjects((current) => current.map((project) => project.id === next.id ? payload.project! : project));
      setMessageTone("success");
      setMessage(successMessage);
      return true;
    } catch (error) {
      if (epoch !== accountEpoch.current) return false;
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "项目保存失败。");
      return false;
    } finally {
      operationLock.current = false;
      setSaving(false);
    }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    if (!selected || !taskText.trim() || operationLock.current) return;
    const task: Task = { id: crypto.randomUUID(), text: taskText.trim(), done: false };
    const id = selected.id;
    const saved = await saveProject({ ...selected, metadata: { ...selected.metadata, tasks: [...(selected.metadata.tasks ?? []), task] } }, "新任务已加入项目。" );
    if (saved) setTaskDrafts(current => current[id] === taskText ? {...current, [id]: ""} : current);
  }

  async function toggleTask(taskId: string, control: HTMLInputElement) {
    if (!selected) return;
    const tasks = (selected.metadata.tasks ?? []).map((task) => task.id === taskId ? { ...task, done: !task.done } : task);
    const saved = await saveProject({ ...selected, metadata: { ...selected.metadata, tasks } }, "任务进度已更新。" );
    if (saved) requestAnimationFrame(() => {
      if (document.activeElement !== document.body && document.activeElement !== control) return;
      if (control.isConnected) control.focus();
      else (taskListRef.current?.querySelector<HTMLInputElement>('input:not([disabled])') ?? document.querySelector<HTMLButtonElement>('.project-task-filter button[aria-pressed="true"]'))?.focus();
    });
  }

  async function deleteProject() {
    if (!selected || operationLock.current) return;
    operationLock.current = true;
    setSaving(true); setMessage("");
    const epoch=accountEpoch.current;
    try {
      if((await getCurrentUser())?.id!==viewer?.id||epoch!==accountEpoch.current)throw new Error('账户已切换，请重新操作。');
      const response = await authFetch(`/api/projects?id=${encodeURIComponent(selected.id)}`, {method:"DELETE"});
      const payload = await response.json() as {error?:string};
      if(epoch!==accountEpoch.current)return;
      if (!response.ok) throw new Error(payload.error ?? "删除项目失败。");
      setProjects(current => current.filter(project => project.id !== selected.id));
      setSelectedId(""); setDeleteOpen(false); setMessageTone("success"); setMessage("项目已删除。");
    } catch (error) {
      if(epoch!==accountEpoch.current)return;
      setMessageTone("error"); setMessage(error instanceof Error ? error.message : "删除项目失败，请重试。");
    } finally {operationLock.current = false; setSaving(false);}
  }

  /* The create dialog is a hand-rolled modal, so it owes the same contract the
     primitive's native <dialog> gets for free: Escape closes it, and initial focus
     lands on the first field. `autoFocus` would fire on mount regardless of context,
     which is why jsx-a11y rejects it; focusing after the open is the correct form. */
  const createTitleRef = useRef<HTMLInputElement>(null);
  const createDialogRef = useRef<HTMLDivElement>(null);
  const createTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!showCreate) return;
    createTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    createTitleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!operationLock.current) setShowCreate(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(createDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.tabIndex >= 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      createTriggerRef.current?.focus();
    };
  }, [showCreate]);

  function navigateProject(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const controls=Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(':scope > button') ?? []);
    const index=controls.indexOf(event.currentTarget);
    if(index<0)return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?controls.length-1:Math.max(0,Math.min(controls.length-1,index+(event.key==='ArrowDown'?1:-1)));
    controls[next].focus();controls[next].click();
    controls[next].scrollIntoView({block:'nearest',inline:'nearest'});
  }

  const initials = viewer?.email?.slice(0, 2).toUpperCase() ?? "GU";

  return (
    <main className={`student-app project-app workspace-refresh ${craft.craft}`}>
      <AppSidebar active="projects" initials={initials} profileTitle={viewer?.email?.split("@")[0] ?? "匿名学习者"} profileSubtitle={viewer ? "项目已进行用户隔离" : "登录后开启项目云端记忆"} />

      <section className={`student-main project-main project-shell ${styles.focused}`}>
        <PageHeader className="workspace-header" title="项目空间" description="管理目标、任务和研究笔记。" actions={<button className="project-create-button" disabled={!viewer || saving} onClick={() => {setMessage(""); setShowCreate(true);}}><Plus size={17} aria-hidden="true" />新建项目</button>} />

        <div className="page-body">
        {message && !showCreate && !deleteOpen && <div className="project-message workspace-feedback" data-tone={messageTone} role={messageTone === "error" ? "alert" : "status"}>{message}</div>}

        {!loaded ? <section className="project-loading"><i /><p>正在读取项目…</p></section> : loadError ? (
          <ErrorState
            description={loadError}
            action={<Button variant="secondary" onClick={() => location.reload()}>重新加载</Button>}
          />
        ) : !viewer ? (
          <section className="project-login-wall"><h2>登录后查看项目</h2><p>项目、任务与笔记会在你的设备之间同步。</p><Link href="/auth">注册或密码登录 <ArrowRight size={16} aria-hidden="true" /></Link></section>
        ) : (
          <>

            {!projects.length ? <section className="project-empty"><h2>还没有项目</h2><p>创建项目后，可以添加任务、关联资料和记录笔记。</p><button onClick={() => {setMessage(""); setShowCreate(true);}}>建立项目空间 <ArrowRight size={16} aria-hidden="true" /></button></section> : (
              <section className="project-workbench">
                <aside className="project-library">
                  <MotionNavigation as="div" className="project-filter" label="项目筛选" role="group" value={filter}><button className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部 {projects.length}</button><button className={filter === "active" ? "active" : ""} aria-pressed={filter === "active"} onClick={() => setFilter("active")}>进行中 {activeCount}</button></MotionNavigation>
                  <div className="project-search"><label htmlFor="project-search">查找项目</label><input id="project-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="项目名称或目标"/>{query && <button type="button" aria-label="清除项目搜索" onClick={()=>setQuery("")}><X size={15} aria-hidden="true"/></button>}</div>
                  <div className="project-list" role="group" aria-label="项目列表">{filteredProjects.map((project) => {
                    const kind = kindInfo(project.kind);
                    return <button className={project.id === visibleSelectedId ? "active" : ""} aria-current={project.id === visibleSelectedId ? "true" : undefined} key={project.id} onKeyDown={navigateProject} onClick={() => setSelectedId(project.id)}><div><span>{kind.label} · {statusLabels[project.status]}</span><strong>{project.title}</strong><small>{(project.metadata.tasks ?? []).filter((task) => task.done).length} / {(project.metadata.tasks ?? []).length} 项任务完成</small></div></button>;
                  })}{!filteredProjects.length && <div className="project-filter-empty"><p>{query ? "没有匹配的项目。" : "没有进行中的项目。"}</p><button type="button" onClick={()=>{setQuery("");setFilter("all");}}>查看全部项目</button></div>}</div>

                </aside>

                {selected && <article key={selected.id} className="project-detail">
                  <header className="project-detail-head"><div><span>{kindInfo(selected.kind).label.toUpperCase()} · {statusLabels[selected.status]}</span><h2>{selected.title}</h2><p>{selected.metadata.goal || "还没有填写项目目标。"}</p></div><div><select aria-label="项目状态" disabled={saving} value={selected.status} onChange={(event) => void saveProject({ ...selected, status: event.target.value as Project["status"] }, "项目状态已更新。") }><option value="active">进行中</option><option value="paused">暂停</option><option value="completed">已完成</option></select><button className="project-more" onClick={() => {setMessage(""); setDeleteOpen(true);}} disabled={saving}>删除</button></div></header>

                  <p className="project-summary"><span key={(selected.metadata.tasks ?? []).filter((task) => task.done).length}>{(selected.metadata.tasks ?? []).filter((task) => task.done).length} / {(selected.metadata.tasks ?? []).length} 项任务完成</span><span>{projectProgress(selected)}%</span>{selected.metadata.deadline && <span>截止 {selected.metadata.deadline}</span>}</p>

                  <div className="project-detail-grid">
                    <section className="project-task-card"><header><div><h3>任务清单</h3></div></header><form onSubmit={event => void addTask(event)}><input value={taskText} onChange={(event) => setTaskDrafts(current => ({...current,[selected.id]:event.target.value}))} placeholder="输入下一步要做的事" aria-label="新任务" /><Button type="submit" disabled={saving || !taskText.trim()}>添加</Button></form><MotionNavigation as="div" className="project-task-filter" role="group" label="任务筛选" value={taskFilter}>{([['all',`全部 ${allTasks.length}`],['todo',`待办 ${remainingCount}`],['done',`已完成 ${allTasks.length-remainingCount}`]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={taskFilter===value} onClick={()=>setTaskFilters(current=>({...current,[selected.id]:value}))}>{label}</button>)}</MotionNavigation><div className="project-tasks" ref={taskListRef}>{visibleTasks.length ? visibleTasks.map((task) => <label className={task.done ? "done" : ""} key={task.id}><input type="checkbox" disabled={saving} checked={task.done} onChange={event => void toggleTask(task.id,event.currentTarget)} /><span>{task.text}</span></label>) : <p>{!allTasks.length ? "还没有任务。可以先记录需要查找的论文或待处理的数据。" : taskFilter === "todo" ? "当前没有待办任务。" : "当前没有已完成任务。"}</p>}</div></section>

                    <section className="project-note-card"><header><h3>项目笔记</h3></header><textarea value={notes} onChange={(event) => setNoteDrafts((current) => ({ ...current, [selected.id]: event.target.value }))} placeholder="记录研究思路、导师反馈或待解决的问题…" id="project-notes" aria-label="项目笔记" /><div className="project-note-actions"><span className="workspace-draft-state">{notes !== (selected.metadata.notes ?? "") ? "有未保存修改" : "与已保存笔记一致"}</span><Button disabled={saving || notes === (selected.metadata.notes ?? "")} onClick={() => void saveProject({ ...selected, metadata: { ...selected.metadata, notes } }, "项目笔记已保存。")}>{saving ? "保存中…" : "保存笔记"}</Button></div></section>
                  </div>

                  <section className="project-evidence" aria-labelledby="project-evidence-title"><header><h3 id="project-evidence-title">论文证据</h3><p>在论文笔记或批注中选择“加入项目”，保留摘录和来源位置。</p></header>
                    {(selected.metadata.evidence ?? []).filter(validateProjectEvidence).map(entry=><article key={entry.id}><p className="project-evidence-source">{entry.paperTitle} · 第 {entry.page} 页 · {entry.section}</p><blockquote>{entry.quote}</blockquote>{entry.comment&&<p><strong>个人评论：</strong>{entry.comment}</p>}<div><Link href={paperSourceHref(entry)}>返回原文</Link><button type="button" disabled={saving} onClick={()=>void saveProject({...selected,metadata:{...selected.metadata,evidence:(selected.metadata.evidence??[]).filter(item=>item.id!==entry.id)}},'已移除关联，原论文和批注保留。')}>移除关联</button></div></article>)}
                    {!selected.metadata.evidence?.length&&<p>还没有关联的论文摘录。</p>}
                  </section>
                  <nav className="project-related" aria-label="项目相关工作台"><Link href="/papers">查阅论文 <ArrowRight size={15} aria-hidden="true" /></Link><Link href="/data">分析数据 <ArrowRight size={15} aria-hidden="true" /></Link></nav>
                </article>}
              </section>
            )}
          </>
        )}
        </div>

      </section>

      {showCreate && viewer && <div ref={createDialogRef} className="project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title" aria-describedby="create-project-description">
        <button className="project-modal-backdrop" disabled={saving} onClick={() => setShowCreate(false)} aria-label="关闭新建项目窗口" />
        <form onSubmit={createProject}>
          <header><div><h2 id="create-project-title">建立一个项目空间</h2><p id="create-project-description">先定义目标，后续再逐步加入论文、数据和任务。</p></div><button type="button" onClick={() => setShowCreate(false)} disabled={saving} aria-label="关闭"><X size={20} aria-hidden="true" /></button></header>
          <label>项目名称<input ref={createTitleRef} name="title" required maxLength={120} placeholder="例如：大学生睡眠与学习成绩研究" /></label>
          <label>项目类型<select name="kind" defaultValue="paper">{kindOptions.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}</select></label>
          <label>希望完成什么？<textarea name="goal" rows={3} placeholder="用一句话描述你想得到的最终成果" /></label>
          <label>计划截止日期<input name="deadline" type="date" /></label>
          {message && messageTone === "error" && <p className="project-create-error" role="alert">{message}</p>}
          <footer><button type="button" disabled={saving} onClick={() => setShowCreate(false)}>取消</button><button className="primary" disabled={saving}>{saving ? "正在创建…" : "创建项目空间"}</button></footer>
        </form>
      </div>}
      <Dialog open={deleteOpen} title="删除这个项目？" description={selected ? `“${selected.title}”及其任务和笔记将被永久删除。` : undefined} confirmLabel={saving ? "正在删除…" : "确认删除"} busy={saving} destructive onConfirm={() => void deleteProject()} onClose={() => setDeleteOpen(false)}>{message && messageTone === "error" && <p className="project-create-error" role="alert">{message}</p>}</Dialog>
    </main>
  );
}
