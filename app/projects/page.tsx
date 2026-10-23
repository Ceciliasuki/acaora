"use client";

import craft from '../operational-craft.module.css';
import styles from "../focused-workspaces.module.css";
import AppSidebar from "../components/app-sidebar";
import Link from "next/link";
import {useSearchParams} from 'next/navigation';
import { ArrowRight, BarChart3, BookOpen, FileSearch, GraduationCap, PenLine, Plus, Users, X, type LucideIcon } from "lucide-react";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { authFetch, getCurrentUser } from "../lib/auth-client";
import { Button, Dialog, ErrorState, PageHeader } from "../components/ui";
import MotionNavigation from '../components/motion-navigation';
import {paperSourceHref, validateProjectEvidence, type ProjectEvidence} from '../lib/project-evidence';
import ProjectNotes from './project-notes';
import {clearProjectNoteDraft} from './project-note-drafts';
import editingStyles from './project-editing.module.css';

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
type SaveProject = (next: Project, message?: string) => Promise<Project | false>;
type ProjectFields = {title: string; goal: string; deadline: string};
const projectFields = (project: Project): ProjectFields => ({title: project.title, goal: project.metadata.goal ?? '', deadline: project.metadata.deadline ?? ''});
const sameFields = (left: ProjectFields, right: ProjectFields) => left.title === right.title && left.goal === right.goal && left.deadline === right.deadline;

function ProjectMetadataEditor({project, saving, error, onSave, onStart}: {project: Project; saving: boolean; error: string; onSave: SaveProject; onStart: () => void}) {
  const [draft, setDraft] = useState<ProjectFields | null>(null);
  const [baseline, setBaseline] = useState(projectFields(project));
  const trigger = useRef<HTMLButtonElement>(null);
  const titleField = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const open = draft !== null;
  const latest = projectFields(project);
  const conflict = open && !sameFields(baseline, latest);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {if (open) titleField.current?.focus();}, [open]);
  function close() {setDraft(null); requestAnimationFrame(() => trigger.current?.focus());}
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || saving || conflict || !draft.title.trim()) return;
    // Only the editable fields come from the form. Notes, tasks, evidence and the
    // version always come from the latest received project, including after 409.
    const saved = await onSave({...project, title: draft.title.trim(), metadata: {...project.metadata, goal: draft.goal, deadline: draft.deadline}}, '项目资料已保存。');
    if (saved && mounted.current) close();
  }
  if (!draft) return <div className={editingStyles.editEntry}><Button ref={trigger} variant="secondary" disabled={saving} onClick={() => {onStart(); setBaseline(latest); setDraft(latest);}}>编辑项目资料</Button></div>;
  return <form className={editingStyles.projectForm} aria-labelledby="project-edit-title" onSubmit={event => void save(event)}>
    <h3 id="project-edit-title">编辑项目资料</h3>
    {conflict && <div className={editingStyles.conflict} role="alert"><p>项目资料已在其他操作中更新。你的输入仍保留，请先比较已保存内容。</p><dl><div><dt>已保存名称</dt><dd>{latest.title}</dd></div><div><dt>已保存目标</dt><dd>{latest.goal || '未填写'}</dd></div><div><dt>已保存截止日期</dt><dd>{latest.deadline || '未填写'}</dd></div></dl><Button variant="secondary" disabled={saving} onClick={() => {setBaseline(latest); titleField.current?.focus();}}>保留输入并继续编辑资料</Button></div>}
    <div className={editingStyles.fields}>
      <label>项目名称<input ref={titleField} required maxLength={120} value={draft.title} disabled={saving} onChange={event => setDraft({...draft, title: event.target.value})}/></label>
      <label>计划截止日期<input type="date" value={draft.deadline} disabled={saving} onChange={event => setDraft({...draft, deadline: event.target.value})}/></label>
      <label className={editingStyles.goal}>项目目标<textarea aria-label="项目目标" rows={3} value={draft.goal} disabled={saving} onChange={event => setDraft({...draft, goal: event.target.value})}/></label>
    </div>
    {error && <p className={editingStyles.error} role="alert">{error}</p>}
    <div className={editingStyles.actions}><Button type="submit" disabled={saving || conflict || !draft.title.trim()} loading={saving}>保存项目资料</Button><Button variant="secondary" disabled={saving} onClick={close}>取消编辑资料</Button></div>
  </form>;
}

