"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppSidebar from "../components/app-sidebar";
import { Button } from "../components/ui";
import { authFetch, signOut as signOutSession } from "../lib/auth-client";

/* ============================================================================
   ACAORA - Scholarly Journal Workspace (Dashboard).

   The page is composed as one editorial spread rather than as a stack of UI
   modules: a running head, a masthead, then one primary study block with the
   publication object in the outer margin, a closing rule, and two lower
   registers (index + contents) divided by a column rule. Nothing here is a card,
   a KPI cell, or a widget; the only bounded surface is the paper object itself.

   Typography carries the hierarchy (24 / 30 / 18 / 15 / 13 / 12, weights 400-600)
   and the structure is numbered the way a journal numbers its sections (01-04).
   Icons are gone from this page on purpose: the labels and the numbering carry it.

   Prototype only: the data, routes, API contract, five-state machine and the
   strings the E2E suite asserts are all unchanged from the previous revision.
   ========================================================================== */

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
  /* Project state as it is already stored; rendered as a plain label here. */
  status?: { label: string; tone: "info" | "success" | "warning" };
  href: "/papers" | "/projects";
};

/* The four real areas, in navigation order, each with the route it actually opens. */
const workspaces = [
  { id: "courses", href: "/courses", name: "课程中心", fact: "本地导入材料", meta: "TXT · Markdown · CSV" },
  { id: "papers", href: "/papers", name: "论文研究", fact: "原文不上传", meta: "双语阅读 · 段落导引" },
  { id: "data", href: "/data", name: "数据分析", fact: "导入 CSV / XLSX", meta: "描述统计 · 检验 · 回归" },
  { id: "projects", href: "/projects", name: "项目空间", fact: "状态 · 任务 · 笔记", meta: "目标 · 截止 · 资料" },
] as const;

/* Only these two areas carry records, so this mapping is exhaustive rather than
   carrying a fallback branch that could never be reached. */
const recordAreas: Record<ActivityItem["href"], { name: string }> = {
  "/papers": { name: "论文研究" },
  "/projects": { name: "项目空间" },
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});
const stampFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/* An archival date stamp (2026.08.15), built from Intl parts rather than from a
   hardcoded pattern, so the locale still decides the field order. */
