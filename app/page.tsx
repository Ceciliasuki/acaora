/* eslint-disable @next/next/no-img-element */

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dashboardPreview from "../public/preview-dashboard.webp";
import { getServerViewer } from "./lib/auth/server-viewer";

const modules = [
  { title: "课程资料", copy: "选一门课，整理资料或生成练习。", href: "/courses" },
  { title: "论文阅读", copy: "原文、译文和笔记，放在一起读。", href: "/papers" },
  { title: "数据分析", copy: "导入数据，检查变量、分布和回归结果。", href: "/data" },
  { title: "研究项目", copy: "记下目标，安排下一步，留下研究笔记。", href: "/projects" },
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
        <div className="home-intro">
          <h1>读论文，<br />做研究。</h1>
          <p>导入 PDF，阅读、标注并整理笔记。课程资料、数据分析和项目也在同一个工作台。</p>
          <div className="hero-actions"><Link className="hero-main" href="/dashboard">进入工作台<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
        </div>
        <figure className="approved-preview">
          <Image src={dashboardPreview} preload unoptimized sizes="(max-width: 768px) 100vw, 1200px" alt="Acaora 工作台的空状态" />
        </figure>
      </section>

      <section className="acaora-modules" id="platform">
        <div className="section-intro"><h2>工作区</h2></div>
        <div className="module-grid">{modules.map((module) => <Link className="module-card" href={module.href} key={module.title}><h3>{module.title}</h3><p>{module.copy}</p><ArrowUpRight size={20} aria-hidden="true" /></Link>)}</div>
      </section>

      <section className="acaora-principles" id="principles">
        <div className="principle-copy"><h2>文件与同步</h2><p>原始文件不因登录自动上传。AI 输出单独标记，方便回到原文核对。</p></div>
        <div className="principle-list"><article><div><h3>留在本机</h3><p>PDF 与数据文件在浏览器中解析，原始文件默认不上传。</p></div></article><article><div><h3>跟随账户</h3><p>登录后，阅读进度、笔记和项目记录按账户同步。</p></div></article></div>
      </section>

      <footer className="acaora-footer"><div className="acaora-brand"><span>A</span><div><strong>Acaora</strong><small>学习与研究工作台</small></div></div><div><Link href="/papers">论文</Link><Link href="/data">数据</Link><Link href="/projects">项目</Link><Link href={viewer ? "/settings" : "/auth"}>账户</Link></div></footer>
    </main>
  );
}
