/* eslint-disable @next/next/no-img-element */

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import HomeReadingDemo from './components/home-reading-demo';
import HomeMotion from './components/home-motion';
import HomeMobileMenu from './components/home-mobile-menu';
import {researchWorkspaces,learningWorkspace} from './components/workspace-content';
import HomeAnalysisPreview from './components/home-analysis-preview';
import HomeSectionTitle from './components/home-section-title';
import details from './home-details.module.css';
import { getServerViewer } from "./lib/auth/server-viewer";

export default async function AcaoraHome() {
  const viewer = await getServerViewer();
  const initials = viewer?.displayName.slice(0, 2).toUpperCase();
  return (
    <HomeMotion><main className="acaora-site">
      <nav className="acaora-nav" aria-label="主导航">
        <Link className="acaora-brand" href="/"><span>A</span><div><strong>Acaora</strong><small>学曦</small></div></Link>
        <div className="acaora-nav-links"><Link href="/dashboard">总览</Link><Link href="/papers">论文阅读</Link><Link href="/data">数据分析</Link><Link href="/projects">研究项目</Link><Link href="/courses">课程学习</Link></div>
        <HomeMobileMenu/>
        <div className="acaora-nav-actions">{viewer ? <><Link className="ghost-link" href="/dashboard">进入工作台</Link><Link className="home-viewer" href="/settings" aria-label={`打开 ${viewer.displayName} 的账户设置`}>{viewer.avatar ? <img src={viewer.avatar} alt="" width="32" height="32" /> : <span>{initials}</span>}<strong>{viewer.displayName}</strong></Link></> : <><Link className="ghost-link" href="/auth">登录</Link><Link className="primary-link" href="/auth?mode=register">创建账户</Link></>}</div>
      </nav>

      <section className="acaora-hero">
        <div className="home-intro">
          <h1><span className="home-title-line"><span>读透论文，</span></span><span className="home-title-line"><span>做实研究。</span></span></h1>
          <div className="hero-actions"><Link className="hero-main" href="/dashboard">进入工作台<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
        </div>
        <HomeReadingDemo />
      </section>

      <HomeAnalysisPreview/>
      <section className={details.writingSection} aria-labelledby="home-writing-title">
        <header className={details.writingHeader}><HomeSectionTitle id="home-writing-title">落笔之前</HomeSectionTitle></header>
        <div className={details.writing}>
          <svg className={details.writingGuides} viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
            <path className={details.guideLeft} d="M500 0 C500 44 0 68 0 120"/>
            <path className={details.guideRight} d="M500 0 C500 44 1000 68 1000 120"/>
            <path className={details.guideBase} d="M0 120 Q500 84 1000 120"/>
          </svg>
          <article data-writing-node="source"><h3>查看出处</h3><p>按页码查看原文，回看分析记录。</p></article>
          <article data-writing-node="update"><h3>更新提醒</h3><p>来源或模型修改后，提醒核对相关结果。</p></article>
          <article data-writing-node="export"><h3>导出文档</h3><p>支持 Word 和 LaTeX，导出后继续编辑。</p></article>
        </div>
        <div className={details.sectionAction}><Link href="/projects">打开研究项目<ArrowUpRight size={16} aria-hidden="true"/></Link></div>
      </section>

      <section className={`acaora-modules ${details.workspaces}`} id="platform" aria-label="功能入口">
        <div className="module-grid">{[...researchWorkspaces,learningWorkspace].map((module) => <Link className="module-card" href={module.href} key={module.title}><h3>{module.title}</h3><p>{module.copy}</p><ArrowUpRight size={20} aria-hidden="true" /></Link>)}</div>
      </section>

    </main></HomeMotion>
  );
}
