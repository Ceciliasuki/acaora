"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, BookOpen, ChevronRight, FileText, Folder, Plus, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AppSidebar from "../components/app-sidebar";
import LightCurtain from "../components/light-curtain";
import { Button } from "../components/ui";
import { authFetch, signOut as signOutSession } from "../lib/auth-client";

type Viewer = { id: string; email?: string } | null;
type Project = { id: string; title: string; status?: string; updated_at?: string };
type Paper = { id: string; title: string; updatedAt?: number; paragraphs?: unknown[] };
type LoadState = "loading" | "guest" | "empty" | "ready" | "error";
type Activity = { id: string; title: string; detail: string; updatedAt: number; href: "/papers" | "/projects" };

const workspaces = [
  { href: "/courses", name: "课程中心", detail: "资料整理与复习练习", icon: BookOpen },
  { href: "/papers", name: "论文研究", detail: "双语阅读与段落笔记", icon: FileText },
  { href: "/data", name: "数据分析", detail: "描述统计、检验与回归", icon: BarChart3 },
  { href: "/projects", name: "项目空间", detail: "目标、任务与研究资料", icon: Folder },
] as const;
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
function stamp(time: number) { return time > 0 && Number.isFinite(time) ? dateFormatter.format(time) : "未记录日期"; }
function statusLabel(status?: string) { return status === "completed" ? "已完成" : status === "paused" ? "已暂停" : "进行中"; }

export default function DashboardPage() {
  const [viewer, setViewer] = useState<Viewer>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await authFetch("/api/auth/session");
        if (!response.ok) throw new Error("SESSION_LOAD_FAILED");
        const session = await response.json() as { user?: Viewer };
        if (!active) return;
        setViewer(session.user ?? null);
        if (!session.user) { setState("guest"); return; }
        const [projectResponse, paperResponse] = await Promise.all([authFetch("/api/projects"), authFetch("/api/cloud/papers")]);
        if (!projectResponse.ok || !paperResponse.ok) throw new Error("WORKSPACE_LOAD_FAILED");
        const projectPayload = await projectResponse.json() as { projects?: Project[] };
        const paperPayload = await paperResponse.json() as { papers?: Paper[] };
        if (!active) return;
        const nextProjects = projectPayload.projects ?? [];
        const nextPapers = paperPayload.papers ?? [];
        setProjects(nextProjects); setPapers(nextPapers);
        setState(nextProjects.length || nextPapers.length ? "ready" : "empty");
      } catch { if (active) setState("error"); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const activity = useMemo<Activity[]>(() => [
    ...papers.map((paper) => ({ id: `paper-${paper.id}`, title: paper.title, detail: `${paper.paragraphs?.length ?? 0} 个段落`, updatedAt: paper.updatedAt ?? 0, href: "/papers" as const })),
    ...projects.map((project) => ({ id: `project-${project.id}`, title: project.title, detail: statusLabel(project.status), updatedAt: project.updated_at ? Date.parse(project.updated_at) : 0, href: "/projects" as const })),
  ].sort((a, b) => (Number.isFinite(b.updatedAt) ? b.updatedAt : 0) - (Number.isFinite(a.updatedAt) ? a.updatedAt : 0)).slice(0, 4), [papers, projects]);
  const [lead, ...rest] = activity;
  const displayName = viewer?.email?.split("@")[0] ?? "同学";
  const counted = state === "ready" || state === "empty";
  const absence = {
    guest: { title: "先从一篇论文开始", detail: "可以先在本机阅读和标注论文。登录后，再同步阅读记录和项目。" },
    empty: { title: "工作台还是空的", detail: "导入一篇论文，或新建项目来整理目标与任务。" },
    error: { title: "暂时无法读取记录", detail: "账户记录加载失败，请重试。" },
    ready: { title: "最近更新", detail: "" },
    loading: { title: "正在读取记录", detail: "" },
  }[state];

  async function signOut() {
    await signOutSession().catch(() => undefined);
    setViewer(null); setProjects([]); setPapers([]); setState("guest");
  }

  return <main className="student-app">
    <AppSidebar active="dashboard" initials={viewer?.email?.slice(0, 2).toUpperCase() ?? "GU"} profileTitle={displayName} profileSubtitle={viewer ? "云端同步已开启" : "仅保存在当前设备"} />
    <section className="student-main overview-main">
      <header className="overview-header">
        <h1>{viewer ? `你好，${displayName}。` : "总览"}</h1>
        <div className="overview-toolbar">
          <Link className="ui-button ui-button--secondary" href="/papers"><Upload size={17} aria-hidden="true" />导入论文</Link>
          <Link className="ui-button ui-button--primary" href="/projects?new=1"><Plus size={18} aria-hidden="true" />新建项目</Link>
        </div>
      </header>
      <h2 className="overview-section-title">最近更新</h2>
      {state === "loading" ? <div className="dashboard-loading" role="status" aria-label="正在读取工作台记录" /> : <div className="overview-grid">
        <article className="overview-feature">
          <LightCurtain inset />
          <span className="overview-kind">{lead ? lead.href === "/papers" ? "论文" : "项目" : state === "guest" ? "本机阅读" : state === "error" ? "加载失败" : "开始使用"}</span>
          <h3>{lead?.title ?? absence.title}</h3>
          <p>{lead ? `${lead.detail} · 更新于 ${stamp(lead.updatedAt)}` : absence.detail}</p>
          {lead ? <Link className="ui-button ui-button--primary" href={lead.href}>进入{lead.href === "/papers" ? "论文研究" : "项目空间"}<ArrowRight size={18} aria-hidden="true" /></Link>
            : state === "error" ? <Button onClick={() => location.reload()}>重新加载</Button>
              : <Link className="ui-button ui-button--primary" href="/papers">进入论文研究<ArrowRight size={18} aria-hidden="true" /></Link>}
        </article>
        <div className="overview-recent" aria-label="其他最近记录">
          {rest.length ? rest.map((item) => <Link className="overview-record" href={item.href} key={item.id}>
            {item.href === "/papers" ? <FileText size={25} aria-hidden="true" /> : <Folder size={25} aria-hidden="true" />}
            <div><small>{item.href === "/papers" ? "论文" : "项目"} · {stamp(item.updatedAt)}</small><strong>{item.title}</strong></div>
            <ChevronRight size={17} aria-hidden="true" />
          </Link>) : <div className="overview-recent-empty"><strong>{lead ? "没有其他最近记录" : "记录会出现在这里"}</strong><p>{state === "error" ? "读取成功后可查看最近更新。" : "保存的论文与项目按更新时间排列。"}</p></div>}
        </div>
      </div>}
      <h2 className="overview-section-title">工作区</h2>
      <div className="overview-shortcuts">{workspaces.map(({ href, name, detail, icon: Icon }) => <Link href={href} className="overview-shortcut" key={href}>
        <Icon size={23} aria-hidden="true" /><strong>{name}</strong><small>{detail}</small>
      </Link>)}</div>
      <footer className="overview-footer">
        <p>{viewer ? `${counted ? `${papers.length} 篇论文 · ${projects.length} 个项目 · ` : ""}${viewer.email ?? "已登录"}` : "匿名论文记录保存在当前设备"}</p>
        {viewer ? <Button variant="ghost" size="sm" onClick={() => void signOut()}>退出</Button> : <Link className="ui-button ui-button--secondary" href="/auth">登录同步</Link>}
      </footer>
    </section>
  </main>;
}