function stamp(value: number) {
  if (!value) return "未记录";
  return stampFormatter.formatToParts(value)
    .filter((part) => part.type !== "literal")
    .map((part) => part.value)
    .join(".");
}

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
  /* Counts are only printed once the two collections have actually been read. On a
     failed load the page says "—" rather than "0", because a zero would be a claim
     about the account that the page has no evidence for. */
  const counted = state === "ready" || state === "empty";
  /* The lead entry is the first record of the same list, so it is printed once as
     the study in hand and the remainder as the record list. Nothing appears twice. */
  const [lead, ...rest] = activity;

  /* Every line is a real value or an honest absence. Courses and datasets have no
     count concept anywhere in the product, so those lines report a fact instead of
     a number, and an unfetched list shows an empty value rather than a zero. */
  const register = [
    { label: "论文", value: counted ? String(papers.length) : "—", note: counted ? newestNote(papers.map((paper) => paper.updatedAt ?? 0)) : "", numeric: true },
    { label: "项目", value: counted ? String(projects.length) : "—", note: counted ? newestNote(projects.map((project) => (project.updated_at ? Date.parse(project.updated_at) : 0))) : "", numeric: true },
    { label: "课程", value: "本地导入", note: "TXT / MD / CSV", numeric: false },
    { label: "数据集", value: "本地导入", note: "CSV / XLSX", numeric: false },
    { label: "账号", value: viewer ? "云端同步已开启" : "未登录", note: viewer?.email ?? "匿名记录仅保存在本机", numeric: false },
  ];

  return <main className="student-app">
    <AppSidebar active="dashboard" initials={initials} profileTitle={displayName} profileSubtitle={viewer ? "云端同步已开启" : "仅保存在当前设备"} />
    <section className="student-main journal-shell">
      <div className="journal">
        {/* Running head: the journal's folio line, then one firm rule. */}
        <header className="journal-folio">
          <p className="journal-folio-name">研究工作台</p>
          <div className="journal-folio-right">
            <span className="journal-folio-date journal-num" suppressHydrationWarning>{dateFormatter.format(new Date())}</span>
            {viewer
              ? <Button className="journal-account" variant="ghost" size="sm" onClick={() => void signOut()}>退出</Button>
              : <Link className="journal-account-link" href="/auth">登录同步</Link>}
          </div>
        </header>
        <div className="journal-rule journal-rule--folio" aria-hidden="true" />

        <div className="journal-masthead">
          <h1 className="journal-greeting">你好，{displayName}。</h1>
          <p className="journal-lede">继续你的学习与研究。</p>
        </div>

        {state === "loading" && <JournalSkeleton />}

        {/* Every state keeps the same page: the running head, the masthead, the
            study, the two registers and the colophon. Only the study's own content
            changes, so nothing has to be redesigned for a state. */}
        {state !== "loading" && <>
          {/* 01 - the study in hand. The text column and the publication object
              share one grid, so no box is needed to hold them together. */}
          <section className="journal-spread" aria-labelledby="journal-study-title">
            <div className="journal-study">
              <h2 className="journal-label journal-label--study">
                <span className="journal-num">01</span>
                <span className="journal-label-text">CURRENT STUDY</span>
              </h2>

              {lead ? <>
                <h3 className="journal-title" id="journal-study-title">{lead.title}</h3>
                <dl className="journal-meta">
                  <div className="journal-meta-item">
                    <dt>区域</dt>
                    <dd>{recordAreas[lead.href].name}</dd>
                  </div>
                  {lead.paragraphs !== undefined ? <div className="journal-meta-item">
                    <dt>段落</dt>
                    <dd className="journal-num">{lead.paragraphs}</dd>
                  </div> : null}
                  {lead.status ? <div className="journal-meta-item">
                    <dt>状态</dt>
                    <dd>{lead.status.label}</dd>
                  </div> : null}
                  <div className="journal-meta-item">
                    <dt>更新</dt>
                    <dd className="journal-num">{stamp(lead.updatedAt)}</dd>
                  </div>
                </dl>
              </> : <StudyNote state={state} />}

              {/* A margin note, the way a journal prints a standing fact beside a
                  study. Both strings are the product's own. */}
              <p className="journal-margin-note">
                <span className="journal-margin-key">本地优先</span>
                <span className="journal-margin-copy">原文不上传</span>
              </p>
            </div>

            <PublicationObject />

            <div className="journal-action-row">
              {lead ? <Link className="journal-action" href={lead.href}>
                进入{recordAreas[lead.href].name}
                <span className="journal-action-mark" aria-hidden="true">→</span>
              </Link> : <>
                {state === "empty" && <>
                  <Link className="journal-action journal-action--quiet" href="/papers">导入论文</Link>
                  <Link className="journal-action" href="/projects?new=1">
                    新建项目
                    <span className="journal-action-mark" aria-hidden="true">→</span>
                  </Link>
                </>}
                {state === "guest" && <Link className="journal-action" href="/auth">
                  登录同步
                  <span className="journal-action-mark" aria-hidden="true">→</span>
                </Link>}
                {state === "error" && <button
                  className="journal-action journal-action--button"
                  type="button"
                  onClick={() => location.reload()}
                >
                  重新加载
                  <span className="journal-action-mark" aria-hidden="true">→</span>
                </button>}
              </>}
            </div>
          </section>

          {/* 02 + 03 - the two registers of the page, divided by a column rule. */}
          <section className="journal-columns">
            <div className="journal-index">
              <h2 className="journal-label">
                {/* The narrow layout puts the work areas first, so the numbers the
                    reader sees change with it: 02 WORKSPACES, 03 INDEX. */}
                <span className="journal-num journal-num--wide">02</span>
                <span className="journal-num journal-num--narrow">03</span>
                <span className="journal-label-text">INDEX</span>
              </h2>
              <dl className="journal-index-list">
                {register.map((cell) => <div className="journal-index-row" key={cell.label}>
                  <dt className="journal-index-key">{cell.label}</dt>
                  <dd className="journal-index-value">
                    <span className={cell.numeric ? "journal-num" : undefined}>{cell.value}</span>
                    {cell.note ? <span className="journal-index-note journal-num">{cell.note}</span> : null}
                  </dd>
                </div>)}
              </dl>
            </div>

            <div className="journal-contents-block">
              <h2 className="journal-label">
                <span className="journal-num journal-num--wide">03</span>
                <span className="journal-num journal-num--narrow">02</span>
                <span className="journal-label-text">WORKSPACES</span>
              </h2>
              <ol className="journal-contents">
                {workspaces.map((workspace, index) => {
                  const count = workspace.id === "papers"
                    ? (signedIn ? papers.length : null)
                    : workspace.id === "projects"
                      ? (signedIn ? projects.length : null)
                      : null;
                  return <li className="journal-contents-item" key={workspace.id}>
                    <Link className="journal-contents-row" href={workspace.href}>
                      <span className="journal-contents-num journal-num">{String(index + 1).padStart(2, "0")}</span>
                      <span className="journal-contents-name">{workspace.name}</span>
                      <span className={count === null ? "journal-contents-value" : "journal-contents-value journal-num"}>
                        {count === null ? workspace.fact : `${count} ${workspace.id === "papers" ? "篇" : "个项目"}`}
                      </span>
                      <span className="journal-contents-meta">{workspace.meta}</span>
                      <span className="journal-contents-arrow" aria-hidden="true">→</span>
                    </Link>
                  </li>;
                })}
              </ol>
            </div>
          </section>

          {rest.length > 0 && <>
            <div className="journal-rule" aria-hidden="true" />
            {/* 04 - the record list, printed the way a journal prints its contents. */}
            <section className="journal-records" aria-labelledby="journal-records-title">
              <h2 className="journal-label" id="journal-records-title">
                <span className="journal-num">04</span>
                <span className="journal-label-text">RECENT RECORDS</span>
              </h2>
              <ol className="journal-record-list">
                {rest.map((item, index) => <li className="journal-record-item" key={item.id}>
                  {/* The whole entry is the target, so its hover and focus cues are
                      honest about what a click does. */}
                  <Link className="journal-record" href={item.href}>
                    <span className="journal-record-line">
                      <span className="journal-record-num journal-num">{String(index + 1).padStart(2, "0")}</span>
                      <span className="journal-record-date journal-num">{stamp(item.updatedAt)}</span>
                      <span className="journal-record-kind">{recordAreas[item.href].name}</span>
                    </span>
                    <span className="journal-record-title">{item.title}</span>
                    <span className="journal-record-meta journal-num">
                      {item.paragraphs !== undefined ? `${item.paragraphs} 个段落` : null}
                      {item.paragraphs !== undefined && item.status ? <span className="journal-record-sep" aria-hidden="true" /> : null}
                      {item.status ? item.status.label : null}
                    </span>
                  </Link>
                </li>)}
              </ol>
            </section>
          </>}

          <footer className="journal-colophon">
            {/* The standing privacy facts are printed once, as the margin note beside
                the study; the colophon carries only what the page has not said. */}
            <p className="journal-colophon-facts">
              <span>{viewer ? "云端同步已开启" : "仅保存在当前设备"}</span>
            </p>
            <p className="journal-colophon-account">{viewer?.email ?? "未登录 · 匿名模式"}</p>
          </footer>
        </>}
      </div>
    </section>
  </main>;
}

