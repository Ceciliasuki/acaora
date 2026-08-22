"use client";

import AppSidebar from "../components/app-sidebar";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { browserAuthenticatedFetch } from "../lib/browser-auth";

type Viewer = { id: string; email?: string } | null;
type Task = { id: string; text: string; done: boolean };
type ProjectMetadata = {
  goal?: string;
  deadline?: string;
  notes?: string;
  tasks?: Task[];
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
  { value: "course", label: "课程项目", icon: "课" },
  { value: "paper", label: "论文研究", icon: "文" },
  { value: "data", label: "数据分析", icon: "Σ" },
  { value: "writing", label: "学术写作", icon: "写" },
  { value: "group", label: "团队协作", icon: "组" },
  { value: "career", label: "成长规划", icon: "成" },
];

const statusLabels = { active: "进行中", paused: "已暂停", completed: "已完成" };
const dueSoonReferenceTime = Date.now();

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
  const [taskText, setTaskText] = useState("");

  const selected = projects.find((project) => project.id === selectedId) ?? null;
  const activeCount = projects.filter((project) => project.status === "active").length;
  const completedTasks = projects.reduce((total, project) => total + (project.metadata.tasks ?? []).filter((task) => task.done).length, 0);
  const dueSoon = projects.filter((project) => {
    if (!project.metadata.deadline || project.status === "completed") return false;
    const distance = new Date(project.metadata.deadline).getTime() - dueSoonReferenceTime;
    return distance >= 0 && distance <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  useEffect(() => {
    void browserAuthenticatedFetch("/api/auth/session")
      .then((response) => response.json())
      .then(async (payload: { user?: Viewer }) => {
        const user = payload.user ?? null;
        setViewer(user);
        if (!user) return;
        const response = await browserAuthenticatedFetch("/api/projects");
        const data = await response.json() as { projects?: Project[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "项目读取失败。");
        const nextProjects = data.projects ?? [];
        setProjects(nextProjects);
        setSelectedId(nextProjects[0]?.id ?? "");
        if (new URLSearchParams(window.location.search).get("new") === "1" || !nextProjects.length) setShowCreate(true);
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "项目读取失败。"))
      .finally(() => setLoaded(true));
  }, []);

  const weeklyPlan = useMemo(() => projects.flatMap((project) => (project.metadata.tasks ?? [])
    .filter((task) => !task.done)
    .slice(0, 2)
    .map((task) => ({ ...task, projectTitle: project.title }))).slice(0, 4), [projects]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");
    try {
      const response = await browserAuthenticatedFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.get("title"),
          kind: form.get("kind"),
          status: "active",
          metadata: { goal: form.get("goal"), deadline: form.get("deadline"), notes: "", tasks: [] },
        }),
      });
      const payload = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !payload.project) throw new Error(payload.error ?? "创建项目失败。");
      setProjects((current) => [payload.project!, ...current]);
      setSelectedId(payload.project.id);
      setShowCreate(false);
      setMessage("项目已创建，可以开始拆解任务了。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建项目失败。");
    } finally {
      setSaving(false);
    }
  }

  async function saveProject(next: Project, successMessage = "项目已保存。") {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/projects?id=${encodeURIComponent(next.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const payload = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !payload.project) throw new Error(payload.error ?? "项目保存失败。");
      setProjects((current) => current.map((project) => project.id === next.id ? payload.project! : project));
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "项目保存失败。");
    } finally {
      setSaving(false);
    }
  }

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!selected || !taskText.trim()) return;
    const task: Task = { id: crypto.randomUUID(), text: taskText.trim(), done: false };
    setTaskText("");
    void saveProject({ ...selected, metadata: { ...selected.metadata, tasks: [...(selected.metadata.tasks ?? []), task] } }, "新任务已加入项目。" );
  }

  function toggleTask(taskId: string) {
    if (!selected) return;
    const tasks = (selected.metadata.tasks ?? []).map((task) => task.id === taskId ? { ...task, done: !task.done } : task);
    void saveProject({ ...selected, metadata: { ...selected.metadata, tasks } }, "任务进度已更新。" );
  }

  async function deleteProject() {
    if (!selected || !window.confirm(`确定删除“${selected.title}”吗？此操作无法撤销。`)) return;
    setSaving(true);
    const response = await fetch(`/api/projects?id=${encodeURIComponent(selected.id)}`, { method: "DELETE" });
    const payload = await response.json() as { error?: string };
    if (!response.ok) {
      setMessage(payload.error ?? "删除项目失败。");
      setSaving(false);
      return;
    }
    const remaining = projects.filter((project) => project.id !== selected.id);
    setProjects(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    setSaving(false);
    setMessage("项目已删除。");
  }

  const initials = viewer?.email?.slice(0, 2).toUpperCase() ?? "GU";

  return (
    <main className="student-app project-app">
      <AppSidebar active="projects" initials={initials} profileTitle={viewer?.email?.split("@")[0] ?? "匿名学习者"} profileSubtitle={viewer ? "项目已进行用户隔离" : "登录后开启项目云端记忆"} />

      <section className="student-main project-main">
        <header className="student-topbar project-topbar"><div><span>项目管理</span><h1>项目工作台</h1><p>集中管理目标、论文、数据和行动。</p></div><button className="project-create-button" disabled={!viewer} onClick={() => setShowCreate(true)}>＋ 新建项目</button></header>

        {message && <div className="project-message" role="status">{message}</div>}

        {!loaded ? <section className="project-loading"><i /><p>正在整理你的项目空间…</p></section> : !viewer ? (
          <section className="project-login-wall"><span>PERSONAL WORKSPACE</span><h2>登录后，项目才真正属于你。</h2><p>每个项目都只对当前账户可见，并在设备之间同步目标、任务与笔记。</p><a href="/auth">注册或密码登录 <b>→</b></a></section>
        ) : (
          <>
            <section className="project-metrics">
              <article><span>ACTIVE PROJECTS</span><strong>{activeCount}</strong><small>个进行中的项目</small></article>
              <article><span>COMPLETED TASKS</span><strong>{completedTasks}</strong><small>项行动已经完成</small></article>
              <article className={dueSoon ? "attention" : ""}><span>NEXT 7 DAYS</span><strong>{dueSoon}</strong><small>个项目即将到期</small></article>
              <article><span>RESEARCH MEMORY</span><strong>{projects.length}</strong><small>个持续积累的空间</small></article>
            </section>

            {!projects.length ? <section className="project-empty"><b>◇</b><span>START WITH A REAL GOAL</span><h2>创建你的第一个项目</h2><p>可以是一篇课程论文、一次数据分析、一项竞赛，或任何需要持续推进的目标。</p><button onClick={() => setShowCreate(true)}>建立项目空间 →</button></section> : (
              <section className="project-workbench">
                <aside className="project-library">
                  <header><div><span>MY PROJECTS</span><h2>进行中的空间</h2></div><button onClick={() => setShowCreate(true)} aria-label="新建项目">＋</button></header>
                  <div className="project-filter"><button className="active">全部 {projects.length}</button><button>进行中 {activeCount}</button></div>
                  <div className="project-list">{projects.map((project) => {
                    const kind = kindInfo(project.kind);
                    const progress = projectProgress(project);
                    return <button className={project.id === selectedId ? "active" : ""} key={project.id} onClick={() => setSelectedId(project.id)}><b>{kind.icon}</b><div><span>{kind.label} · {statusLabels[project.status]}</span><strong>{project.title}</strong><i><em style={{ width: `${progress}%` }} /></i><small>{progress}% · {(project.metadata.tasks ?? []).length} 项任务</small></div></button>;
                  })}</div>
                  <section className="weekly-plan"><span>THIS WEEK</span><h3>下一步行动</h3>{weeklyPlan.length ? weeklyPlan.map((task) => <p key={task.id}><i /> <b>{task.text}</b><small>{task.projectTitle}</small></p>) : <p className="weekly-empty">暂无待办任务，给项目添加一个明确的下一步。</p>}</section>
                </aside>

                {selected && <article className="project-detail">
                  <header className="project-detail-head"><div><span>{kindInfo(selected.kind).label.toUpperCase()} · {statusLabels[selected.status]}</span><h2>{selected.title}</h2><p>{selected.metadata.goal || "还没有填写项目目标。"}</p></div><div><select aria-label="项目状态" value={selected.status} onChange={(event) => void saveProject({ ...selected, status: event.target.value as Project["status"] }, "项目状态已更新。") }><option value="active">进行中</option><option value="paused">暂停</option><option value="completed">已完成</option></select><button className="project-more" onClick={() => void deleteProject()} disabled={saving}>删除</button></div></header>

                  <section className="project-progress-card"><div><span>OVERALL PROGRESS</span><strong>{projectProgress(selected)}<small>%</small></strong></div><i><b style={{ width: `${projectProgress(selected)}%` }} /></i><p><span>{(selected.metadata.tasks ?? []).filter((task) => task.done).length} 项完成</span><span>{selected.metadata.deadline ? `截止 ${selected.metadata.deadline}` : "未设置截止日期"}</span></p></section>

                  <div className="project-detail-grid">
                    <section className="project-task-card"><header><div><span>NEXT ACTIONS</span><h3>任务清单</h3></div><small>完成一项，就推进一步</small></header><form onSubmit={addTask}><input value={taskText} onChange={(event) => setTaskText(event.target.value)} placeholder="输入一个明确、可执行的任务" aria-label="新任务" /><button disabled={saving || !taskText.trim()}>添加</button></form><div className="project-tasks">{(selected.metadata.tasks ?? []).length ? (selected.metadata.tasks ?? []).map((task) => <label className={task.done ? "done" : ""} key={task.id}><input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} /><span>{task.text}</span></label>) : <p>暂无任务。建议从“查找 3 篇核心论文”或“完成数据质量检查”开始。</p>}</div></section>

                    <section className="project-note-card"><header><span>PROJECT NOTES</span><h3>项目笔记</h3></header><textarea key={`${selected.id}-${selected.updated_at}`} defaultValue={selected.metadata.notes ?? ""} placeholder="记录研究思路、导师反馈、关键结论或下一次要解决的问题…" id="project-notes" /><button disabled={saving} onClick={() => { const notes = (document.getElementById("project-notes") as HTMLTextAreaElement | null)?.value ?? ""; void saveProject({ ...selected, metadata: { ...selected.metadata, notes } }, "项目笔记已保存。") }}>{saving ? "保存中…" : "保存笔记"}</button></section>
                  </div>

                  <section className="project-resource-card"><header><div><span>CONNECTED TOOLS</span><h3>从项目继续工作</h3></div><p>工具产生的成果，下一版将可以直接挂载到当前项目。</p></header><div><a href="/papers"><b>文</b><span><strong>PaperLab</strong><small>检索、精读并分析相关论文</small></span><i>→</i></a><a href="/data"><b>Σ</b><span><strong>DataLab</strong><small>上传数据并完成统计分析</small></span><i>→</i></a></div></section>
                </article>}
              </section>
            )}
          </>
        )}
      </section>

      {showCreate && viewer && <div className="project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title"><button className="project-modal-backdrop" onClick={() => setShowCreate(false)} aria-label="关闭新建项目窗口" /><form onSubmit={createProject}><header><div><span>NEW WORKSPACE</span><h2 id="create-project-title">建立一个项目空间</h2><p>先定义目标，后续再逐步加入论文、数据和任务。</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="关闭">×</button></header><label>项目名称<input name="title" required maxLength={120} placeholder="例如：大学生睡眠与学习成绩研究" /></label><label>项目类型<select name="kind" defaultValue="paper">{kindOptions.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}</select></label><label>希望完成什么？<textarea name="goal" rows={3} placeholder="用一句话描述你想得到的最终成果" /></label><label>计划截止日期<input name="deadline" type="date" /></label><footer><button type="button" onClick={() => setShowCreate(false)}>取消</button><button className="primary" disabled={saving}>{saving ? "正在创建…" : "创建项目空间"}</button></footer></form></div>}
    </main>
  );
}

