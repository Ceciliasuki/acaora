/* eslint-disable @next/next/no-img-element */

import { BarChart3, BookOpen, FileSearch, FolderKanban, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dashboardPreview from "../tests/e2e/__screenshots__/win32/dashboard-empty-1440.png";
import { getServerViewer } from "./lib/auth/server-viewer";

const modules = [
  { icon: BookOpen, title: "课程管理", copy: "整理课程资料，并基于你提供的内容生成练习与复习线索。", href: "/courses" },
  { icon: FileSearch, title: "论文阅读与分析", copy: "导入英文 PDF，进行双语阅读、段落分析与学术检索。", href: "/papers" },
  { icon: BarChart3, title: "数据分析", copy: "在浏览器中完成数据清洗、描述统计、检验、回归与可视化。", href: "/data" },
  { icon: FolderKanban, title: "项目管理", copy: "管理研究目标、任务进度、项目笔记与关联工作。", href: "/projects" },
];

export default async function AcaoraHome() {
  const viewer = await getServerViewer();
  const initials = viewer?.displayName.slice(0, 2).toUpperCase();
  return (
    <main className="acaora-site">
      <nav className="acaora-nav" aria-label="主导航">
        <Link className="acaora-brand" href="/"><span>A</span><div><strong>Acaora</strong><small>学曦</small></div></Link>
        <div className="acaora-nav-links"><a href="#platform">平台</a><Link href="/papers">论文研究</Link><Link href="/data">数据分析</Link><a href="#principles">隐私与 AI</a></div>
        <div className="acaora-nav-actions">{viewer ? <><Link className="ghost-link" href="/dashboard">进入工作台</Link><Link className="home-viewer" href="/settings" aria-label={`打开 ${viewer.displayName} 的账户设置`}>{viewer.avatar ? <img src={viewer.avatar} alt="" width="32" height="32" /> : <span>{initials}</span>}<strong>{viewer.displayName}</strong></Link></> : <><Link className="ghost-link" href="/auth">登录</Link><Link className="primary-link" href="/auth">创建账户</Link></>}</div>
      </nav>

      <section className="acaora-hero">
        <h1>大学生学习与研究工作台</h1>
        <p>在一个账户中衔接课程、论文、数据与项目。原始文件默认留在你的设备。</p>
        <div className="hero-actions"><Link className="hero-main" href="/dashboard">进入工作台</Link><Link className="hero-demo" href="/papers">查看 PaperLab</Link></div>
        <figure className="hero-product approved-preview">
          <Image src={dashboardPreview} priority sizes="(max-width: 768px) 100vw, 1200px" alt="Acaora 已批准的工作台界面" />
          <figcaption>实际产品界面：Scholarly Luxe Workspace</figcaption>
        </figure>
      </section>

      <section className="acaora-modules" id="platform">
        <div className="section-intro"><h2>一个连续的学习记录</h2><p>四个工作区共享同一账户；PaperLab 同时保留明确的匿名设备本地模式。</p></div>
        <div className="module-grid">{modules.map((module) => { const Icon = module.icon; return <Link className="module-card" href={module.href} key={module.title}><Icon size={22} aria-hidden="true" /><h3>{module.title}</h3><p>{module.copy}</p><span>打开工作区</span></Link>; })}</div>
      </section>

      <section className="acaora-principles" id="principles">
        <div className="principle-copy"><ShieldCheck size={26} aria-hidden="true" /><h2>可信、可核对、可恢复</h2><p>原文、个人内容与 AI 输出保持分层；账户记录可跨设备恢复，原始文件不因登录自动上传。</p><Link href="/papers">了解 PaperLab</Link></div>
        <div className="principle-list"><article><b>01</b><div><h3>论文引用定位</h3><p>PaperLab 的论文分析关联编号段落，便于回到原文核对。</p></div></article><article><b>02</b><div><h3>本地文件处理</h3><p>PDF 与数据在浏览器中解析，原始文件默认不上传。</p></div></article><article><b>03</b><div><h3>账户记录同步</h3><p>阅读进度、笔记和项目记录按账户隔离同步。</p></div></article></div>
      </section>

      <footer className="acaora-footer"><div className="acaora-brand"><span>A</span><div><strong>Acaora</strong><small>学习与研究工作台</small></div></div><div><Link href="/papers">论文</Link><Link href="/data">数据</Link><Link href="/projects">项目</Link><Link href={viewer ? "/settings" : "/auth"}>账户</Link></div></footer>
    </main>
  );
}