function ProjectTaskList({project, tasks, emptyMessage, saving, error, listRef, onSave, onToggle, onStart}: {project: Project; tasks: Task[]; emptyMessage: string; saving: boolean; error: string; listRef: RefObject<HTMLDivElement | null>; onSave: SaveProject; onToggle: (taskId: string, control: HTMLInputElement) => Promise<void>; onStart: () => void}) {
  const [editing, setEditing] = useState<{id: string; text: string; baseText: string} | null>(null);
  const [removing, setRemoving] = useState<Task | null>(null);
  const editor = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const mounted = useRef(true);
  const editingId = editing?.id;
  const currentTask = project.metadata.tasks?.find(task => task.id === editingId);
  const editConflict = !!editing && (!currentTask || currentTask.text !== editing.baseText);
  const removalTask = project.metadata.tasks?.find(task => task.id === removing?.id);
  const removeConflict = !!removing && (!removalTask || removalTask.text !== removing.text || removalTask.done !== removing.done);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {if (editingId) editor.current?.focus();}, [editingId]);
  function restoreFocus() {
    requestAnimationFrame(() => {
      if (!mounted.current) return;
      if (trigger.current?.isConnected) trigger.current.focus();
      else (listRef.current?.querySelector<HTMLInputElement>('input:not([disabled])') ?? listRef.current?.closest('section')?.querySelector<HTMLInputElement>('input[aria-label="新任务"]'))?.focus();
    });
  }
  function closeEditor() {setEditing(null); restoreFocus();}
  function closeRemoval() {setRemoving(null); restoreFocus();}
  async function saveTask(event: FormEvent) {
    event.preventDefault();
    if (!editing || !currentTask || editConflict || saving || !editing.text.trim()) return;
    const nextTasks = (project.metadata.tasks ?? []).map(task => task.id === editing.id ? {...task, text: editing.text.trim()} : task);
    const saved = await onSave({...project, metadata: {...project.metadata, tasks: nextTasks}}, '任务文字已保存。');
    if (saved && mounted.current) closeEditor();
  }
  async function removeTask() {
    if (!removing || !removalTask || removeConflict || saving) return;
    const nextTasks = (project.metadata.tasks ?? []).filter(task => task.id !== removing.id);
    const saved = await onSave({...project, metadata: {...project.metadata, tasks: nextTasks}}, '任务已移除，项目笔记与论文关联保留。');
    if (saved && mounted.current) closeRemoval();
  }
  return <>
    {editing && <form className={editingStyles.taskForm} aria-label="编辑任务" onSubmit={event => void saveTask(event)}>
      <label htmlFor="project-task-edit">任务文字</label><input ref={editor} id="project-task-edit" value={editing.text} required disabled={saving} onChange={event => setEditing({...editing, text: event.target.value})}/>
      {editConflict && <div className={editingStyles.conflict} role="alert">{currentTask ? <><p>任务文字已更新。已保存内容：{currentTask.text}</p><Button variant="secondary" disabled={saving} onClick={() => {setEditing({...editing, baseText: currentTask.text}); editor.current?.focus();}}>保留输入并继续编辑任务</Button></> : <p>该任务已被其他操作移除。你的输入仍保留，可复制文字后取消编辑；不会重新创建已移除的任务。</p>}</div>}
      {error && <p className={editingStyles.error} role="alert">{error}</p>}
      <div className={editingStyles.actions}><Button type="submit" disabled={saving || editConflict || !editing.text.trim()} loading={saving}>保存任务文字</Button><Button variant="secondary" disabled={saving} onClick={closeEditor}>取消编辑任务</Button></div>
    </form>}
    <div className={`project-tasks ${editingStyles.taskList}`} ref={listRef}>{tasks.length ? tasks.map(task => <div className={editingStyles.taskRow} key={task.id}>
      <label className={task.done ? 'done' : ''}><input type="checkbox" disabled={saving} checked={task.done} onChange={event => void onToggle(task.id, event.currentTarget)}/><span>{task.text}</span></label>
      <div className={editingStyles.taskActions}><Button variant="ghost" size="sm" disabled={saving || editing !== null} aria-label={`编辑任务：${task.text}`} onClick={event => {onStart(); trigger.current = event.currentTarget; setEditing({id: task.id, text: task.text, baseText: task.text});}}>编辑</Button><Button variant="ghost" size="sm" disabled={saving || editing !== null} aria-label={`移除任务：${task.text}`} onClick={event => {onStart(); trigger.current = event.currentTarget; setRemoving({...task});}}>移除</Button></div>
    </div>) : <p>{emptyMessage}</p>}</div>
    <Dialog open={removing !== null} title="移除这项任务？" description={removing ? `只移除任务“${removing.text}”，项目、笔记和论文关联会保留。` : undefined} confirmLabel={removeConflict ? undefined : '确认移除任务'} destructive busy={saving} onConfirm={removeConflict ? undefined : () => void removeTask()} onClose={closeRemoval}>
      {removeConflict && <div className={editingStyles.conflict} role="alert">{removalTask ? <><p>这项任务已有其他修改：{removalTask.text}（{removalTask.done ? '已完成' : '待办'}）。请检查后重新确认。</p><Button variant="secondary" disabled={saving} onClick={() => setRemoving({...removalTask})}>使用最新任务重新确认移除</Button></> : <p>该任务已被其他操作移除，无需再次删除。</p>}<Button variant="secondary" disabled={saving} onClick={closeRemoval}>取消移除任务</Button></div>}
      {error && <p className={editingStyles.error} role="alert">{error}</p>}
    </Dialog>
  </>;
}

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

