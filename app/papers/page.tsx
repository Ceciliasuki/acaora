"use client";

import AppSidebar from "../components/app-sidebar";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { acknowledgePaperSyncOperation, applyPaperSyncSnapshot, deletePaper, deletePaperAndQueue, getPaperLibrary, getPaperSyncOperations, reschedulePaperSyncOperation, savePaper, savePaperAndQueue } from "./paper-storage";
import AiStudio from "./ai-studio";
import type { AiMemory, PaperRecord, PaperSyncOperation, Paragraph, SearchPaper } from "./paper-types";
import { samplePaper } from "./paper-types";
import { authFetch } from "../lib/auth-client";
import { flushPaperSyncQueue, reconcileSnapshot } from "./paper-sync.mjs";
import type { RetryDecision } from "./paper-sync.mjs";

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
  /* A search has three distinct endings — results, a settled empty answer, and a
     failure — and they must not render as one another. */
  const [searchError, setSearchError] = useState("");
  const [searchSettled, setSearchSettled] = useState(false);
  /* A device-library read is a real operation that can really fail; when it does
     the count is unknown rather than zero, and the reader can retry the read. */
  const [libraryError, setLibraryError] = useState("");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const [cloudState, setCloudState] = useState<"checking" | "guest" | "syncing" | "offline" | "ready" | "error">("checking");
  const cloudStateRef = useRef(cloudState);
  const signedInRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const syncNowRef = useRef<() => void>(() => undefined);
  const skipPersistRef = useRef(false);
  const dirtyRef = useRef(false);
  const [mobilePanel, setMobilePanel] = useState<"reader" | "library" | "insight" | "ai" | "search">("reader");

  const activeIndex = Math.min(paper.activeParagraph, Math.max(0, paper.paragraphs.length - 1));
  const activeParagraph = paper.paragraphs[activeIndex];
  const sections = useMemo(() => [...new Set(paper.paragraphs.map((item) => item.section))], [paper.paragraphs]);
  const completion = paper.paragraphs.length
    ? Math.round((paper.paragraphs.filter((item) => item.read).length / paper.paragraphs.length) * 100)
    : 0;
  const insight = activeParagraph ? analyzeParagraph(activeParagraph) : null;
  const isEdge = typeof navigator !== "undefined" && /Edg\//.test(navigator.userAgent);

  const setCloudStatus = useCallback((next: typeof cloudState) => {
    cloudStateRef.current = next;
    setCloudState(next);
  }, []);

  const refreshCloud = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) throw new Error("账户尚未就绪。");
    const response = await authFetch("/api/cloud/papers");
    if (!response.ok) throw new Error("无法获取云端论文记忆。");
    if (userIdRef.current !== userId) throw new Error("账户已切换。");
    const cloud = await response.json() as { papers?: PaperRecord[]; deletions?: Array<{ id: string; deletedAt: number }> };
    const result = reconcileSnapshot({
      localPapers: await getPaperLibrary(userId),
      cloudPapers: (cloud.papers ?? []).map((paper) => ({ ...paper, ownerId: userId })),
      deletions: cloud.deletions ?? [],
      pending: await getPaperSyncOperations(userId),
    });
    await applyPaperSyncSnapshot(userId, result.papers, result.pending);
    setLibrary(result.papers);
    setPaper((current) => {
      const next = result.papers.find((item) => item.id === current.id) ?? result.papers[0] ?? samplePaper;
      if (next !== current) skipPersistRef.current = true;
      return next;
    });
    return result.papers;
  }, []);

  const syncNow = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    setCloudStatus(navigator.onLine ? "syncing" : "offline");
    try {
      await flushPaperSyncQueue({
        online: () => navigator.onLine,
        now: () => Date.now(),
        list: () => getPaperSyncOperations(userId),
        send: async (operation: PaperSyncOperation) => {
          try {
            if (userIdRef.current !== userId) return { status: 401 };
            const sessionResponse = await authFetch("/api/auth/session");
            if (!sessionResponse.ok) return { status: 401 };
            const session = await sessionResponse.json() as { user?: { id: string } | null };
            if (session.user?.id !== userId) return { status: 401 };
            const cloudPaper = operation.type === "upsert" ? { ...operation.paper } : null;
            if (cloudPaper) delete cloudPaper.ownerId;
            const response = operation.type === "delete"
              ? await authFetch(`/api/cloud/papers?id=${encodeURIComponent(operation.id)}`, { method: "DELETE" })
              : await authFetch("/api/cloud/papers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cloudPaper) });
            return { status: response.status };
          } catch { return { status: 503 }; }
        },
        acknowledge: async (_id: string, operation: PaperSyncOperation) => { await acknowledgePaperSyncOperation(operation); },
        reschedule: async (next: PaperSyncOperation, sent: PaperSyncOperation) => { await reschedulePaperSyncOperation(sent, next); },
        refreshCloud: async (conflicted: PaperSyncOperation) => {
          if (userIdRef.current !== userId) return;
          await refreshCloud();
          const stillPending = (await getPaperSyncOperations(userId)).some((operation) =>
            operation.id === conflicted.id && operation.type === conflicted.type && operation.updatedAt === conflicted.updatedAt);
          if (stillPending) setCloudStatus("error");
        },
        onState: (decision: RetryDecision) => {
          if (userIdRef.current !== userId) return;
          if (decision === "pause-offline") setCloudStatus("offline");
          else if (decision === "pause-auth" || decision === "non-retryable") setCloudStatus("error");
        },
      });
      if (userIdRef.current !== userId) return;
      const pending = await getPaperSyncOperations(userId);
      const retryable = pending.filter((operation) => operation.type === "delete" || !operation.blockedReason);
      if (!pending.length && !dirtyRef.current) setCloudStatus("ready");
      else if (!pending.length) setCloudStatus("syncing");
      else if (!navigator.onLine) setCloudStatus("offline");
      else if (!retryable.length) setCloudStatus("error");
      else {
        const nextAttemptAt = Math.min(...retryable.map((operation) => operation.nextAttemptAt));
        if (nextAttemptAt > Date.now()) {
          setCloudStatus("error");
          retryTimerRef.current = window.setTimeout(() => syncNowRef.current(), Math.min(nextAttemptAt - Date.now(), 60_000));
        } else if (cloudStateRef.current !== "error") {
          setCloudStatus("syncing");
          retryTimerRef.current = window.setTimeout(() => syncNowRef.current(), 0);
        }
      }
    } catch {
      if (userIdRef.current === userId) setCloudStatus(navigator.onLine ? "error" : "offline");
    }
  }, [refreshCloud, setCloudStatus]);

  useEffect(() => {
    syncNowRef.current = () => { void syncNow(); };
  }, [syncNow]);

  useEffect(() => {
    void (async () => {
      setLibraryError("");
      try {
        const sessionResponse = await authFetch("/api/auth/session");
        if (!sessionResponse.ok) throw new Error("账户状态不可用。");
        const session = await sessionResponse.json() as { user?: { id: string } | null };
        signedInRef.current = Boolean(session.user);
        userIdRef.current = session.user?.id ?? null;
        let records: PaperRecord[];
        try {
          records = await getPaperLibrary(userIdRef.current);
        } catch {
          /* The device store itself could not be read: that is a failure, not an
             empty library, so the index reports it instead of showing "0 篇". */
          setLibraryError("无法读取本机论文库。本次没有删除或覆盖任何记录，可以重试读取。");
          setCloudStatus(navigator.onLine ? "error" : "offline");
          return;
        }
        if (session.user) {
          records = await refreshCloud();
          void syncNow();
        } else {
          const guestRecords = await getPaperLibrary();
          setLibrary(guestRecords);
          skipPersistRef.current = true;
          setPaper(guestRecords[0] ?? samplePaper);
          setCloudStatus("guest");
        }
        setLibrary(records);
        if (records.length) {
          skipPersistRef.current = true;
          setPaper(records[0]);
          setSearchQuery(records[0].title);
        }
      } catch {
        setLibraryError("无法读取论文库状态。请检查网络或账户状态后重试。");
        setCloudStatus(navigator.onLine ? "error" : "offline");
      } finally {
        setHydrated(true);
      }
    })();
  }, [hydrationAttempt, refreshCloud, setCloudStatus, syncNow]);

  useEffect(() => {
    const offline = () => {
      if (["ready", "syncing"].includes(cloudStateRef.current)) setCloudStatus("offline");
    };
    const online = () => {
      void syncNow();
    };
    const authChanged = () => {
      void authFetch("/api/auth/session").then(async (response) => {
        if (!response.ok) return;
        const session = await response.json() as { user?: { id: string } | null };
        signedInRef.current = Boolean(session.user);
        userIdRef.current = session.user?.id ?? null;
        dirtyRef.current = false;
        if (session.user) {
          await refreshCloud();
          void syncNow();
        } else setCloudStatus("guest");
      }).catch(() => setCloudStatus("error"));
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("acaora:auth-change", authChanged);
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("acaora:auth-change", authChanged);
      if (retryTimerRef.current !== null) window.clearTimeout(retryTimerRef.current);
    };
  }, [refreshCloud, setCloudStatus, syncNow]);

  useEffect(() => {
    const factory = getTranslatorFactory();
    if (!factory) {
      void Promise.resolve().then(() => setTranslationState("unsupported"));
      return;
    }
    void factory.availability({ sourceLanguage: "en", targetLanguage: "zh" })
      .then((availability) => setTranslationState(availability === "unavailable" ? "unsupported" : availability === "available" ? "ready" : "downloadable"))
      .catch(() => setTranslationState("unsupported"));
    return () => translatorRef.current?.destroy?.();
  }, []);

  useEffect(() => {
    if (!hydrated || paper.id === samplePaper.id) return;
    if ((paper.ownerId ?? null) !== userIdRef.current) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      const updated = { ...paper, ownerId: userIdRef.current ?? undefined, updatedAt: Date.now() };
      const persist = signedInRef.current ? savePaperAndQueue(updated) : savePaper(updated);
      void persist.then(() => {
        dirtyRef.current = false;
        setLibrary((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        if (signedInRef.current) void syncNow();
      }).catch(() => setCloudStatus("error"));
    }, 450);
    return () => window.clearTimeout(handle);
  }, [paper, hydrated, setCloudStatus, syncNow]);

  function updatePaper(updater: (current: PaperRecord) => PaperRecord) {
    if (userIdRef.current) {
      dirtyRef.current = true;
      setCloudStatus("syncing");
    }
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
      skipPersistRef.current = true;
      setPaper(extracted);
      setSearchQuery(extracted.title);
      if (signedInRef.current) {
        extracted.ownerId = userIdRef.current ?? undefined;
        await savePaperAndQueue(extracted);
      }
      else await savePaper(extracted);
      setLibrary((current) => [extracted, ...current.filter((item) => item.id !== extracted.id)]);
      setMessage(`已读取 ${extracted.paragraphs.length} 个段落，原始 PDF 未上传。`);
      setMobilePanel("reader");
      if (signedInRef.current) void syncNow();
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
    if (query.length < 3) {
      setSearchResults([]);
      setSearchMessage("");
      setSearchError("请输入至少三个字符后再检索。");
      setSearchSettled(true);
      setMobilePanel("search");
      return;
    }
    setSearching(true);
    setSearchResults([]);
    setSearchMessage("");
    setSearchError("");
    setSearchSettled(false);
    try {
      const response = await fetch(`/api/papers/search?q=${encodeURIComponent(query)}`);
      const payload = await response.json() as { error?: string; papers?: SearchPaper[]; source?: string };
      if (!response.ok) throw new Error(payload.error ?? "检索失败。" );
      const normalizedTitle = paper.title.toLowerCase();
      /* The list the reader actually sees is the list that is counted: the paper
         already open in the reader is not repeated as a discovery result. */
      const discovered = (payload.papers ?? []).filter((result) => result.title.toLowerCase() !== normalizedTitle);
      setSearchResults(discovered);
      setSearchMessage(`来自 ${payload.source ?? "公共学术索引"} · ${discovered.length} 条结果`);
      setSearchSettled(true);
      setMobilePanel("search");
    } catch (error) {
      setSearchResults([]);
      setSearchMessage("");
      setSearchError(error instanceof Error ? error.message : "检索失败。" );
      setSearchSettled(true);
    } finally {
      setSearching(false);
    }
  }

  async function removeFromLibrary(record: PaperRecord) {
    const confirmation = signedInRef.current
      ? `从所有设备删除“${record.title}”的论文记忆？原始 PDF 不受影响；提取文本、翻译、笔记、阅读进度和 AI 结果将被删除。`
      : `从当前设备删除“${record.title}”的论文记忆？原始 PDF 不受影响。`;
    if (!window.confirm(confirmation)) return;
    try {
      if (signedInRef.current && userIdRef.current) await deletePaperAndQueue(record.id, Date.now(), userIdRef.current);
      else await deletePaper(record.id);
      const remaining = library.filter((item) => item.id !== record.id);
      setLibrary(remaining);
      if (paper.id === record.id) {
        skipPersistRef.current = true;
        setPaper(remaining[0] ?? samplePaper);
      }
      if (signedInRef.current) {
        setMessage(navigator.onLine ? "论文记忆已从当前设备删除，云端删除正在同步。" : "论文记忆已从当前设备删除，云端删除等待同步。");
        void syncNow();
      }
    } catch { setMessage("删除未完成，请重试。" ); }
  }

  function openPaper(record: PaperRecord) {
    setPaper(record);
    setSearchQuery(record.title);
    setMobilePanel("reader");
  }

  return (
    <main className="student-app paper-layout">
      <AppSidebar active="papers" profileTitle="PaperLab 工作台" profileSubtitle={cloudState === "ready" ? "论文记忆已同步" : cloudState === "syncing" ? "正在同步论文记忆" : "本地研究模式"} />
      <section className="student-main plab-shell">
      {/* Running head: the surface's own line, then only the tools that act on the
          library. The numeric register that used to sit here was removed because
          every value in it is already printed where it belongs: the library count in
          the index, the paragraph position and reading progress in the reader, the
          sync state beside the library, and the privacy facts in the colophon. */}
      <header className="plab-head">
        <div className="plab-head-id">
          <h1>论文阅读与分析</h1>
          <p>阅读、标注与设备端翻译</p>
        </div>
        <div className="plab-head-tools">
          <div className={`translator-status state-${translationState}`}>
            <i />
            <div><strong>{translatorStatusLabel(translationState, isEdge)}</strong><small>{translationStatusDetail(translationState, modelProgress)}</small></div>
          </div>
          <button className="plab-tool" type="button" onClick={() => setMobilePanel("search")}>检索论文</button>
          <button className="plab-tool plab-tool--primary" type="button" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
            {extracting ? `解析中 ${extractProgress}%` : "导入 PDF"}
          </button>
          <input className="sr-only" ref={fileInputRef} type="file" accept="application/pdf,.pdf" aria-label="导入英文论文 PDF" onChange={handlePdf} />
        </div>
      </header>

      {message && <div className="paper-message" role="status"><span>●</span>{message}</div>}

      <div className="paper-mobile-tabs" role="tablist" aria-label="论文工作台面板">
        {(["library", "reader", "insight", "ai", "search"] as const).map((panel) => <button role="tab" aria-selected={mobilePanel === panel} className={mobilePanel === panel ? "active" : ""} key={panel} onClick={() => setMobilePanel(panel)} type="button">{{ library: "论文库", reader: "阅读", insight: "提示", ai: "AI", search: "检索" }[panel]}</button>)}
      </div>

      <section className="plab-workbench">
        {!hydrated ? <ReadingSkeleton /> : <>
        {/* 1 · Library Index. An archival index rather than a dark sidebar: ruled
            rows, the title as the entry, and the reader's own progress beneath it.
            The row keeps its two real controls (open, delete) unchanged. */}
        <aside className={`plab-index ${mobilePanel === "library" ? "mobile-visible" : ""}`}>
          <div className="plab-index-head">
            <h2>论文库</h2>
            {/* An unread store has no count, so the index prints an absence rather
                than a zero that would claim the library is empty. */}
            <span className="journal-num">{libraryError ? "—" : library.length}</span>
          </div>
          {libraryError ? <p className="plab-index-error" role="alert">
            {libraryError}
            <button className="plab-index-retry" type="button" onClick={() => { setLibraryError(""); setHydrated(false); setHydrationAttempt((attempt) => attempt + 1); }}>重试读取</button>
          </p> : null}
          <div className="plab-index-list">
            {!libraryError && (library.length ? library.map((record) => {
              const progress = record.paragraphs.length ? Math.round(record.paragraphs.filter((item) => item.read).length / record.paragraphs.length * 100) : 0;
              const current = record.id === paper.id;
              return <article className={current ? "plab-index-row plab-index-row--current" : "plab-index-row"} key={record.id}>
                <button className="plab-index-open" type="button" onClick={() => openPaper(record)}>
                  <strong>{record.title}</strong>
                  <small className="journal-num">{record.paragraphs.length} 段 · 已读 {progress}%</small>
                </button>
                <button className="plab-index-delete" type="button" aria-label={`删除 ${record.title}`} onClick={() => void removeFromLibrary(record)}>×</button>
              </article>;
            }) : <div className="plab-index-empty"><strong>还没有保存的论文</strong><span>导入 PDF 后，翻译、笔记和进度会保存在当前 Edge 设备。</span></div>)}
          </div>
          <div className="library-privacy"><strong>{{ ready: "云端记忆已同步", syncing: "正在同步更改", checking: "正在检查账户", error: "云同步暂不可用", offline: "当前离线", guest: "设备端记忆" }[cloudState]}</strong><p>{cloudState === "ready" || cloudState === "syncing" ? "提取文本、译文、笔记和 AI 结果已按账户隔离同步；原始 PDF 仍不上传。" : cloudState === "offline" ? "修改保存在当前设备；网络恢复后会继续同步。" : "原始 PDF 不会保存；登录后可同步提取文本、译文、笔记与阅读进度。"}</p></div>
        </aside>

        {/* 2 · Publication Reader. One sheet of paper carries the paper itself: the
            section line, the paragraph's number in the margin, the original as the
            publication body and the device translation as its secondary layer. All
            of the reader's real controls survive — the editable title, the file
            name, paragraph stepping, bookmarks, the read toggle and translation. */}
        <section className={`plab-reader ${mobilePanel === "reader" ? "mobile-visible" : ""}`}>
          <div className="plab-reader-bar">
            <div className="paper-title-edit">
              <span className="journal-num">{paper.fileName}</span>
              <input aria-label="论文标题" value={paper.title} onChange={(event) => updatePaper((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="reader-controls">
              <button type="button" aria-label="上一段" disabled={activeIndex === 0} onClick={() => updatePaper((current) => ({ ...current, activeParagraph: Math.max(0, activeIndex - 1) }))}>←</button>
              <span className="journal-num">{activeIndex + 1} / {paper.paragraphs.length}</span>
              <button type="button" aria-label="下一段" disabled={activeIndex >= paper.paragraphs.length - 1} onClick={() => updatePaper((current) => ({ ...current, activeParagraph: Math.min(current.paragraphs.length - 1, activeIndex + 1) }))}>→</button>
            </div>
            <div className="plab-reader-progress">
              <b className="journal-num">{completion}% 已读</b>
              <i style={{ width: `${completion}%` }} />
            </div>
          </div>

          <div className="plab-reader-scroll">
            {sections.length > 0 && <div className="section-chips">{sections.map((section) => <button key={section} type="button" className={activeParagraph?.section === section ? "active" : ""} onClick={() => updatePaper((current) => ({ ...current, activeParagraph: current.paragraphs.findIndex((item) => item.section === section) }))}>{section}</button>)}</div>}

            {activeParagraph ? <article className="plab-page">
              {/* The marginal marker carries the same number the annotation rail
                  opens with, so the reader's position and the rail are one object. */}
              <div className="plab-page-meta">
                <span className="plab-page-mark journal-num">{String(activeIndex + 1).padStart(2, "0")}</span>
                <span className="journal-num">PAGE {activeParagraph.page}</span>
                <strong>{activeParagraph.section}</strong>
                <button className={activeParagraph.bookmarked ? "plab-bookmark plab-bookmark--on" : "plab-bookmark"} type="button" onClick={() => updateActiveParagraph({ bookmarked: !activeParagraph.bookmarked })}>{activeParagraph.bookmarked ? "★ 已收藏" : "☆ 收藏"}</button>
              </div>
              <div className="plab-body">
                <span className="plab-layer-label">原文 · ENGLISH ORIGINAL</span>
                <p>{activeParagraph.original}</p>
              </div>
              <div className="plab-translation">
                <span className="plab-layer-label">简体中文 · 设备端翻译</span>
                {activeParagraph.translation ? <p>{activeParagraph.translation}</p> : <div className="translation-placeholder"><strong>尚未翻译</strong><span>使用 Edge 内置模型，内容不会离开设备。</span><button type="button" disabled={translationState === "unsupported" || translationState === "working"} onClick={() => void translateParagraphs("current")}>翻译当前段落</button></div>}
              </div>
              <div className="paragraph-actions">
                <button className={activeParagraph.read ? "done" : ""} type="button" onClick={() => updateActiveParagraph({ read: !activeParagraph.read })}>{activeParagraph.read ? "✓ 已读" : "标记为已读"}</button>
                <button type="button" onClick={() => setMobilePanel("ai")}>DeepSeek 增强</button>
                <button type="button" disabled={translationState === "unsupported" || translationState === "working"} onClick={() => void translateParagraphs("all")}>{translationState === "working" ? `翻译中 ${translationProgress}%` : "翻译全部未译段落"}</button>
              </div>
            </article> : <div className="paper-empty"><strong>未识别到正文段落</strong><p>请尝试文本型 PDF；扫描版论文将在后续版本加入 OCR。</p></div>}
          </div>
        </section>

        {/* 3 · Margin Annotation Rail. The old right-hand panel becomes the page's
            margin: numbered blocks, each one a fact the product already knows about
            the active paragraph. Nothing is invented — no citation count, no
            summary, no score — and the first block carries the same number as the
            reader's marginal marker, so the reader and the rail read as one page. */}
        <aside className={`plab-rail ${mobilePanel === "insight" ? "mobile-visible" : ""}`}>
          <div className="plab-rail-head">
            <h2>页边注释</h2>
            <span>非 AI · 规则识别</span>
          </div>
          {activeParagraph && <div className="plab-rail-block">
            <p className="plab-rail-num journal-num">{String(activeIndex + 1).padStart(2, "0")}</p>
            <h3>当前段落</h3>
            <dl className="plab-rail-meta">
              <div><dt>页码</dt><dd className="journal-num">P{activeParagraph.page}</dd></div>
              <div><dt>章节</dt><dd>{activeParagraph.section}</dd></div>
              <div><dt>状态</dt><dd>{activeParagraph.read ? "已读" : "未读"}</dd></div>
            </dl>
          </div>}
          {insight && <>
            <div className="plab-rail-block">
              <h3>段落作用</h3>
              <strong className="plab-rail-role">{insight.role}</strong>
              <p>{insight.explanation}</p>
            </div>
            <div className="plab-rail-block">
              <h3>统计线索</h3>
              {insight.terms.length ? <div className="term-list">{insight.terms.map((term) => <b key={term}>{term}</b>)}</div> : <p>未识别到常见统计术语。</p>}
            </div>
            <div className="plab-rail-block">
              <h3>阅读检查</h3>
              <ul className="plab-rail-questions">{insight.questions.map((question) => <li key={question}>{question}</li>)}</ul>
            </div>
          </>}
          {activeParagraph && <div className="plab-rail-block">
            <h3>我的笔记</h3>
            <textarea aria-label="段落笔记" value={activeParagraph.note} placeholder="记录重点、疑问或自己的解释……" onChange={(event) => updateActiveParagraph({ note: event.target.value })} />
          </div>}
        </aside>
        </>}
      </section>

        {hydrated ? <AiStudio
          paper={paper}
          activeParagraph={activeParagraph}
          activeIndex={activeIndex}
          mobileVisible={mobilePanel === "ai"}
          onSave={(aiMemory: AiMemory) => updatePaper((current) => ({ ...current, aiMemory }))}
          onTranslation={(translation) => updateActiveParagraph({ translation })}
          onSearchQuery={(query) => {
            setSearchQuery(query);
            setSearchResults([]);
            setSearchMessage("");
            setSearchError("");
            setSearchSettled(false);
          }}
        /> : <AiConsoleSkeleton />}

        {/* Scholarly Discovery Index: the page's lowest-weight research tool. It is
            a bibliography, not a search product: one query field, ruled records, and
            four endings that never impersonate one another. */}
        {hydrated ? <section className={`plab-discovery ${mobilePanel === "search" ? "mobile-visible" : ""}`}>
          <div className="plab-discovery-head">
            <h2>学术检索索引</h2>
            <p className="plab-discovery-note">公共学术索引（Semantic Scholar，失败时回退 Crossref），不需要密钥。AI 控制台的「检索策略」会把生成的检索式填进下面的输入框。</p>
          </div>

          <form className="plab-query" onSubmit={(event) => { event.preventDefault(); void searchPapers(); }}>
            <label className="plab-query-field">
              <span>检索式</span>
              <input
                aria-label="论文检索关键词"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="标题、DOI 或关键词（至少三个字符）"
                name="paper-query"
                autoComplete="off"
              />
            </label>
            <button className="plab-query-submit" type="submit" disabled={searching}>{searching ? "检索中…" : "检索"}</button>
          </form>

          {searching ? <SearchLoadingSkeleton /> : null}
          {!searching && searchError ? <p className="plab-discovery-error" role="alert">
            {searchError}
            <button className="plab-discovery-retry" type="button" onClick={() => void searchPapers()}>重新检索</button>
          </p> : null}
          {!searching && !searchError && searchSettled && !searchResults.length ? <p className="plab-discovery-empty">没有匹配的记录。可以换成英文关键词，或改用论文的 DOI 再试一次。</p> : null}
          {!searching && !searchError && !searchSettled ? <p className="plab-discovery-idle">输入检索式后开始检索。每条记录只显示索引真实提供的字段：题名、作者、年份、来源、引用次数与可用的开放全文入口。</p> : null}
          {searchMessage ? <p className="plab-discovery-source">{searchMessage}</p> : null}

          {searchResults.length ? <ol className="plab-records">
            {searchResults.map((result, index) => <li className="plab-record" key={`${result.source}-${result.id}`}>
              <p className="plab-record-line">
                <span className="plab-record-num journal-num">{String(index + 1).padStart(2, "0")}</span>
                <span className="plab-record-source">{result.source}</span>
                {result.year !== null ? <span className="plab-record-year journal-num">{result.year}</span> : null}
                {result.citationCount > 0 ? <span className="plab-record-cites journal-num">被引 {result.citationCount}</span> : null}
                {result.venue ? <span className="plab-record-venue">{result.venue}</span> : null}
              </p>
              <h3 className="plab-record-title">{result.title}</h3>
              {result.authors.length ? <p className="plab-record-authors">{result.authors.slice(0, 4).join(", ")}{result.authors.length > 4 ? " 等" : ""}</p> : null}
              {result.abstract ? <p className="plab-record-abstract">{result.abstract}</p> : null}
              {(result.url || result.pdfUrl || result.doi) ? <p className="plab-record-actions">
                {result.url ? <a href={result.url} target="_blank" rel="noreferrer">查看来源 ↗</a> : null}
                {result.pdfUrl ? <a href={result.pdfUrl} target="_blank" rel="noreferrer">开放全文 ↗</a> : null}
                {result.doi ? <button type="button" onClick={() => void navigator.clipboard.writeText(result.doi)}>复制 DOI</button> : null}
              </p> : null}
            </li>)}
          </ol> : null}
        </section> : <DiscoverySkeleton />}
      <div className="status-bezel">
        <div className="status-bezel-inner">
          <span>本地优先</span>
          <span>原文不上传</span>
          <span>文件在浏览器内解析</span>
          <span className="status-bezel-account">{!hydrated || libraryError ? "本机论文数 —" : `${library.length} 篇在本机`}</span>
        </div>
      </div>
      </section>
    </main>
  );
}

/* While the device library is being read, the reading three show their own geometry
   in hairlines — an index, a page and a margin — so the page never flashes a
   rounded placeholder card or an empty library that is not yet known to be empty. */
function ReadingSkeleton() {
  return <>
    <aside className="plab-index" aria-hidden="true">
      <div className="plab-index-head"><h2>论文库</h2><span className="plab-skel plab-skel--count" /></div>
      <div className="plab-index-list">
        {[0, 1, 2, 3].map((row) => <div className="plab-index-row" key={row}>
          <span className="plab-skel plab-skel--row-title" />
          <span className="plab-skel plab-skel--row-meta" />
        </div>)}
      </div>
    </aside>
    <section className="plab-reader" aria-hidden="true">
      <div className="plab-reader-bar">
        <span className="plab-skel plab-skel--file" />
        <span className="plab-skel plab-skel--paper-title" />
      </div>
      <div className="plab-reader-scroll">
        <article className="plab-page">
          <span className="plab-skel plab-skel--row-meta" />
          <span className="plab-skel plab-skel--line" />
          <span className="plab-skel plab-skel--line" />
          <span className="plab-skel plab-skel--line" />
        </article>
      </div>
    </section>
    <aside className="plab-rail" aria-hidden="true">
      <div className="plab-rail-head"><h2>页边注释</h2></div>
      {[0, 1, 2].map((block) => <div className="plab-rail-block" key={block}>
        <span className="plab-skel plab-skel--row-meta" />
        <span className="plab-skel plab-skel--line" />
        <span className="plab-skel plab-skel--line" />
      </div>)}
    </aside>
  </>;
}

function AiConsoleSkeleton() {
  return <section className="ai-studio plab-ai-skeleton" aria-label="AI 研究控制台正在加载" aria-busy="true">
    <div className="ai-console">
      <div className="plab-skeleton-heading"><span className="plab-skel plab-skel--section-title" /><span className="plab-skel plab-skel--section-note" /></div>
      <div className="plab-skeleton-index">{[0, 1, 2, 3].map((item) => <span className="plab-skel plab-skel--mode" key={item} />)}</div>
      <span className="plab-skel plab-skel--analysis" />
    </div>
  </section>;
}

function DiscoverySkeleton() {
  return <section className="plab-discovery plab-discovery-skeleton" aria-label="学术检索索引正在加载" aria-busy="true">
    <div className="plab-skeleton-heading"><span className="plab-skel plab-skel--section-title" /><span className="plab-skel plab-skel--section-note" /></div>
    <span className="plab-skel plab-skel--query" />
    <SearchLoadingSkeleton />
  </section>;
}

function SearchLoadingSkeleton() {
  return <div className="plab-discovery-loading" role="status" aria-label="正在检索公共学术索引">
    {[0, 1, 2].map((record) => <div className="plab-record plab-record--skeleton" key={record} aria-hidden="true">
      <span className="plab-skel plab-skel--record-meta" />
      <span className="plab-skel plab-skel--record-title" />
      <span className="plab-skel plab-skel--record-copy" />
    </div>)}
  </div>;
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
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
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
