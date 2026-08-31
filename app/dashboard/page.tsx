"use client";

import { BarChart3, FileSearch, FolderKanban } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppSidebar from "../components/app-sidebar";
import { Badge, Button, EmptyState, ErrorState } from "../components/ui";
import { authFetch, signOut as signOutSession } from "../lib/auth-client";

type Viewer = { id: string; email?: string } | null;
type Project = { id: string; title: string; kind?: string; status?: string; updated_at?: string };
type Paper = { id: string; title: string; updatedAt?: number; activeParagraph?: number; paragraphs?: unknown[] };
type LoadState = "loading" | "guest" | "empty" | "ready" | "error";

const moduleCards = [
  { label: "PAPERS", title: "继续精读论文", copy: "双语阅读、AI 拆解与统计审查", href: "/papers", icon: FileSearch, tone: "violet" },
  { label: "DATA", title: "打开数据工作台", copy: "清洗、检验、回归与可视化", href: "/data", icon: BarChart3, tone: "mint" },
  { label: "PROJECTS", title: "推进学习项目", copy: "目标、任务、笔记与研究成果", href: "/projects", icon: FolderKanban, tone: "blue" },
];

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" });

export default function DashboardPage() {
  const [viewer, setViewer] = useState<Viewer>(null);
  const [configured, setConfigured] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const sessionResponse = await authFetch("/api/auth/session");
        const session = await sessionResponse.json() as { user?: Viewer; configured?: boolean };
        if (!active) return;
        setConfigured(Boolean(session.configured));
        setViewer(session.user ?? null);
        if (!session.user) {
          setState("guest");
          return;
        }

        const [projectResponse, paperResponse] = await Promise.all([
          authFetch("/api/projects"),
          authFetch("/api/cloud/papers"),
        ]);
        if (!projectResponse.ok || !paperResponse.ok) throw new Error("WORKSPACE_LOAD_FAILED");
        const projectPayload = await projectResponse.json() as { projects?: Project[] };
        const paperPayload = await paperResponse.json() as { papers?: Paper[] };
        if (!active) return;
        const nextProjects = projectPayload.projects ?? [];
        const nextPapers = paperPayload.papers ?? [];
        setProjects(nextProjects);
        setPapers(nextPapers);
        setState(nextProjects.length || nextPapers.length ? "ready" : "empty");
      } catch {
        if (active) setState("error");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const activity = useMemo(() => [
    ...papers.map((paper) => ({
      id: `paper-${paper.id}`,
      title: paper.title,
      meta: `PaperLab · ${paper.paragraphs?.length ?? 0} 个段落`,
      updatedAt: paper.updatedAt ?? 0,
      type: "PDF",
    })),
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.title,
      meta: `项目空间 · ${statusLabel(project.status)}`,
      updatedAt: project.updated_at ? Date.parse(project.updated_at) : 0,
      type: "项目",
    })),
  ].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 4), [papers, projects]);

  async function signOut() {
    await signOutSession().catch(() => undefined);
    setViewer(null);
    setProjects([]);
    setPapers([]);
    setState("guest");
  }

  const initials = viewer?.email?.slice(0, 2).toUpperCase() ?? "GU";
  const displayName = viewer?.email?.split("@")[0] ?? "同学";

  return <main className="student-app">
    <AppSidebar active="dashboard" initials={initials} profileTitle={displayName} profileSubtitle={viewer ? "云端同步已开启" : "仅保存在当前设备"} />
    <section className="student-main">
      <header className="student-topbar"><div><span suppressHydrationWarning>{dateFormatter.format(new Date())}</span><h1>你好，{displayName}。</h1></div><div>{viewer ? <Button className="account-button" variant="secondary" onClick={() => void signOut()}>{initials}<span>退出</span></Button> : <Link className="dashboard-login" href="/auth">登录同步</Link>}</div></header>

      {state === "loading" && <div className="dashboard-loading" role="status" aria-live="polite">正在载入你的工作台…</div>}
      {state === "error" && <ErrorState description="账户已连接，但项目或论文数据暂时无法读取。" action={<Button variant="secondary" onClick={() => location.reload()}>重新加载</Button>} />}
      {state === "guest" && <GuestDashboard configured={configured} />}
      {state === "empty" && <SignedInEmpty />}
      {state === "ready" && <>
        <section className="dashboard-hero"><div><Badge tone="success">真实账户数据</Badge><h2>{papers[0] ? "继续上次的论文阅读。" : "推进最重要的项目。"}</h2><p>{papers[0]?.title || projects[0]?.title}</p><div><Link href={papers[0] ? "/papers" : "/projects"}>继续工作 <b>→</b></Link></div></div><aside><span>当前工作区</span><strong>{projects.length + papers.length}</strong><p>{projects.length} 个项目 · {papers.length} 篇论文</p></aside></section>
        <WorkspaceCards />
        <section className="dashboard-lower"><article><header><div><span>RECENT ACTIVITY</span><h2>最近更新</h2></div><Link href="/projects">查看项目</Link></header><ul>{activity.map((item) => <li key={item.id}><b className={item.type === "PDF" ? "file-pdf" : "file-course"}>{item.type}</b><p><strong>{item.title}</strong><small>{item.meta}</small></p><em>{item.updatedAt ? shortDateFormatter.format(item.updatedAt) : "未记录"}</em></li>)}</ul></article><aside><span>LEARNING CENTER</span><h2>课程空间</h2><p>导入 TXT、Markdown 或 CSV 课程资料，生成可复核的练习。</p><Link href="/courses">进入课程中心</Link></aside></section>
      </>}
    </section>
  </main>;
}

function GuestDashboard({ configured }: { configured: boolean }) {
  return <>
    <div className="guest-banner"><div><b>匿名体验 · 示例内容</b><p>下面的内容仅用于展示界面，不代表你的学习记录。登录后才会显示账户数据。</p></div><Link href="/auth">{configured ? "登录账户" : "查看账户状态"} →</Link></div>
    <section className="dashboard-hero dashboard-demo"><div><Badge tone="warning">示例数据</Badge><h2>从论文、数据或项目开始。</h2><p>匿名模式下，原始文件与临时内容只保存在当前设备。</p><div><Link href="/papers">体验论文工作台 <b>→</b></Link><Link href="/data">体验数据分析</Link></div></div><aside><span>DEMO</span><strong>3</strong><p>三个可体验的工作区</p></aside></section>
    <WorkspaceCards />
  </>;
}

function SignedInEmpty() {
  return <EmptyState title="工作台还是空的" description="你的账户已经连接。创建第一个项目或导入一篇论文后，真实进度会显示在这里。" action={<div className="dashboard-empty-actions"><Link className="hero-main" href="/projects?new=1">新建项目</Link><Link className="hero-demo" href="/papers">导入论文</Link></div>} />;
}

function WorkspaceCards() {
  return <><div className="dashboard-section-title"><div><span>WORKSPACES</span><h2>选择工作区</h2></div><Link href="/projects?new=1">＋ 新建项目</Link></div><section className="dashboard-modules">{moduleCards.map((module) => {
    const Icon = module.icon;
    return <Link className={module.tone} href={module.href} key={module.label}><div><b><Icon size={20} aria-hidden="true" /></b><span>{module.label}</span><i>↗</i></div><h3>{module.title}</h3><p>{module.copy}</p></Link>;
  })}</section></>;
}

function statusLabel(status?: string) {
  if (status === "completed") return "已完成";
  if (status === "paused") return "已暂停";
  return "进行中";
}
