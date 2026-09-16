"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  FileSearch,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";
import AppSidebar from "../components/app-sidebar";
import { Badge, Button, ErrorState } from "../components/ui";
import { authFetch, signOut as signOutSession } from "../lib/auth-client";

type Viewer = { id: string; email?: string } | null;
type Project = { id: string; title: string; kind?: string; status?: string; updated_at?: string };
type Paper = { id: string; title: string; updatedAt?: number; activeParagraph?: number; paragraphs?: unknown[] };
type LoadState = "loading" | "guest" | "empty" | "ready" | "error";

type ActivityItem = {
  id: string;
  title: string;
  /* A real derived value only: the paper's own paragraph count. Projects carry
     no equivalent number, so that cell stays empty rather than showing a zero. */
  paragraphs?: number;
  updatedAt: number;
  /* Project state as it is already stored; the tone only picks between badges
     the system already ships. Papers have no status concept. */
  status?: { label: string; tone: "info" | "success" | "warning" };
  href: "/papers" | "/projects";
};

/* The four real areas, in navigation order. The icon is the same Lucide mark the
   rail uses, so a row here is recognisably the place it names. */
const workspaces = [
  { id: "courses", name: "课程中心", icon: BookOpen, fact: "本地导入材料", meta: "TXT · Markdown · CSV" },
  { id: "papers", name: "论文研究", icon: FileSearch, fact: "原文不上传", meta: "双语阅读 · 段落导引" },
  { id: "data", name: "数据分析", icon: BarChart3, fact: "导入 CSV / XLSX", meta: "描述统计 · 检验 · 回归" },
  { id: "projects", name: "项目空间", icon: FolderKanban, fact: "状态 · 任务 · 笔记", meta: "目标 · 截止 · 资料" },
] as const;

/* Only these two areas carry records, so this mapping is exhaustive rather than
   carrying a fallback branch that could never be reached. */