/* The page's one visual asset, and its only bounded surface: a publication object
   built from page edges, a ruled text block, a folio marker and crop marks. Pure
   geometry, so it can carry no invented author, journal, abstract, DOI or chart. */
function PublicationObject() {
  return <div className="journal-field" aria-hidden="true">
    <span className="journal-sheets">
      <span className="journal-page journal-page--back" />
      <span className="journal-page journal-page--mid" />
      {/* An open spread: two leaves and one gutter, the way a journal lies open on
          a desk. The verso carries the head and the ruled measure, the recto the
          figure and its caption rule. */}
      <span className="journal-leaves">
        <span className="journal-leaf journal-leaf--verso">
          <span className="journal-leaf-margin" />
          <span className="journal-leaf-mark" />
          <span className="journal-leaf-running" />
          {/* A set headline over its body: the page reads as typeset text rather
              than as a ruled placeholder. */}
          <span className="journal-leaf-headline journal-leaf-headline--a" />
          <span className="journal-leaf-headline journal-leaf-headline--b" />
          <span className="journal-leaf-line journal-leaf-line--a" />
          <span className="journal-leaf-line journal-leaf-line--b" />
          <span className="journal-leaf-line journal-leaf-line--c" />
          <span className="journal-leaf-line journal-leaf-line--d" />
          <span className="journal-leaf-line journal-leaf-line--e" />
          <span className="journal-leaf-folio journal-num">01</span>
        </span>
        <span className="journal-leaf journal-leaf--recto">
          <span className="journal-leaf-block" />
          <span className="journal-leaf-caption" />
          <span className="journal-leaf-line journal-leaf-line--a" />
          <span className="journal-leaf-line journal-leaf-line--b" />
          <span className="journal-leaf-line journal-leaf-line--c" />
          <span className="journal-leaf-folio journal-num">02</span>
        </span>
      </span>
      {/* The visible block edge: what a stack of folded sheets looks like from the
          side, and the reason the top sheet reads as the top sheet. */}
      <span className="journal-edge" />
      <span className="journal-tick journal-tick--left" />
      <span className="journal-tick journal-tick--right" />
    </span>
    <span className="journal-crop journal-crop--tl" />
    <span className="journal-crop journal-crop--tr" />
    <span className="journal-crop journal-crop--bl" />
    <span className="journal-crop journal-crop--br" />
  </div>;
}

