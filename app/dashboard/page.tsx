"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppSidebar from "../components/app-sidebar";
import { Button } from "../components/ui";
import { authChangeEvent,authFetch, getCurrentUser, signOut as signOutSession } from "../lib/auth-client";
import styles from "./overview.module.css";

type Viewer = { id: string; email?: string } | null;
type Project = { id: string; title: string; status?: string; updated_at?: string };
type Paper = { id: string; title: string; updatedAt?: number; paragraphs?: unknown[] };
type LoadState = "loading" | "guest" | "empty" | "ready" | "error";
type Activity = { id: string; title: string; detail: string; updatedAt: number; href: string; kind: '论文' | '项目' };

const workspaces = [
  { href: "/courses", title: "课程中心" },
  { href: "/papers", title: "论文研究" },
  { href: "/data", title: "数据分析" },
  { href: "/projects", title: "项目空间" },
] as const;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
function stamp(time: number) { return time > 0 && Number.isFinite(time) ? dateFormatter.format(time) : "未记录日期"; }
function statusLabel(status?: string) { return status === "completed" ? "已完成" : status === "paused" ? "已暂停" : "进行中"; }

export default function DashboardPage() {
  const [viewer, setViewer] = useState<Viewer>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [logoutError,setLogoutError]=useState(''),[signingOut,setSigningOut]=useState(false);

  useEffect(() => {
    let active = true;
    let generation=0;
    async function load() {
      const token=++generation;
      setViewer(null);setProjects([]);setPapers([]);setState('loading');setLogoutError('');
      try {
        const user = await getCurrentUser();
        if (!active||token!==generation) return;
        setViewer(user);
        if (!user) { setState("guest"); return; }
        const [projectResponse, paperResponse] = await Promise.all([authFetch("/api/projects"), authFetch("/api/cloud/papers")]);
        if (!projectResponse.ok || !paperResponse.ok) throw new Error("WORKSPACE_LOAD_FAILED");
        const projectPayload = await projectResponse.json() as { projects?: Project[] };
        const paperPayload = await paperResponse.json() as { papers?: Paper[] };
        if (!active||token!==generation) return;
        const nextProjects = projectPayload.projects ?? [];
        const nextPapers = paperPayload.papers ?? [];
        setProjects(nextProjects); setPapers(nextPapers);
        setState(nextProjects.length || nextPapers.length ? "ready" : "empty");
      } catch { if (active&&token===generation) setState("error"); }
    }
    const changed=()=>{void load();};
    void load();
    window.addEventListener(authChangeEvent,changed);
    return () => { active = false;generation++;window.removeEventListener(authChangeEvent,changed); };
  }, []);

  const activity = useMemo<Activity[]>(() => [
    ...papers.map((paper) => ({ id: `paper-${paper.id}`, title: paper.title, detail: `${paper.paragraphs?.length ?? 0} 个段落`, updatedAt: paper.updatedAt ?? 0, kind: '论文' as const, href: `/papers?${new URLSearchParams({view: 'reader', paper: paper.id})}` })),
    ...projects.map((project) => ({ id: `project-${project.id}`, title: project.title, detail: statusLabel(project.status), updatedAt: project.updated_at ? Date.parse(project.updated_at) : 0, kind: '项目' as const, href: `/projects?${new URLSearchParams({project: project.id})}` })),
  ].sort((a, b) => (Number.isFinite(b.updatedAt) ? b.updatedAt : 0) - (Number.isFinite(a.updatedAt) ? a.updatedAt : 0)).slice(0, 4), [papers, projects]);
  const displayName = viewer?.email?.split("@")[0] ?? "同学";
  const counted = state === "ready" || state === "empty";
  const absence = {
    guest: { title: "从当前任务开始", detail: "登录后，可在这里查看论文与项目的最近记录。" },
    empty: { title: "还没有论文或项目记录", detail: "可以先学习课程、分析数据，也可以导入论文或创建项目。" },
    error: { title: "暂时无法读取记录", detail: "账户记录加载失败，请重试。" },
    ready: { title: "最近更新", detail: "" },
    loading: { title: "正在读取记录", detail: "" },
  }[state];

  async function signOut() {
    if(signingOut)return;setSigningOut(true);setLogoutError('');
    try{await signOutSession();}catch(cause){setLogoutError(cause instanceof Error?cause.message:'退出未完成，请稍后重试。');}finally{setSigningOut(false);}
  }

  return <main className="student-app">
    <AppSidebar active="dashboard" initials={viewer?.email?.slice(0, 2).toUpperCase() ?? "GU"} profileTitle={displayName} profileSubtitle={viewer ? "总览" : "未登录"} />
    <section className={`student-main overview-main ${styles.page}`}>
      <header className={styles.header}>
        <h1>总览</h1>
      </header>
      <div className={styles.content}>
        <nav className={styles.workspaces} aria-label="工作空间">
          <h2 className={styles.sectionTitle}>工作空间</h2>
          <div className={styles.directory}>
            {workspaces.map((workspace) => <Link className={styles.workspace} href={workspace.href} key={workspace.href} aria-labelledby={`workspace-${workspace.href.slice(1)}`}>
              <h3 id={`workspace-${workspace.href.slice(1)}`}>{workspace.title}</h3>
              <ArrowRight size={22} strokeWidth={1.5} aria-hidden="true" />
            </Link>)}
          </div>
        </nav>
      <section className={styles.recent} aria-labelledby="recent-heading">
        <h2 id="recent-heading" className={styles.sectionTitle}>最近更新</h2>
        {state === "loading" ? <div className={`dashboard-loading ${styles.loading}`} role="status" aria-label="正在读取工作台记录" /> : activity.length > 0 ? <div className={styles.records}>
          {activity.map((item) => <Link className={`overview-record ${styles.record}`} href={item.href} key={item.id}>
            <strong>{item.title}</strong>
            <small><span>{item.kind} · {item.detail}</span><span>{stamp(item.updatedAt)}</span></small>
          </Link>)}
          <p className={styles.scope}>显示论文与项目的最近记录。</p>
        </div> : <div className={styles.empty}>
          <h3>{absence.title}</h3>
          <p>{absence.detail}</p>
          {state === "error" && <Button onClick={() => location.reload()}>重新加载</Button>}
        </div>}
      </section>
      </div>
      <footer className={`overview-footer ${styles.footer}`}>
        <p>{viewer ? `${counted ? `${papers.length} 篇论文 · ${projects.length} 个项目 · ` : ""}${viewer.email ?? "已登录"}` : state==='guest'?"未登录":state==='loading'?'正在确认账户…':'账户状态暂不可用'}</p>
        {logoutError&&<p role="alert">{logoutError}</p>}
        {viewer ? <Button variant="ghost" size="sm" loading={signingOut} onClick={() => void signOut()}>退出</Button> : state==='guest'?<Link className="ui-button ui-button--secondary" href="/auth">登录同步</Link>:null}
      </footer>
    </section>
  </main>;
}