const recordAreas: Record<ActivityItem["href"], { name: string; icon: LucideIcon }> = {
  "/papers": { name: "论文研究", icon: FileSearch },
  "/projects": { name: "项目空间", icon: FolderKanban },
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const recordDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default function DashboardPage() {
  const [viewer, setViewer] = useState<Viewer>(null);
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

  const activity = useMemo<ActivityItem[]>(() => [
    ...papers.map((paper) => ({
      id: `paper-${paper.id}`,
      title: paper.title,
      paragraphs: paper.paragraphs?.length ?? 0,
      updatedAt: paper.updatedAt ?? 0,
      href: "/papers" as const,
    })),
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.title,
      updatedAt: project.updated_at ? Date.parse(project.updated_at) : 0,
      status: projectState(project.status),
      href: "/projects" as const,
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
  const signedIn = Boolean(viewer);
  /* The lead entry is the first record of the same list, so it is rendered once
     as the work in hand and the remainder as the log. Nothing appears twice. */
  const [lead, ...rest] = activity;

  /* Every cell is a real value or an honest absence. Courses and datasets have no
     count concept anywhere in the product, so those cells report a fact instead of
     a number, and an unfetched list shows an empty value rather than a zero. */
  const register = [
    { label: "论文", value: signedIn ? String(papers.length) : "—", note: signedIn ? newestNote(papers.map((paper) => paper.updatedAt ?? 0)) : "", numeric: true },
    { label: "项目", value: signedIn ? String(projects.length) : "—", note: signedIn ? newestNote(projects.map((project) => (project.updated_at ? Date.parse(project.updated_at) : 0))) : "", numeric: true },
    { label: "课程", value: "本地导入", note: "TXT / MD / CSV", numeric: false },
    { label: "数据集", value: "本地导入", note: "CSV / XLSX", numeric: false },
    { label: "账号", value: viewer ? "云端同步已开启" : "未登录", note: viewer?.email ?? "匿名记录仅保存在本机", numeric: false },
  ];

  return <main className="student-app">
    <AppSidebar active="dashboard" initials={initials} profileTitle={displayName} profileSubtitle={viewer ? "云端同步已开启" : "仅保存在当前设备"} />
    <section className="student-main dashboard-shell">
      <div className="dashboard-page">
        {/* A control band rather than a masthead: the page opens on the facts. */}
        <div className="page-bar">
          <div className="page-bar-inner">
            <h1>你好，{displayName}。</h1>
            <span className="page-bar-spacer" />
            <span className="page-bar-date dashboard-tabular" suppressHydrationWarning>{dateFormatter.format(new Date())}</span>
            {viewer
              ? <Button className="account-button" variant="ghost" onClick={() => void signOut()}>退出</Button>
              : <Link className="dashboard-login" href="/auth">登录同步</Link>}
          </div>
        </div>

        {state === "loading" && <DashboardSkeleton />}
        {state === "error" && <ErrorState description="账户已连接，但项目或论文数据暂时无法读取。" action={<Button variant="secondary" onClick={() => location.reload()}>重新加载</Button>} />}

        {(state === "guest" || state === "empty" || state === "ready") && <>
          <div className="page-body">
            <div className="metric-register">
              {register.map((cell) => <div className="metric-register-cell" key={cell.label}>
                <b>{cell.label}</b>
                <strong className={cell.numeric ? "dashboard-tabular" : "metric-register-value--text"}>{cell.value}</strong>
                {cell.note ? <small>{cell.note}</small> : null}
              </div>)}
            </div>

            <div className={rest.length > 0 ? "ruled-split" : "ruled-split ruled-split--single"}>
              <div className="ruled-main">
                {rest.length > 0 && <>
                  <h2 className="ruled-heading">最近记录<span>按更新时间</span></h2>
                  <div className="ruled-table-wrap">
                    <table className="ruled-table">
                      <thead><tr>
                        <th scope="col">日期</th>
                        <th scope="col" className="ruled-col--area">区域</th>
                        <th scope="col">标题</th>
                        <th scope="col" className="ruled-col--num">段落</th>
                        <th scope="col">状态</th>
                      </tr></thead>
                      <tbody>
                        {rest.map((item) => <tr key={item.id}>
                          <td className="dashboard-tabular">{item.updatedAt ? recordDateFormatter.format(item.updatedAt) : "未记录"}</td>
                          <td className="ruled-col--area"><AreaLabel href={item.href} /></td>
                          <td className="ruled-title">{item.title}</td>
                          <td className="ruled-col--num dashboard-tabular">{item.paragraphs ?? "—"}</td>
                          <td>{item.status
                            ? <Badge tone={item.status.tone}>{item.status.label}</Badge>
                            : <span className="ruled-kind">论文</span>}</td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                  <p className="ruled-note">计数只有两处是真实数组长度：论文与项目。课程与数据集没有计数概念，所以登记条里报的是「本地导入」而不是数字。</p>
                </>}

                {rest.length === 0 && <div className="state-note">
                  {state === "empty" && <>
                    <h2 className="state-note-title">工作台还是空的</h2>
                    <p className="state-note-copy">你的账户已经连接。创建第一个项目或导入一篇论文后，真实记录会出现在这里。</p>
                    <div className="state-note-actions">
                      <Link className="ui-button ui-button--primary" href="/projects?new=1">新建项目</Link>
                      <Link className="ui-button ui-button--secondary" href="/papers">导入论文</Link>
                    </div>
                  </>}
                  {state === "guest" && <>
                    <h2 className="state-note-title">匿名体验 · 未登录</h2>
                    <p className="state-note-copy">四个工作区都可以直接使用，入口在主导航里。登录后才会显示你的论文、项目与学习记录。</p>
                  </>}
                </div>}
              </div>

              {lead && <aside className="current-work">
                <h2 className="ruled-heading">正在进行</h2>
                <div className="current-work-head">
                  <span className="current-work-mark">{(() => { const Icon = recordAreas[lead.href].icon; return <Icon size={18} strokeWidth={1.9} aria-hidden="true" />; })()}</span>
                  <span className="current-work-title">{lead.title}</span>
                </div>
                <div className="current-work-meta">
                  <span>{recordAreas[lead.href].name}</span>
                  {lead.status && <Badge tone={lead.status.tone}>{lead.status.label}</Badge>}
                  {lead.paragraphs !== undefined && <span>{lead.paragraphs} 个段落</span>}
                  {lead.updatedAt ? <span className="dashboard-tabular">{recordDateFormatter.format(lead.updatedAt)}</span> : null}
                </div>
                <Link className="ui-button ui-button--primary current-work-action" href={lead.href}>
                  进入{recordAreas[lead.href].name}
                  <ArrowRight size={16} strokeWidth={1.9} aria-hidden="true" />
                </Link>
              </aside>}
            </div>

            {/* The four areas as one ruled strip. Two of them report their real
                count; the other two report what they take in, because they have
                no count to report. */}
            <h2 className="ruled-heading ruled-heading--section">四个工作区<span>各有各的密度，共用同一套语言</span></h2>
            <div className="area-strip">
              {workspaces.map((workspace) => {
                const count = workspace.id === "papers"
                  ? (signedIn ? papers.length : null)
                  : workspace.id === "projects"
                    ? (signedIn ? projects.length : null)
                    : null;
                const Icon = workspace.icon;
                return <div className="area-strip-cell" key={workspace.id}>
                  <span className="area-strip-head"><Icon size={16} strokeWidth={1.9} aria-hidden="true" />{workspace.name}</span>
                  <strong className={count === null ? undefined : "dashboard-tabular"}>
                    {count === null ? workspace.fact : `${count} ${workspace.id === "papers" ? "篇" : "个项目"}`}
                  </strong>
                  <small>{workspace.meta}</small>
                </div>;
              })}
            </div>
          </div>
        </>}
      </div>

      {/* The instrument's own device: a bezel of real product facts, which is what
          a dense surface uses where an airy one would simply leave space. */}
      <div className="status-bezel">
        <div className="status-bezel-inner">
          <span>本地优先</span>
          <span>原文不上传</span>
          <span>{viewer ? "云端同步已开启" : "仅保存在当前设备"}</span>
          <span className="status-bezel-account">{viewer?.email ?? "未登录 · 匿名模式"}</span>
        </div>
      </div>
    </section>
  </main>;
}

/* The newest real timestamp in a collection, or nothing when there is none. */
function newestNote(times: number[]) {
  const newest = times.filter((time) => time > 0).sort((left, right) => right - left)[0];
  return newest ? `最近更新 ${recordDateFormatter.format(newest)}` : "尚无记录";
}

/* Where a record lives: the rail's own mark plus its name. */
function AreaLabel({ href }: { href: ActivityItem["href"] }) {
  const { icon: Icon, name } = recordAreas[href];
  return <span className="ruled-area"><Icon size={16} strokeWidth={1.9} aria-hidden="true" />{name}</span>;
}

/* Static placeholder in the same geometry, so nothing shifts when data lands.
   A skeleton rather than a spinner: the layout is the progress signal. */
function DashboardSkeleton() {
  return <div className="dashboard-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">正在载入你的工作台…</span>
    <div className="page-body" aria-hidden="true">
      <div className="metric-register">
        {["论文", "项目", "课程", "数据集", "账号"].map((label) => <div className="metric-register-cell" key={label}>
          <b>{label}</b>
          <span className="skeleton-bar skeleton-bar--value" />
          <span className="skeleton-bar skeleton-bar--note" />
        </div>)}
      </div>
      <div className="ruled-split">
        <div className="ruled-main">
          <span className="skeleton-bar skeleton-bar--heading" />
          {[0, 1, 2, 3].map((row) => <span className="skeleton-bar" key={row} />)}
        </div>
        <div className="current-work">
          <span className="skeleton-bar skeleton-bar--heading" />
          <span className="skeleton-bar" />
          <span className="skeleton-bar skeleton-bar--action" />
        </div>
      </div>
      <div className="area-strip">
        {["课程中心", "论文研究", "数据分析", "项目空间"].map((name) => <div className="area-strip-cell" key={name}>
          <span className="area-strip-head">{name}</span>
          <span className="skeleton-bar" />
        </div>)}
      </div>
    </div>
  </div>;
}

function projectState(status?: string): { label: string; tone: "info" | "success" | "warning" } {
  if (status === "completed") return { label: "已完成", tone: "success" };
  if (status === "paused") return { label: "已暂停", tone: "warning" };
  return { label: "进行中", tone: "info" };
}