/* The study's three non-record states, kept in one place so each keeps the same
   publication treatment and only its emphasis changes: the empty state is a real
   onboarding moment and takes the academic display step, while the guest and error
   states stay at the page step because they are low-emphasis notes. */
const STUDY_NOTES = {
  empty: {
    lead: true,
    title: "工作台还是空的",
    copy: "你的账户已经连接。建立第一个项目或导入一篇论文后，真实记录会出现在这一栏。",
  },
  guest: {
    lead: false,
    title: "匿名体验 · 未登录",
    copy: "四个工作区都可以直接使用，入口在主导航里。登录后才会显示你的论文、项目与学习记录。",
  },
  error: {
    lead: false,
    title: "研究记录暂时无法读取",
    copy: "账户已连接，但项目或论文数据暂时无法读取。",
  },
} as const;

function StudyNote({ state }: { state: LoadState }) {
  const note = STUDY_NOTES[state === "empty" || state === "guest" ? state : "error"];
  return <>
    <h3 className={note.lead ? "journal-title" : "journal-title journal-title--note"} id="journal-study-title">{note.title}</h3>
    <p className="journal-note-copy">{note.copy}</p>
  </>;
}

/* Static placeholder in the same geometry, so nothing shifts when data lands.
   A skeleton rather than a spinner: the layout is the progress signal. */
function JournalSkeleton() {
  return <div className="dashboard-loading" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">正在载入你的工作台…</span>
    <div aria-hidden="true">
      {/* The skeleton follows the page's own geometry: running head, masthead,
          study with its object, the two registers and the record list. Nothing
          here is a rounded placeholder card. */}
      <div className="journal-folio">
        <span className="journal-skel journal-skel--folio" />
        <span className="journal-skel journal-skel--date" />
      </div>
      <div className="journal-rule journal-rule--folio" />
      <div className="journal-masthead">
        <span className="journal-skel journal-skel--greeting" />
        <span className="journal-skel journal-skel--lede" />
      </div>
      <div className="journal-spread">
        <div className="journal-study">
          <span className="journal-skel journal-skel--label" />
          <span className="journal-skel journal-skel--title" />
          <dl className="journal-meta">
            <div className="journal-meta-item"><dt>区域</dt><dd><span className="journal-skel journal-skel--value" /></dd></div>
            <div className="journal-meta-item"><dt>更新</dt><dd><span className="journal-skel journal-skel--value" /></dd></div>
          </dl>
          <span className="journal-skel journal-skel--note" />
        </div>
        <div className="journal-action-row"><span className="journal-skel journal-skel--action" /></div>
        <PublicationObject />
      </div>
      <section className="journal-columns">
        <div className="journal-index">
          <h2 className="journal-label"><span className="journal-num">02</span><span className="journal-label-text">INDEX</span></h2>
          <dl className="journal-index-list">
            {["论文", "项目", "课程", "数据集", "账号"].map((label) => <div className="journal-index-row" key={label}>
              <dt className="journal-index-key">{label}</dt>
              <dd className="journal-index-value"><span className="journal-skel journal-skel--value" /></dd>
            </div>)}
          </dl>
        </div>
        <div className="journal-contents-block">
          <h2 className="journal-label"><span className="journal-num">03</span><span className="journal-label-text">WORKSPACES</span></h2>
          <ol className="journal-contents">
            {["课程中心", "论文研究", "数据分析", "项目空间"].map((name, index) => <li className="journal-contents-item" key={name}>
              <span className="journal-contents-row">
                <span className="journal-contents-num journal-num">{String(index + 1).padStart(2, "0")}</span>
                <span className="journal-contents-name">{name}</span>
                <span className="journal-skel journal-skel--value" />
              </span>
            </li>)}
          </ol>
        </div>
      </section>
      <div className="journal-rule" />
      <div className="journal-records">
        <span className="journal-skel journal-skel--label" />
        {[0, 1].map((row) => <div className="journal-record-skel" key={row}>
          <span className="journal-skel journal-skel--recordmeta" />
          <span className="journal-skel journal-skel--recordtitle" />
        </div>)}
      </div>
    </div>
  </div>;
}

/* The newest real timestamp in a collection, or nothing when there is none. */
function newestNote(times: number[]) {
  const newest = times.filter((time) => time > 0).sort((left, right) => right - left)[0];
  return newest ? `最近更新 ${stamp(newest)}` : "尚无记录";
}

function projectState(status?: string): { label: string; tone: "info" | "success" | "warning" } {
  if (status === "completed") return { label: "已完成", tone: "success" };
  if (status === "paused") return { label: "已暂停", tone: "warning" };
  return { label: "进行中", tone: "info" };
}
