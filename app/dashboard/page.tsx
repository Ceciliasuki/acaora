"use client";

import { useEffect, useState } from "react";
import AppSidebar from "../components/app-sidebar";
import { bridgeBrowserSession, browserAuthenticatedFetch, browserSignOut, getBrowserAuthConfig, getBrowserUser } from "../lib/browser-auth";

type Viewer = { id: string; email?: string } | null;

const moduleCards = [
  { label: "PAPERS", title: "继续精读论文", copy: "双语阅读、AI 拆解与统计审查", href: "/papers", icon: "文", tone: "violet" },
  { label: "DATA", title: "打开数据工作台", copy: "清洗、检验、回归与可视化", href: "/data", icon: "Σ", tone: "mint" },
  { label: "PROJECTS", title: "推进学习项目", copy: "目标、任务、笔记与研究成果", href: "/projects", icon: "◇", tone: "blue" },
];

export default function DashboardPage() {
  const [viewer, setViewer] = useState<Viewer>(null);
  const [configured, setConfigured] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadViewer() {
      let serverConfigured = false;
      let serverUser: Viewer = null;
      try {
        const response = await browserAuthenticatedFetch("/api/auth/session", { cache: "no-store", headers: { "Accept": "application/json" } });
        if ((response.headers.get("content-type") ?? "").includes("application/json")) {
          const payload = await response.json() as { user?: Viewer; configured?: boolean };
          serverUser = payload.user ?? null;
          serverConfigured = Boolean(payload.configured);
        }
      } catch {
        // The deployment preview may block dynamic routes; browser auth remains available.
      }
      const browserUser = serverUser ? null : await getBrowserUser();
      if (browserUser) void bridgeBrowserSession();
      setViewer(serverUser ?? (browserUser ? { id: browserUser.id, email: browserUser.email } : null));
      setConfigured(serverConfigured || Boolean(getBrowserAuthConfig()));
      setLoaded(true);
    }
    void loadViewer();
  }, []);

  async function signOut() {
    await Promise.allSettled([
      fetch("/api/auth/logout", { method: "POST" }),
      browserSignOut(),
    ]);
    setViewer(null);
  }

  const initials = viewer?.email?.slice(0, 2).toUpperCase() ?? "GU";

  return (
    <main className="student-app">
      <AppSidebar active="dashboard" initials={initials} profileTitle={viewer?.email?.split("@")[0] ?? "匿名学习者"} profileSubtitle={viewer ? "云端同步已开启" : "仅保存在当前设备"} />

      <section className="student-main">
        <header className="student-topbar"><div><span>SUNDAY · 16 AUGUST</span><h1>下午好，{viewer?.email?.split("@")[0] ?? "同学"}。</h1></div><div><button className="command-button">⌘ K <span>快速开始</span></button>{viewer ? <button className="account-button" onClick={() => void signOut()}>{initials}<span>退出</span></button> : <a className="dashboard-login" href="/auth">登录同步</a>}</div></header>

        {!viewer && loaded && <div className="guest-banner"><div><b>{configured ? "匿名模式" : "账户服务等待连接"}</b><p>{configured ? "当前内容只保存在这台设备。登录后可以跨设备同步学习记忆。" : "你可以继续使用 PaperLab 和 DataLab；Supabase 连接完成后将开放注册与密码登录。"}</p></div><a href="/auth">{configured ? "登录账户" : "查看登录页"} →</a></div>}

        <section className="dashboard-hero"><div><span>TODAY’S FOCUS</span><h2>把最重要的一件事，<br />推进到下一步。</h2><p>你正在阅读《Statistical learning in observational studies》，上次停在方法部分。</p><div><a href="/papers">继续阅读论文 <b>→</b></a><button>更换今日重点</button></div></div><aside><span>WEEKLY SIGNAL</span><strong>6.4<small>h</small></strong><p>本周深度学习时间</p><div>{[45, 68, 38, 82, 60, 74, 52].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div><small>比上周提高 18%</small></aside></section>

        <div className="dashboard-section-title"><div><span>WORKSPACES</span><h2>从你的工作区继续</h2></div><a href="/projects?new=1">＋ 新建项目</a></div>
        <section className="dashboard-modules">{moduleCards.map((module) => <a className={module.tone} href={module.href} key={module.label}><div><b>{module.icon}</b><span>{module.label}</span><i>↗</i></div><h3>{module.title}</h3><p>{module.copy}</p></a>)}</section>

        <section className="dashboard-lower" id="courses"><article><header><div><span>RECENT ACTIVITY</span><h2>最近项目</h2></div><a href="/projects">查看全部</a></header><ul><li><b className="file-pdf">PDF</b><p><strong>Statistical learning in observational studies</strong><small>PaperLab · 已读 68% · 2 条 AI 记忆</small></p><em>今天</em></li><li><b className="file-csv">CSV</b><p><strong>大学生睡眠与成绩调查</strong><small>DataLab · 326 行 · 8 个变量</small></p><em>昨天</em></li><li><b className="file-course">课</b><p><strong>计量经济学 · 第 06 周</strong><small>课程中心 · 4 / 6 个目标</small></p><em>周五</em></li></ul></article><aside id="roadmap"><span>LEARNING CENTER</span><h2>课程空间</h2><p>统计学与国际经贸双主线，支持导入资料并生成带解析的练习。</p><div><i style={{ width: "100%" }} /></div><small>基础框架已可用</small><a href="/courses">进入课程中心</a></aside></section>
      </section>
    </main>
  );
}
