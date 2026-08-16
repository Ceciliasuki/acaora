"use client";

import AppSidebar from "../components/app-sidebar";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { deletePaper, getPaperLibrary, savePaper } from "./paper-storage";
import AiStudio from "./ai-studio";
import type { AiMemory, PaperRecord, Paragraph, SearchPaper } from "./paper-types";
import { samplePaper } from "./paper-types";

type TranslatorSession = {
  translate: (text: string) => Promise<string>;
  destroy?: () => void;
};

type TranslatorFactory = {
  availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<string>;
  create: (options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: EventTarget) => void;
  }) => Promise<TranslatorSession>;
};

type TranslationState = "checking" | "ready" | "downloadable" | "unsupported" | "working" | "done" | "error";

export default function PaperLab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const translatorRef = useRef<TranslatorSession | null>(null);
  const [paper, setPaper] = useState<PaperRecord>(samplePaper);
  const [library, setLibrary] = useState<PaperRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [translationState, setTranslationState] = useState<TranslationState>("checking");
  const [translationProgress, setTranslationProgress] = useState(0);
  const [modelProgress, setModelProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState(samplePaper.title);
  const [searchResults, setSearchResults] = useState<SearchPaper[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [cloudState, setCloudState] = useState<"checking" | "guest" | "ready" | "error">("checking");
  const [mobilePanel, setMobilePanel] = useState<"reader" | "library" | "insight" | "ai" | "search">("reader");

  const activeIndex = Math.min(paper.activeParagraph, Math.max(0, paper.paragraphs.length - 1));
  const activeParagraph = paper.paragraphs[activeIndex];
  const sections = useMemo(() => [...new Set(paper.paragraphs.map((item) => item.section))], [paper.paragraphs]);
  const completion = paper.paragraphs.length
    ? Math.round((paper.paragraphs.filter((item) => item.read).length / paper.paragraphs.length) * 100)
    : 0;
  const insight = activeParagraph ? analyzeParagraph(activeParagraph) : null;
  const isEdge = typeof navigator !== "undefined" && /Edg\//.test(navigator.userAgent);

  useEffect(() => {
    void (async () => {
      try {
        const localRecords = await getPaperLibrary();
        let records = localRecords;
        const sessionResponse = await fetch("/api/auth/session");
        const session = await sessionResponse.json() as { user?: { id: string } | null };
        if (session.user) {
          const cloudResponse = await fetch("/api/cloud/papers");
          if (cloudResponse.ok) {
            const cloud = await cloudResponse.json() as { papers?: PaperRecord[] };
            const byId = new Map<string, PaperRecord>();
            [...localRecords, ...(cloud.papers ?? [])].forEach((record) => {
              const existing = byId.get(record.id);
              if (!existing || record.updatedAt > existing.updatedAt) byId.set(record.id, record);
            });
            records = [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
            await Promise.all((cloud.papers ?? []).map((record) => savePaper(record)));
            setCloudState("ready");
          } else setCloudState("error");
        } else setCloudState("guest");
        setLibrary(records);
        if (records.length) {
          setPaper(records[0]);
          setSearchQuery(records[0].title);
        }
      } catch {
        setCloudState("error");
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    const factory = getTranslatorFactory();
    if (!factory) {
      setTranslationState("unsupported");
      return;
    }
    void factory.availability({ sourceLanguage: "en", targetLanguage: "zh" })
      .then((availability) => setTranslationState(availability === "unavailable" ? "unsupported" : availability === "available" ? "ready" : "downloadable"))
      .catch(() => setTranslationState("unsupported"));
    return () => translatorRef.current?.destroy?.();
  }, []);

  useEffect(() => {
    if (!hydrated || paper.id === samplePaper.id) return;
    const handle = window.setTimeout(() => {
      const updated = { ...paper, updatedAt: Date.now() };
      void savePaper(updated).then(() => {
        setLibrary((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      });
      if (cloudState === "ready") {
        void fetch("/api/cloud/papers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updated) })
          .then((response) => { if (!response.ok) setCloudState("error"); })
          .catch(() => setCloudState("error"));
      }
    }, 450);
    return () => window.clearTimeout(handle);
  }, [paper, hydrated, cloudState]);

  function updatePaper(updater: (current: PaperRecord) => PaperRecord) {
    setPaper((current) => updater(current));
  }

  function updateActiveParagraph(patch: Partial<Paragraph>) {
    updatePaper((current) => ({
      ...current,
      paragraphs: current.paragraphs.map((paragraph, index) => index === activeIndex ? { ...paragraph, ...patch } : paragraph),
    }));
  }

  async function handlePdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("请选择 PDF 格式的英文论文。" );
      return;
    }
    setExtracting(true);
    setExtractProgress(0);
    setMessage("正在设备本地解析论文……");
    try {
      const extracted = await extractPdf(file, setExtractProgress);
      setPaper(extracted);
      setSearchQuery(extracted.title);
      await savePaper(extracted);
      setLibrary((current) => [extracted, ...current.filter((item) => item.id !== extracted.id)]);
      setMessage(`已读取 ${extracted.paragraphs.length} 个段落，原始 PDF 未上传。`);
      setMobilePanel("reader");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF 解析失败。" );
    } finally {
      setExtracting(false);
    }
  }

  async function ensureTranslator() {
    if (translatorRef.current) return translatorRef.current;
    const factory = getTranslatorFactory();
    if (!factory) throw new Error("当前浏览器没有开放本地翻译功能。请使用最新版桌面 Edge。" );
    setTranslationState("working");
    const session = await factory.create({
      sourceLanguage: "en",
      targetLanguage: "zh",
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          const progress = event as Event & { loaded?: number; total?: number };
          if (typeof progress.loaded === "number") {
            setModelProgress(Math.round(progress.loaded * 100));
          }
        });
      },
    });
    translatorRef.current = session;
    return session;
  }

  async function translateParagraphs(mode: "current" | "all") {
    setMessage("");
    setTranslationProgress(0);
    try {
      const translator = await ensureTranslator();
      const targets = mode === "current"
        ? [activeIndex]
        : paper.paragraphs.map((_, index) => index).filter((index) => !paper.paragraphs[index].translation);
      if (!targets.length) {
        setTranslationState("done");
        setMessage("所有段落已经完成翻译。" );
        return;
      }
      let workingPaper = paper;
      for (let position = 0; position < targets.length; position += 1) {
        const index = targets[position];
        const translation = await translator.translate(workingPaper.paragraphs[index].original);
        workingPaper = {
          ...workingPaper,
          paragraphs: workingPaper.paragraphs.map((paragraph, paragraphIndex) => paragraphIndex === index ? { ...paragraph, translation } : paragraph),
        };
        setPaper(workingPaper);
        setTranslationProgress(Math.round(((position + 1) / targets.length) * 100));
      }
      setTranslationState("done");
      setMessage(`完成 ${targets.length} 个段落的设备端翻译。`);
    } catch (error) {
      setTranslationState("error");
      setMessage(error instanceof Error ? error.message : "本地翻译失败。" );
    }
  }

  async function searchPapers() {
    const query = searchQuery.trim();
    if (query.length < 3) return;
    setSearching(true);
    setSearchMessage("");
    try {
      const response = await fetch(`/api/papers/search?q=${encodeURIComponent(query)}`);
      const payload = await response.json() as { error?: string; papers?: SearchPaper[]; source?: string };
      if (!response.ok) throw new Error(payload.error ?? "检索失败。" );
      const normalizedTitle = paper.title.toLowerCase();
      setSearchResults((payload.papers ?? []).filter((result) => result.title.toLowerCase() !== normalizedTitle));
      setSearchMessage(`来自 ${payload.source ?? "公共学术索引"} · ${(payload.papers ?? []).length} 条结果`);
      setMobilePanel("search");
    } catch (error) {
      setSearchMessage(error instanceof Error ? error.message : "检索失败。" );
    } finally {
      setSearching(false);
    }
  }

  async function removeFromLibrary(record: PaperRecord) {
    if (!window.confirm(`从当前设备删除“${record.title}”的阅读记忆？`)) return;
    await deletePaper(record.id);
    if (cloudState === "ready") void fetch(`/api/cloud/papers?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
    const remaining = library.filter((item) => item.id !== record.id);
    setLibrary(remaining);
    if (paper.id === record.id) setPaper(remaining[0] ?? samplePaper);
  }

  function openPaper(record: PaperRecord) {
    setPaper(record);
    setSearchQuery(record.title);
    setMobilePanel("reader");
  }

  return (
    <main className="student-app paper-layout">
      <AppSidebar active="papers" profileTitle="PaperLab 工作台" profileSubtitle={cloudState === "ready" ? "论文记忆已同步" : "本地研究模式"} />
      <section className="paper-shell paper-app paper-main">
      <section className="paper-commandbar">
        <div>
          <p className="section-kicker">PAPER WORKSPACE / LOCAL FIRST</p>
          <h1>读懂论文，而不只是翻译论文。</h1>
        </div>
        <div className="paper-commandbar-actions">
          <div className={`translator-status state-${translationState}`}>
            <i />
            <div><strong>{translatorStatusLabel(translationState, isEdge)}</strong><small>{translationStatusDetail(translationState, modelProgress)}</small></div>
          </div>
          <div className="paper-actions">
            <button className="secondary-paper-button" type="button" onClick={() => setMobilePanel("search")}>⌕ 检索论文</button>
            <button className="paper-upload" type="button" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
              <span>{extracting ? `${extractProgress}%` : "↑"}</span><strong>{extracting ? "正在解析" : "导入英文论文 PDF"}</strong><small>文件只在本地解析</small>
            </button>
            <input className="sr-only" ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={handlePdf} />
          </div>
        </div>
      </section>

      {message && <div className="paper-message" role="status"><span>●</span>{message}</div>}

      <div className="paper-mobile-tabs" role="tablist" aria-label="论文工作台面板">
        {(["library", "reader", "insight", "ai", "search"] as const).map((panel) => <button className={mobilePanel === panel ? "active" : ""} key={panel} onClick={() => setMobilePanel(panel)} type="button">{{ library: "论文库", reader: "阅读", insight: "提示", ai: "AI", search: "检索" }[panel]}</button>)}
      </div>

      <section className="paper-workbench">
        <aside className={`paper-library ${mobilePanel === "library" ? "mobile-visible" : ""}`}>
          <div className="library-title"><div><p>DEVICE LIBRARY</p><h2>我的论文库</h2></div><span>{library.length}</span></div>
          <div className="library-list">
            {library.length ? library.map((record) => {
              const progress = record.paragraphs.length ? Math.round(record.paragraphs.filter((item) => item.read).length / record.paragraphs.length * 100) : 0;
              return <article className={record.id === paper.id ? "active" : ""} key={record.id}>
                <button type="button" onClick={() => openPaper(record)}><span className="pdf-token">PDF</span><div><strong>{record.title}</strong><small>{record.paragraphs.length} 段 · 已读 {progress}%</small></div></button>
                <button className="paper-delete" type="button" aria-label={`删除 ${record.title}`} onClick={() => void removeFromLibrary(record)}>×</button>
              </article>;
            }) : <div className="library-empty"><strong>还没有保存的论文</strong><span>导入 PDF 后，翻译、笔记和进度会保存在当前 Edge 设备。</span></div>}
          </div>
          <div className="library-privacy"><strong>{cloudState === "ready" ? "云端记忆已同步" : cloudState === "checking" ? "正在检查账户" : cloudState === "error" ? "云同步暂不可用" : "设备端记忆"}</strong><p>{cloudState === "ready" ? "提取文本、译文、笔记和 AI 结果已按账户隔离同步；原始 PDF 仍不上传。" : "原始 PDF 不会保存；登录后可同步提取文本、译文、笔记与阅读进度。"}</p></div>
        </aside>

        <section className={`paper-reader ${mobilePanel === "reader" ? "mobile-visible" : ""}`}>
          <div className="reader-toolbar">
            <div className="paper-title-edit">
              <span>{paper.fileName}</span>
              <input aria-label="论文标题" value={paper.title} onChange={(event) => updatePaper((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="reader-controls">
              <button type="button" disabled={activeIndex === 0} onClick={() => updatePaper((current) => ({ ...current, activeParagraph: Math.max(0, activeIndex - 1) }))}>←</button>
              <span>{activeIndex + 1} / {paper.paragraphs.length}</span>
              <button type="button" disabled={activeIndex >= paper.paragraphs.length - 1} onClick={() => updatePaper((current) => ({ ...current, activeParagraph: Math.min(current.paragraphs.length - 1, activeIndex + 1) }))}>→</button>
            </div>
          </div>

          <div className="reader-progress"><i style={{ width: `${completion}%` }} /><span>{completion}% 已读</span></div>
          <div className="section-chips">{sections.map((section) => <button key={section} type="button" className={activeParagraph?.section === section ? "active" : ""} onClick={() => updatePaper((current) => ({ ...current, activeParagraph: current.paragraphs.findIndex((item) => item.section === section) }))}>{section}</button>)}</div>

          {activeParagraph ? <div className="active-paragraph">
            <div className="paragraph-meta"><span>PAGE {activeParagraph.page}</span><strong>{activeParagraph.section}</strong><button className={activeParagraph.bookmarked ? "bookmarked" : ""} type="button" onClick={() => updateActiveParagraph({ bookmarked: !activeParagraph.bookmarked })}>{activeParagraph.bookmarked ? "★ 已收藏" : "☆ 收藏"}</button></div>
            <div className="reader-labels"><span>ENGLISH ORIGINAL</span><span>简体中文 · 设备端翻译</span></div>
            <div className="bilingual-active">
              <article lang="en"><p>{activeParagraph.original}</p></article>
              <article lang="zh-CN">
                {activeParagraph.translation ? <p>{activeParagraph.translation}</p> : <div className="translation-placeholder"><strong>尚未翻译</strong><span>使用 Edge 内置模型，内容不会离开设备。</span><button type="button" disabled={translationState === "unsupported" || translationState === "working"} onClick={() => void translateParagraphs("current")}>翻译当前段落</button></div>}
              </article>
            </div>
            <div className="paragraph-actions">
              <button className={activeParagraph.read ? "done" : ""} type="button" onClick={() => updateActiveParagraph({ read: !activeParagraph.read })}>{activeParagraph.read ? "✓ 已读" : "标记为已读"}</button>
              <button type="button" onClick={() => setMobilePanel("ai")}>DeepSeek 增强</button>
              <button type="button" disabled={translationState === "unsupported" || translationState === "working"} onClick={() => void translateParagraphs("all")}>{translationState === "working" ? `翻译中 ${translationProgress}%` : "翻译全部未译段落"}</button>
            </div>
          </div> : <div className="paper-empty"><strong>未识别到正文段落</strong><p>请尝试文本型 PDF；扫描版论文将在后续版本加入 OCR。</p></div>}
        </section>

        <aside className={`paper-insights ${mobilePanel === "insight" ? "mobile-visible" : ""}`}>
          <div className="insight-head"><p>PARAGRAPH GUIDE</p><h2>段落提示</h2><span>非 AI · 规则识别</span></div>
          {insight && <>
            <article className="role-card"><span>段落作用</span><strong>{insight.role}</strong><p>{insight.explanation}</p></article>
            <article><span>统计线索</span>{insight.terms.length ? <div className="term-list">{insight.terms.map((term) => <b key={term}>{term}</b>)}</div> : <p>未识别到常见统计术语。</p>}</article>
            <article className="check-card"><span>阅读检查</span><ul>{insight.questions.map((question) => <li key={question}>{question}</li>)}</ul></article>
            <article className="note-card"><span>我的笔记</span><textarea aria-label="段落笔记" value={activeParagraph.note} placeholder="记录重点、疑问或自己的解释……" onChange={(event) => updateActiveParagraph({ note: event.target.value })} /></article>
          </>}
        </aside>

        <AiStudio
          paper={paper}
          activeParagraph={activeParagraph}
          activeIndex={activeIndex}
          mobileVisible={mobilePanel === "ai"}
          onSave={(aiMemory: AiMemory) => updatePaper((current) => ({ ...current, aiMemory }))}
          onTranslation={(translation) => updateActiveParagraph({ translation })}
          onSearchQuery={(query) => setSearchQuery(query)}
        />

        <section className={`paper-search ${mobilePanel === "search" ? "mobile-visible" : ""}`}>
          <div className="search-head"><div><p>OPEN SCHOLARLY INDEX</p><h2>相关论文检索</h2></div><span>免密钥</span></div>
          <div className="paper-search-box"><input aria-label="论文检索关键词" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchPapers(); }} /><button type="button" onClick={() => void searchPapers()} disabled={searching}>{searching ? "检索中…" : "检索相关论文"}</button></div>
          <p className="search-source">{searchMessage || "输入标题、DOI 或关键词，从公共学术索引查找真实论文。"}</p>
          <div className="search-results">
            {searchResults.map((result) => <article key={`${result.source}-${result.id}`}>
              <div className="result-topline"><span>{result.source}</span><small>{result.year ?? "年份未知"} · 被引 {result.citationCount}</small></div>
              <h3>{result.title}</h3>
              <p className="result-authors">{result.authors.slice(0, 4).join(", ") || "作者信息缺失"}{result.authors.length > 4 ? " 等" : ""}</p>
              {result.abstract && <p className="result-abstract">{result.abstract}</p>}
              <div className="result-links">{result.url && <a href={result.url} target="_blank" rel="noreferrer">查看来源 ↗</a>}{result.pdfUrl && <a href={result.pdfUrl} target="_blank" rel="noreferrer">开放 PDF</a>}{result.doi && <button type="button" onClick={() => void navigator.clipboard.writeText(result.doi)}>复制 DOI</button>}</div>
            </article>)}
            {!searchResults.length && !searching && <div className="search-empty"><span>⌕</span><strong>从当前论文开始发现</strong><p>检索结果会展示来源、作者、年份、引用次数和开放全文入口。</p></div>}
          </div>
        </section>
      </section>
      </section>
    </main>
  );
}

function getTranslatorFactory() {
  return (globalThis as typeof globalThis & { Translator?: TranslatorFactory }).Translator;
}

function translatorStatusLabel(state: TranslationState, isEdge: boolean) {
  if (state === "checking") return "正在检查本地翻译";
  if (state === "unsupported") return "当前环境不支持本地翻译";
  if (state === "downloadable") return "翻译模型可下载";
  if (state === "working") return "设备端翻译进行中";
  if (state === "done") return "本地翻译已完成";
  if (state === "error") return "本地翻译遇到问题";
  return isEdge ? "Edge 本地翻译可用" : "浏览器本地翻译可用";
}

function translationStatusDetail(state: TranslationState, modelProgress: number) {
  if (state === "unsupported") return "请使用最新版桌面 Edge";
  if (state === "downloadable") return "首次翻译时下载语言模型";
  if (state === "working" && modelProgress) return `模型下载 ${modelProgress}%`;
  if (state === "working") return "论文内容不会离开设备";
  return "EN → 简体中文 · 无需 API Key";
}

async function extractPdf(file: File, onProgress: (progress: number) => void): Promise<PaperRecord> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const buffer = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  const paragraphs: Paragraph[] = [];
  let currentSection = "Introduction";
  let inferredTitle = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item && typeof item.str === "string" && Array.isArray(item.transform))
      .map((item) => ({ text: item.str.trim(), x: item.transform[4] ?? 0, y: Math.round(item.transform[5] ?? 0) }))
      .filter((item) => item.text);
    const lineMap = new Map<number, { text: string; x: number }[]>();
    items.forEach((item) => lineMap.set(item.y, [...(lineMap.get(item.y) ?? []), { text: item.text, x: item.x }]));
    const lines = [...lineMap.entries()]
      .sort(([left], [right]) => right - left)
      .map(([, line]) => line.sort((left, right) => left.x - right.x).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (pageNumber === 1) {
      const titleCandidate = lines.find((line) => line.length >= 24 && line.length <= 220 && !/abstract|doi|journal|university|department/i.test(line));
      if (titleCandidate) inferredTitle = titleCandidate;
    }

    let accumulator = "";
    for (const line of lines) {
      const section = detectSection(line);
      if (section) {
        if (accumulator.length > 80) paragraphs.push(makeParagraph(accumulator, pageNumber, currentSection));
        accumulator = "";
        currentSection = section;
        continue;
      }
      if (/^(references|acknowledg(e)?ments|supplementary materials?)$/i.test(line)) break;
      accumulator = `${accumulator} ${line}`.trim();
      if (accumulator.length > 520 && /[.!?)]$/.test(line)) {
        paragraphs.push(makeParagraph(accumulator, pageNumber, currentSection));
        accumulator = "";
      }
    }
    if (accumulator.length > 80) paragraphs.push(makeParagraph(accumulator, pageNumber, currentSection));
    onProgress(Math.round((pageNumber / document.numPages) * 100));
  }

  const filtered = paragraphs.filter((paragraph) => paragraph.original.length >= 80 && !/©|all rights reserved|downloaded from/i.test(paragraph.original));
  if (!filtered.length) throw new Error("没有识别到可阅读文本。扫描版 PDF 暂不支持，请使用带文本层的论文。" );
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    title: inferredTitle,
    addedAt: now,
    updatedAt: now,
    activeParagraph: 0,
    paragraphs: filtered,
  };
}

function makeParagraph(original: string, page: number, section: string): Paragraph {
  return { id: crypto.randomUUID(), page, section, original: original.replace(/\s+/g, " ").trim(), translation: "", note: "", bookmarked: false, read: false };
}

function detectSection(line: string) {
  const normalized = line.replace(/^\d+[.)]?\s*/, "").trim();
  const sections: [RegExp, string][] = [
    [/^abstract$/i, "Abstract"],
    [/^(introduction|background)$/i, "Introduction"],
    [/^(methods?|materials and methods?|methodology|study design)$/i, "Methods"],
    [/^results?$/i, "Results"],
    [/^(discussion|discussion and conclusions?)$/i, "Discussion"],
    [/^conclusions?$/i, "Conclusion"],
  ];
  return sections.find(([pattern]) => pattern.test(normalized))?.[1] ?? "";
}

function analyzeParagraph(paragraph: Paragraph) {
  const text = paragraph.original;
  const terms = [
    ["p-value", /p\s*[<=>]\s*0?\.\d+|p[- ]value/i],
    ["置信区间", /confidence interval|\bCI\b/i],
    ["回归", /regression|odds ratio|hazard ratio/i],
    ["效应量", /effect size|cohen'?s d/i],
    ["交叉验证", /cross[- ]validation/i],
    ["随机化", /randomi[sz]/i],
    ["样本量", /sample size|participants?|subjects?|patients?/i],
    ["AUC / ROC", /\bAUC\b|receiver operating characteristic|\bROC\b/i],
    ["显著性", /statistical(?:ly)? significant|significance/i],
  ].filter(([, pattern]) => (pattern as RegExp).test(text)).map(([label]) => label as string);
  let role = "背景与论述";
  let explanation = "这一段主要提供研究背景、概念或作者的论证。";
  if (/method|procedure|measured|assessed|model|analysis|estimated/i.test(text) || paragraph.section === "Methods") {
    role = "研究方法";
    explanation = "这一段说明研究如何设计、测量或分析，应重点检查可重复性和方法假设。";
  } else if (/result|associated|increased|decreased|95%|p\s*[<=>]/i.test(text) || paragraph.section === "Results") {
    role = "结果报告";
    explanation = "这一段报告数据结果，应区分统计显著性、效应大小与实际意义。";
  } else if (/suggest|indicat|therefore|conclu|implication/i.test(text) || /Discussion|Conclusion/.test(paragraph.section)) {
    role = "解释与结论";
    explanation = "这一段解释研究发现，应检查结论是否超出了研究设计和证据范围。";
  }
  const questions = role === "研究方法"
    ? ["样本来源与纳入标准是否清楚？", "分析方法的假设是否得到检查？", "训练、验证与测试数据是否严格分离？"]
    : role === "结果报告"
      ? ["是否同时报告效应量和不确定性？", "统计显著是否等于实际重要？", "是否存在多重比较问题？"]
      : role === "解释与结论"
        ? ["因果措辞是否与研究设计匹配？", "是否讨论替代解释和局限？", "结论能否推广到其他人群？"]
        : ["这段支持哪个研究问题？", "作者引用了什么证据？", "关键概念是否有明确定义？"];
  return { role, explanation, terms, questions };
}