// Observe same-route query changes under Suspense, like the paper reader.
function ProjectLocation({onChange}: {onChange: (query: string) => void}) {
  const query = useSearchParams().toString();
  useEffect(() => onChange(query), [query, onChange]);
  return null;
}

export default function ProjectsPage() {
  const [viewer, setViewer] = useState<Viewer>(null);
  const [loaded, setLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [locationQuery, setLocationQuery] = useState<string | null>(null);
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  /* A failed load is its own state: without it the page rendered a zeroed register
     and the "create your first project" empty state, i.e. it read "we could not
     fetch your data" as "you have no data". */
  const [loadError, setLoadError] = useState("");

  const filteredProjects = useMemo(() => projects.filter(project => (filter !== "active" || project.status === "active") && `${project.title} ${project.metadata.goal ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [filter, projects, query]);
  const requestedId = new URLSearchParams(locationQuery ?? '').get('project');
  const visibleSelectedId = requestedId ?? selectedId;
  const selected = projects.find((project) => project.id === visibleSelectedId) ?? null;
  const missingTarget = requestedId !== null && !selected;
  const taskText = selected ? taskDrafts[selected.id] ?? "" : "";
  const taskFilter = selected ? taskFilters[selected.id] ?? "all" : "all";
  const allTasks = selected?.metadata.tasks ?? [];
  const visibleTasks = allTasks.filter(task => taskFilter === "all" || (taskFilter === "done" ? task.done : !task.done));
  const remainingCount = allTasks.filter(task => !task.done).length;
  const activeCount = projects.filter((project) => project.status === "active").length;

  const selectProject = useCallback((id: string | null, replace = false) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('project', id);
    else url.searchParams.delete('project');
    url.searchParams.delete('new');
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${url.pathname}${url.search}`);
    setLocationQuery(url.searchParams.toString());
    setSelectedId(id ?? '');
  }, []);

  useEffect(() => {
    if (!loaded || !viewer || locationQuery === null || requestedId !== null || !projects.length) return;
    queueMicrotask(() => selectProject(projects[0].id, true));
  }, [loaded, viewer, locationQuery, requestedId, projects, selectProject]);

  useEffect(() => {
    let active = true;
    const epochs = accountEpoch;
    const load = () => {
    if(!active)return;
    const epoch = ++accountEpoch.current;
    setProjects([]); setViewer(null); setLoaded(false); setShowCreate(false); setDeleteOpen(false); setTaskDrafts({}); setMessage(''); setLoadError('');
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
        setSelectedId(requested ?? nextProjects[0]?.id ?? '');
        if (new URLSearchParams(window.location.search).get("new") === "1" || (!nextProjects.length && requested === null)) setShowCreate(true);
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
      selectProject(payload.project.id);
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

  async function saveProject(next: Project, successMessage = "项目已保存。"): Promise<Project | false> {
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
      return payload.project;
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
      clearProjectNoteDraft(viewer!.id, selected.id);
      setProjects(current => current.filter(project => project.id !== selected.id));
      selectProject(projects.find(project => project.id !== selected.id)?.id ?? null, true);
      setDeleteOpen(false); setMessageTone("success"); setMessage("项目已删除。");
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
      <Suspense fallback={null}><ProjectLocation onChange={setLocationQuery}/></Suspense>
      <AppSidebar active="projects" initials={initials} profileTitle={viewer?.email?.split("@")[0] ?? "匿名学习者"} profileSubtitle={viewer ? "项目已进行用户隔离" : "登录后开启项目云端记忆"} />

      <section className={`student-main project-main project-shell ${styles.focused}`}>
        <PageHeader className="workspace-header" title="项目空间" description="管理目标、任务和研究笔记。" actions={<button className="project-create-button" disabled={!viewer || saving} onClick={() => {setMessage(""); setShowCreate(true);}}><Plus size={17} aria-hidden="true" />新建项目</button>} />

        <div className="page-body">
        {message && !showCreate && !deleteOpen && <div className="project-message workspace-feedback" data-tone={messageTone} role={messageTone === "error" ? "alert" : "status"}>{message}</div>}

        {!loaded || locationQuery === null ? <section className="project-loading"><i /><p>正在读取项目…</p></section> : loadError ? (
          <ErrorState
            description={loadError}
            action={<Button variant="secondary" onClick={() => location.reload()}>重新加载</Button>}
          />
        ) : !viewer ? (
          <section className="project-login-wall"><h2>登录后查看项目</h2><p>项目、任务与笔记会在你的设备之间同步。</p><Link href="/auth">注册或密码登录 <ArrowRight size={16} aria-hidden="true" /></Link></section>
        ) : (
          <>

            {missingTarget ? <ErrorState title="无法打开指定项目" description="当前账户无法访问此项目，可能已删除或尚未同步。没有打开其他项目。" action={<Button variant="secondary" onClick={() => selectProject(projects[0]?.id ?? null, true)}>返回项目列表</Button>} /> : !projects.length ? <section className="project-empty"><h2>还没有项目</h2><p>创建项目后，可以添加任务、关联资料和记录笔记。</p><button onClick={() => {setMessage(""); setShowCreate(true);}}>建立项目空间 <ArrowRight size={16} aria-hidden="true" /></button></section> : (
              <section className="project-workbench">
                <aside className="project-library">
                  <MotionNavigation as="div" className="project-filter" label="项目筛选" role="group" value={filter}><button className={filter === "all" ? "active" : ""} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部 {projects.length}</button><button className={filter === "active" ? "active" : ""} aria-pressed={filter === "active"} onClick={() => setFilter("active")}>进行中 {activeCount}</button></MotionNavigation>
                  <div className="project-search"><label htmlFor="project-search">查找项目</label><input id="project-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="项目名称或目标"/>{query && <button type="button" aria-label="清除项目搜索" onClick={()=>setQuery("")}><X size={15} aria-hidden="true"/></button>}</div>
                  <div className="project-list" role="group" aria-label="项目列表">{filteredProjects.map((project) => {
                    const kind = kindInfo(project.kind);
                    return <button className={project.id === visibleSelectedId ? "active" : ""} aria-current={project.id === visibleSelectedId ? "true" : undefined} key={project.id} onKeyDown={navigateProject} onClick={() => selectProject(project.id)}><div><span>{kind.label} · {statusLabels[project.status]}</span><strong>{project.title}</strong><small>{(project.metadata.tasks ?? []).filter((task) => task.done).length} / {(project.metadata.tasks ?? []).length} 项任务完成</small></div></button>;
                  })}{!filteredProjects.length && <div className="project-filter-empty"><p>{query ? "没有匹配的项目。" : "没有进行中的项目。"}</p><button type="button" onClick={()=>{setQuery("");setFilter("all");}}>查看全部项目</button></div>}</div>

                </aside>

                {selected && <article key={selected.id} className="project-detail">
                  <header className="project-detail-head"><div><span>{kindInfo(selected.kind).label.toUpperCase()} · {statusLabels[selected.status]}</span><h2>{selected.title}</h2><p>{selected.metadata.goal || "还没有填写项目目标。"}</p></div><div><select aria-label="项目状态" disabled={saving} value={selected.status} onChange={(event) => void saveProject({ ...selected, status: event.target.value as Project["status"] }, "项目状态已更新。") }><option value="active">进行中</option><option value="paused">暂停</option><option value="completed">已完成</option></select><button className="project-more" onClick={() => {setMessage(""); setDeleteOpen(true);}} disabled={saving}>删除</button></div></header>

                  <ProjectMetadataEditor key={`details:${viewer.id}:${selected.id}`} project={selected} saving={saving} error={messageTone === 'error' ? message : ''} onSave={saveProject} onStart={() => setMessage('')}/>

                  <p className="project-summary"><span key={(selected.metadata.tasks ?? []).filter((task) => task.done).length}>{(selected.metadata.tasks ?? []).filter((task) => task.done).length} / {(selected.metadata.tasks ?? []).length} 项任务完成</span><span>{projectProgress(selected)}%</span>{selected.metadata.deadline && <span>截止 {selected.metadata.deadline}</span>}</p>

                  <div className="project-detail-grid">
                    <section className="project-task-card"><header><div><h3>任务清单</h3></div></header><form onSubmit={event => void addTask(event)}><input value={taskText} onChange={(event) => setTaskDrafts(current => ({...current,[selected.id]:event.target.value}))} placeholder="输入下一步要做的事" aria-label="新任务" /><Button type="submit" disabled={saving || !taskText.trim()}>添加</Button></form><MotionNavigation as="div" className="project-task-filter" role="group" label="任务筛选" value={taskFilter}>{([['all',`全部 ${allTasks.length}`],['todo',`待办 ${remainingCount}`],['done',`已完成 ${allTasks.length-remainingCount}`]] as const).map(([value,label])=><button key={value} type="button" aria-pressed={taskFilter===value} onClick={()=>setTaskFilters(current=>({...current,[selected.id]:value}))}>{label}</button>)}</MotionNavigation>
                      <ProjectTaskList key={`tasks:${viewer.id}:${selected.id}`} project={selected} tasks={visibleTasks} emptyMessage={!allTasks.length ? '还没有任务。可以先记录需要查找的论文或待处理的数据。' : taskFilter === 'todo' ? '当前没有待办任务。' : '当前没有已完成任务。'} saving={saving} error={messageTone === 'error' ? message : ''} listRef={taskListRef} onSave={saveProject} onToggle={toggleTask} onStart={() => setMessage('')}/>
                    </section>

                    <ProjectNotes key={`${viewer.id}:${selected.id}`} ownerId={viewer.id} projectId={selected.id} savedNotes={selected.metadata.notes ?? ''} savedUpdatedAt={selected.updated_at} saving={saving} onSave={async notes => {
                      const saved = await saveProject({...selected, metadata: {...selected.metadata, notes}}, '项目笔记已保存。');
                      return saved ? {notes: saved.metadata.notes ?? '', updatedAt: saved.updated_at} : false;
                    }} />
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
