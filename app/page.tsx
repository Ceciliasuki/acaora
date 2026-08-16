const modules = [
  { code: "01", name: "Study", title: "课程与复习", copy: "把课件、课程大纲和笔记变成知识地图、测验与复习计划。", href: "/dashboard", tone: "violet" },
  { code: "02", name: "Papers", title: "论文与文献", copy: "双语阅读、真实检索、统计审查和可追溯的 AI 论文问答。", href: "/papers", tone: "mint" },
  { code: "03", name: "Data", title: "数据与统计", copy: "浏览器本地完成数据清洗、探索分析、假设检验与可视化。", href: "/data", tone: "coral" },
  { code: "04", name: "Projects", title: "项目与成长", copy: "集中管理课程项目、研究进度、作品证据和未来能力地图。", href: "/projects", tone: "blue" },
];

export default function AcaoraHome() {
  return (
    <main className="acaora-site">
      <nav className="acaora-nav" aria-label="主导航">
        <a className="acaora-brand" href="/"><span>A</span><div><strong>Acaora</strong><small>学曦</small></div></a>
        <div className="acaora-nav-links"><a href="#platform">平台</a><a href="/papers">论文研究</a><a href="/data">数据分析</a><a href="#principles">可信 AI</a></div>
        <div className="acaora-nav-actions"><a className="ghost-link" href="/auth">登录</a><a className="primary-link" href="/auth">免费开始 <span>↗</span></a></div>
      </nav>

      <section className="acaora-hero">
        <div className="hero-proof"><span>PRIVATE BY DESIGN</span><i /> 本地优先 · 证据可追溯 · 为大学生构建</div>
        <h1>把学习、研究与创造，<br /><em>放进同一个工作台。</em></h1>
        <p>从一份课件、一篇论文或一个数据集开始。Acaora 帮你理解知识、验证证据、完成分析，并记住每一次真正的进步。</p>
        <div className="hero-actions"><a className="hero-main" href="/auth">建立我的学习空间 <span>→</span></a><a className="hero-demo" href="/papers"><i>▶</i> 体验 PaperLab</a></div>

        <div className="hero-product" aria-label="Acaora 产品预览">
          <aside>
            <div className="mini-brand"><b>A</b><span>Acaora</span></div>
            <div className="mini-nav active"><i>⌂</i><span>总览</span></div>
            <div className="mini-nav"><i>◫</i><span>课程</span></div>
            <div className="mini-nav"><i>⌕</i><span>论文</span></div>
            <div className="mini-nav"><i>⌁</i><span>数据</span></div>
            <div className="mini-profile"><b>YU</b><span>我的空间</span></div>
          </aside>
          <article>
            <header><div><small>SUNDAY · 16 AUGUST</small><h2>下午好，准备从哪里继续？</h2></div><button>⌘ K &nbsp; 快速开始</button></header>
            <div className="product-grid">
              <section className="focus-card"><span>TODAY’S FOCUS</span><h3>计量经济学 · 第 06 周</h3><p>固定效应、内生性与工具变量</p><div><i style={{ width: "68%" }} /></div><small>4 / 6 个学习目标已完成</small><button>继续学习 <b>→</b></button></section>
              <section className="signal-card"><span>LEARNING SIGNAL</span><strong>84<small>%</small></strong><p>本周知识掌握度</p><div className="spark-bars">{[36, 52, 44, 68, 61, 79, 84].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></section>
              <section className="recent-card"><div><span>最近的研究</span><a href="/papers">全部项目 →</a></div><ul><li><b>PDF</b><p>Statistical learning in observational studies<small>PaperLab · 已读 68%</small></p><em>继续</em></li><li><b className="data-icon">CSV</b><p>大学生睡眠与成绩调查<small>DataLab · 326 行</small></p><em>打开</em></li></ul></section>
              <section className="ai-brief"><span>ACAORA COPILOT</span><p>“这篇论文的外部验证结果下降，可能意味着什么？”</p><div><b>AI</b><small>我会从分布偏移、样本选择和模型泛化三个方面解释，并回到原文第 17–19 段核对。</small></div></section>
            </div>
          </article>
        </div>
      </section>

      <section className="acaora-modules" id="platform">
        <div className="section-intro"><div><span>ONE WORKSPACE, MANY PATHS</span><h2>每个专业，都有自己的学习方式。</h2></div><p>Acaora 不要求所有学生使用同一套模板。模块共享同一份学习记忆，同时保留每个领域真正需要的工具。</p></div>
        <div className="module-grid">{modules.map((module) => <a className={`module-card ${module.tone}`} href={module.href} key={module.name}><div><span>{module.code}</span><b>↗</b></div><small>{module.name.toUpperCase()} LAB</small><h3>{module.title}</h3><p>{module.copy}</p><footer><i />进入工作区</footer></a>)}</div>
      </section>

      <section className="acaora-principles" id="principles">
        <div className="principle-copy"><span>BUILT FOR REAL LEARNING</span><h2>AI 可以很强，<br />但证据必须更强。</h2><p>每个重要回答都应回到材料，每项统计判断都应说明假设，每位学生都应知道自己的内容去了哪里。</p><a href="/papers">看看我们怎样分析一篇论文 →</a></div>
        <div className="principle-list"><article><b>01</b><div><h3>来源可追溯</h3><p>区分原文、个人笔记和 AI 推断，回答附带段落或材料依据。</p></div></article><article><b>02</b><div><h3>本地优先</h3><p>PDF 与数据默认在设备解析；你决定哪些内容需要同步或交给 AI。</p></div></article><article><b>03</b><div><h3>学习而非代写</h3><p>提供解释、诊断、检查和追问，让学生保留判断与创造的责任。</p></div></article></div>
      </section>

      <footer className="acaora-footer"><div className="acaora-brand"><span>A</span><div><strong>Acaora</strong><small>学曦</small></div></div><p>Study · Research · Build</p><div><a href="/papers">PaperLab</a><a href="/data">DataLab</a><a href="/auth">账户</a></div></footer>
    </main>
  );
}
