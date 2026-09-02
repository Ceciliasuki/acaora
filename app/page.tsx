/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { getServerViewer } from "./lib/auth/server-viewer";

const modules = [
  { icon: "课", title: "课程管理", copy: "整理课件、课程大纲和笔记，生成知识地图、测验与复习计划。", href: "/courses", tone: "violet" },
  { icon: "文", title: "论文阅读与分析", copy: "导入英文 PDF，进行双语阅读、文献检索、段落分析与统计审查。", href: "/papers", tone: "mint" },
  { icon: "Σ", title: "数据分析", copy: "在浏览器中完成数据清洗、描述统计、假设检验、回归与可视化。", href: "/data", tone: "coral" },
  { icon: "◇", title: "项目管理", copy: "管理课程论文、研究项目、任务进度、项目笔记与相关材料。", href: "/projects", tone: "blue" },
];

export default async function AcaoraHome() {
  const viewer = await getServerViewer();
  const initials = viewer?.displayName.slice(0, 2).toUpperCase();
  return (
    <main className="acaora-site">
      <nav className="acaora-nav" aria-label="主导航">
        <Link className="acaora-brand" href="/"><span>A</span><div><strong>Acaora</strong><small>学曦</small></div></Link>
        <div className="acaora-nav-links"><a href="#platform">平台</a><Link href="/papers">论文研究</Link><Link href="/data">数据分析</Link><a href="#principles">可信 AI</a></div>
        <div className="acaora-nav-actions">{viewer ? <><Link className="ghost-link" href="/dashboard">进入工作台</Link><Link className="home-viewer" href="/settings" aria-label={`打开 ${viewer.displayName} 的账户设置`}>{viewer.avatar ? <img src={viewer.avatar} alt="" width="32" height="32" /> : <span>{initials}</span>}<strong>{viewer.displayName}</strong></Link></> : <><Link className="ghost-link" href="/auth">登录</Link><Link className="primary-link" href="/auth">免费开始 <span>↗</span></Link></>}</div>
      </nav>

      <section className="acaora-hero">
        <div className="hero-function-list" aria-label="主要功能"><span>课程管理</span><i /><span>论文分析</span><i /><span>数据分析</span><i /><span>项目管理</span></div>
        <h1>大学生学习与研究工作台</h1>
        <p>在一个账户中管理课程进度、阅读与翻译论文、完成统计分析，并保存研究项目记录。</p>
        <div className="hero-actions"><Link className="hero-main" href="/dashboard">进入总览 <span>→</span></Link><Link className="hero-demo" href="/papers">查看论文功能</Link></div>

        <div className="hero-product" aria-label="Acaora 产品预览，内容为示例数据">
          <aside>
            <div className="mini-brand"><b>A</b><span>Acaora</span></div>
            <div className="mini-nav active"><i>⌂</i><span>总览</span></div>
            <div className="mini-nav"><i>◫</i><span>课程</span></div>
            <div className="mini-nav"><i>⌕</i><span>论文</span></div>
            <div className="mini-nav"><i>⌁</i><span>数据</span></div>
            <div className="mini-profile"><b>YU</b><span>我的空间</span></div>
          </aside>
          <article>
            <header><div><small>学习总览 · 示例数据</small><h2>课程与研究进度</h2></div><span className="demo-control" aria-hidden="true">⌘ K &nbsp; 快速开始</span></header>
            <div className="product-grid">
              <section className="focus-card"><span>今日课程</span><h3>计量经济学 · 第 06 周</h3><p>固定效应、内生性与工具变量</p><div><i style={{ width: "68%" }} /></div><small>4 / 6 个学习目标已完成</small><span className="demo-control" aria-hidden="true">继续学习 <b>→</b></span></section>
              <section className="signal-card"><span>学习进度</span><strong>84<small>%</small></strong><p>本周知识掌握度</p><div className="spark-bars">{[36, 52, 44, 68, 61, 79, 84].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></section>
              <section className="recent-card"><div><span>最近的研究</span><em>示例</em></div><ul><li><b>PDF</b><p>Statistical learning in observational studies<small>PaperLab · 已读 68%</small></p><em>继续</em></li><li><b className="data-icon">CSV</b><p>大学生睡眠与成绩调查<small>DataLab · 326 行</small></p><em>打开</em></li></ul></section>
              <section className="ai-brief"><span>AI 分析</span><p>“这篇论文的外部验证结果下降，可能意味着什么？”</p><div><b>AI</b><small>从分布偏移、样本选择和模型泛化三个方面解释，并回到原文核对。</small></div></section>
            </div>
          </article>
        </div>
      </section>

      <section className="acaora-modules" id="platform">
        <div className="section-intro"><div><h2>核心功能</h2></div><p>四个工作区共享同一账户与学习记录。</p></div>
        <div className="module-grid">{modules.map((module) => <Link className={`module-card ${module.tone}`} href={module.href} key={module.title}><div><span>{module.icon}</span><b>↗</b></div><h3>{module.title}</h3><p>{module.copy}</p><footer><i />打开功能</footer></Link>)}</div>
      </section>

      <section className="acaora-principles" id="principles">
        <div className="principle-copy"><h2>可信与隐私</h2><p>区分原文、个人内容和 AI 输出，并明确控制数据的处理与同步方式。</p><Link href="/papers">查看论文处理方式 →</Link></div>
        <div className="principle-list"><article><b>01</b><div><h3>引用定位</h3><p>论文分析关联原文段落，便于核对结论与上下文。</p></div></article><article><b>02</b><div><h3>本地处理</h3><p>PDF 与数据默认在浏览器中解析，原始文件无需上传。</p></div></article><article><b>03</b><div><h3>账户同步</h3><p>阅读进度、笔记和项目记录按账户隔离同步。</p></div></article></div>
      </section>

      <footer className="acaora-footer"><div className="acaora-brand"><span>A</span><div><strong>Acaora</strong><small>学习与研究工作台</small></div></div><div><Link href="/papers">论文</Link><Link href="/data">数据</Link><Link href="/projects">项目</Link><Link href={viewer ? "/settings" : "/auth"}>账户</Link></div></footer>
    </main>
  );
}
