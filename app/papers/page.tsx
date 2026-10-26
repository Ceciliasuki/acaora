"use client";

import craft from "./reading-craft.module.css";
import PaperTitle from './paper-title';
import usePaperMotion from './use-paper-motion';
import {ArrowLeft, ArrowRight, Bookmark, BookOpen, Check, Columns2, History, Library, PanelRight, Pin, Scan, Search, Sparkles, Upload, X} from "lucide-react";
import dynamic from 'next/dynamic';
import SourcePreview from './source-preview';
import PaperBibliographyEditor from './paper-bibliography-editor';
import PaperBackupTools from './paper-backup-tools';
import PaperLibrary, {defaultLibraryView, type LibraryView} from './paper-library';
import PaperLocation from './paper-location';
import {restoredPaperCopies} from './paper-backup';
import ProjectEvidencePicker from './project-evidence-picker';
import ResearchProjectTrail from '../components/research-project-trail';
import type {ProjectEvidenceDraft} from '../lib/project-evidence';

import AppSidebar from "../components/app-sidebar";
import {PageHeader} from "../components/ui";
import MotionNavigation from "../components/motion-navigation";

import { ChangeEvent, Suspense, useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { acknowledgePaperSyncOperation, applyPaperSyncSnapshot, deletePaper, deletePaperAndQueue, getPaperLibrary, getPaperSyncOperations, reschedulePaperSyncOperation, restorePaperBatch, savePaper, savePaperAndQueue, setPaperFavorite } from "./paper-storage";
import ContinuousReader, {type ReaderNavigation, type ReadingAnchor} from './continuous-reader';
import type { AiSavedResult, PaperRecord, PaperSyncOperation, Paragraph, PaperAnnotation, TextAnchor, AnnotationDraft } from "./paper-types";
import AnnotationPanel, {AnnotationEditor} from './annotation-panel';
import {saveResult} from './ai-memory';
import {bodyFontSize, detectSection, inferPdfTitle, readingOrderLines,stripRepeatedMargins,joinPdfLines,buildPdfJoinEvidence,type PdfLine} from './pdf-text';
import OriginalPdf from './original-pdf';
import NotesSummary from './notes-summary';
import {savePaperPdf, deletePaperPdf} from './paper-original-storage';
import { samplePaper } from "./paper-types";
import {restoreReadingPosition, useReadingPosition} from './use-reading-position';
import { authFetch, getCurrentUser } from "../lib/auth-client";
import { flushPaperSyncQueue } from "./paper-sync.mjs";
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
const AiStudio = dynamic(() => import('./ai-studio'), {loading: () => <AiConsoleSkeleton />});
const LiteratureSearch = dynamic(() => import('./literature-search'), {loading: () => <DiscoverySkeleton />});
const ReferencePane = dynamic(() => import('./reference-pane'));
type TrailEntry = {anchor: ReadingAnchor; mode: 'reader' | 'library' | 'insight' | 'ai' | 'search'; section: string};

export default function PaperLab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const translatorRef = useRef<TranslatorSession | null>(null);
  const [paper, setPaper] = useState<PaperRecord>(samplePaper);
  const navigationRef = useRef<ReaderNavigation>(null);
  const [trail, setTrail] = useState<{key: string; entries: TrailEntry[]; forward: TrailEntry[]}>({key: '', entries: [], forward: []});
  const [visited, setVisited] = useState({ai: false, search: false});
  const [lockedNote, setLockedNote] = useState<{key: string; id: string; pinned?: boolean} | null>(null);
  const [reference, setReference] = useState<{key: string; index: number} | null>(null);
  const [referenceWidth, setReferenceWidth] = useState(38);
  const referenceResizeAnchor = useRef<ReadingAnchor | null>(null);
  const referencePendingAnchor = useRef<ReadingAnchor | null>(null);
  const referenceToggleRef = useRef<HTMLButtonElement>(null);
  const [fontSize, setFontSize] = useState(20);
  const [saveFeedback, setSaveFeedback] = useState<{key: string; state: 'saving' | 'saved' | 'error'} | null>(null);
  const paperRef = useRef(paper);
  const [library, setLibrary] = useState<PaperRecord[]>([]);
  const [screen, setScreen] = useState<'library' | 'workspace'>('library');
  const [libraryView, setLibraryView] = useState<LibraryView>(defaultLibraryView);
  const [libraryAction, setLibraryAction] = useState<string | null>(null);
  const returnPaperRef = useRef<string | null>(null);
  const [locationQuery, setLocationQuery] = useState<string | null>(null);
  const handledLocation = useRef<string | null>(null);
  const [bibliographyKey,setBibliographyKey] = useState<string|null>(null);
  const [tagFilter,setTagFilter] = useState('');
  const [evidenceDraft,setEvidenceDraft] = useState<{key:string;draft:ProjectEvidenceDraft}|null>(null);
  const [sourceTarget,setSourceTarget] = useState<{paperId:string;paragraphId?:string}|null>(null);
  const [cloudReadSettled,setCloudReadSettled] = useState(false);
  const resolvingSource = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [translationState, setTranslationState] = useState<TranslationState>("checking");
  const [translationProgress, setTranslationProgress] = useState(0);
  const [modelProgress, setModelProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState(samplePaper.title);
  const [annotationDraft,setAnnotationDraft]=useState<AnnotationDraft|null>(null);
  /* A device-library read is a real operation that can really fail; when it does
     the count is unknown rather than zero, and the reader can retry the read. */
  const [libraryError, setLibraryError] = useState("");
  const [hydrationAttempt, setHydrationAttempt] = useState(0);
  const hydrationEpochRef = useRef(0);
  const [cloudState, setCloudState] = useState<"checking" | "guest" | "syncing" | "offline" | "ready" | "error">("checking");
  const cloudStateRef = useRef(cloudState);
  const signedInRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const syncNowRef = useRef<() => void>(() => undefined);
  const skipPersistRef = useRef(false);
  const dirtyRef = useRef(false);
  const switchingRef = useRef(false);
  const [mobilePanel, commitMobilePanel] = useState<"reader" | "library" | "insight" | "ai" | "search">("reader");
  const [showTranslations, setShowTranslations] = useState(false);
  const [citationJump, setCitationJump] = useState<{index: number; id: number; paperId: string; ownerId?: string; offset?: number} | null>(null);
  const [pdfRequest, setPdfRequest] = useState<{page: number; id: number; paperId: string; ownerId?: string} | undefined>();
  const [panels, setPanels] = useState({library: false, notes: false});
  const {shellRef, capture: captureMotion} = usePaperMotion(`${mobilePanel}:${panels.library}:${panels.notes}`);
  const setMobilePanel = useCallback((next: typeof mobilePanel) => {
    navigationRef.current?.getPosition();
    if (next === 'ai' || next === 'search') setVisited(previous => ({...previous, [next]: true}));
    captureMotion();
    // The library is a temporary drawer; a new working mode returns to the text.
    if (next !== 'library') setPanels(previous => previous.library ? {...previous, library: false} : previous);
    commitMobilePanel(next);
  }, [captureMotion]);
  const libraryToggleRef = useRef<HTMLButtonElement>(null);
  const notesToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try {
        const saved = JSON.parse(localStorage.getItem('acaora:paper-panels') ?? 'null');
        if (saved && typeof saved.notes === 'boolean') setPanels({library: false, notes: saved.notes});
      } catch { /* Panel preferences are optional; reading works without storage. */ }
    });
    return () => {active = false;};
  }, []);

  function changePanels(next: typeof panels) {
    navigationRef.current?.getPosition();
    captureMotion();
    setPanels(next);
    try {localStorage.setItem('acaora:paper-panels', JSON.stringify(next));} catch { /* Keep the current session usable. */ }
  }

  const commitReadingPosition = useCallback((paperId: string, ownerId: string | undefined, index: number) => {
    const current = paperRef.current;
    if (current.id === samplePaper.id || current.id !== paperId || current.ownerId !== ownerId || (ownerId ?? null) !== userIdRef.current || current.activeParagraph === index) return;
    dirtyRef.current = true;
    setPaper({...current, activeParagraph: index});
  }, []);
  const {activeIndex, select: selectParagraph, snapshot: withReadingPosition} = useReadingPosition(paper, commitReadingPosition);
  const activeParagraph = paper.paragraphs[activeIndex];
  const paperKey = JSON.stringify([paper.ownerId ?? null, paper.id]);
  const libraryTags = [...new Set(library.flatMap(record=>record.bibliography?.tags??[]))].sort();
  const activeTagFilter = libraryTags.includes(tagFilter) ? tagFilter : '';
  const filteredLibrary = activeTagFilter ? library.filter(record=>record.bibliography?.tags.includes(activeTagFilter)) : library;
  const referenceOpen = reference?.key === paperKey && Boolean(paper.paragraphs[reference.index]);
  useLayoutEffect(() => {
    const anchor = referencePendingAnchor.current;
    referencePendingAnchor.current = null;
    if (referenceOpen && anchor) navigationRef.current?.restorePosition(anchor);
  }, [referenceWidth, referenceOpen]);
  const noteIndex = lockedNote?.key === paperKey ? Math.max(0, paper.paragraphs.findIndex(paragraph => paragraph.id === lockedNote.id)) : activeIndex;
  const noteParagraph = paper.paragraphs[noteIndex];
  const trailEntries = trail.key === paperKey ? trail.entries : [];
  const forwardEntries = trail.key === paperKey ? trail.forward : [];
  const saveLabel = paper.id === samplePaper.id ? '本次演示有效 · 导入后可保存' : saveFeedback?.key === paperKey ? {saving: '正在保存到设备', saved: '已保存到设备', error: '设备保存未完成'}[saveFeedback.state] : '设备端记忆';
  const workspaceStatus = paper.id === samplePaper.id ? '示例演示' : saveFeedback?.key === paperKey && (saveFeedback.state !== 'saved' || !paper.ownerId) ? saveLabel : {ready:'已同步', syncing:'正在同步', checking:'正在检查账户', error:'同步暂不可用', offline:'离线保存', guest:'设备端保存'}[cloudState];
  const readPaperLocation = useEffectEvent(() => {
    if (screen === 'workspace') {navigationRef.current?.getPosition(); void persistCurrentPaper().catch(()=>setMessage('阅读记录尚未保存，请重试。'));}
    const params = new URLSearchParams(location.search), paperId = params.get('paper'), paragraphId = params.get('paragraph');
    handledLocation.current = params.toString();
    setScreen(paperId || params.get('view') === 'reader' ? 'workspace' : 'library');
    setSourceTarget(paperId ? {paperId, paragraphId: paragraphId ?? undefined} : null);
    if(params.get('mode')==='ai')setMobilePanel('ai');
  });
  useEffect(() => {
    try {const size = Number(localStorage.getItem('acaora:paper-font-size')); if ([18,20,22].includes(size)) queueMicrotask(() => setFontSize(size));} catch { /* Reading preferences are optional. */ }
  }, []);
  useEffect(() => {
    if (locationQuery !== null && locationQuery !== handledLocation.current) queueMicrotask(()=>readPaperLocation());
  }, [locationQuery]);
  useEffect(() => {
    if (screen !== 'library' || !returnPaperRef.current || !hydrated) return;
    const handle = requestAnimationFrame(()=>document.getElementById(`paper-open-${returnPaperRef.current}`)?.focus({preventScroll:true}));
    return () => cancelAnimationFrame(handle);
  }, [screen, hydrated]);
  useEffect(() => {
    if (!panels.library || mobilePanel !== 'reader' || innerWidth <= 760) return;
    const node = document.querySelector<HTMLButtonElement>('#paper-library button');
    node?.focus({preventScroll: true});
  }, [panels.library, mobilePanel]);
  useEffect(() => {
    if (!panels.library) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); captureMotion(); setPanels(previous => ({...previous, library: false}));
      try {localStorage.setItem('acaora:paper-panels', JSON.stringify({...panels, library: false}));} catch { /* Optional preference. */ }
      libraryToggleRef.current?.focus({preventScroll: true});
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [panels, captureMotion]);
  const completion = paper.paragraphs.length
    ? Math.round((paper.paragraphs.filter((item) => item.read).length / paper.paragraphs.length) * 100)
    : 0;
  const insight = activeParagraph ? analyzeParagraph(activeParagraph) : null;
  const isEdge = typeof navigator !== "undefined" && /Edg\//.test(navigator.userAgent);

  useEffect(() => {paperRef.current = paper;}, [paper]);

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
    const currentAtMerge = paperRef.current;
    const hadDraft = dirtyRef.current;
    if (userIdRef.current !== userId) throw new Error("账户已切换。");
    const result = await applyPaperSyncSnapshot(userId, cloud.papers ?? [], cloud.deletions ?? []);
    if (userIdRef.current !== userId) throw new Error("账户已切换。");
    setLibrary(result.papers);
    setPaper((current) => {
      // The reader may already be editing its local copy while this GET waits.
      // Keep an unsaved draft; the existing debounce will persist and queue it.
      const matching = result.papers.find((item) => item.id === current.id);
      if (matching && current.ownerId === userId && (dirtyRef.current || hadDraft || current !== currentAtMerge)) return current;
      const next = matching ?? result.papers[0] ?? samplePaper;
      if (!matching) dirtyRef.current = false;
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
    const hydrationEpoch = hydrationEpochRef;
    const epoch = ++hydrationEpoch.current;
    const isCurrent = () => hydrationEpoch.current === epoch;
    let hasLocalRecords = false;
    void (async () => {
      setLibraryError("");
      try {
        const user = await getCurrentUser();
        if (!isCurrent()) return;
        signedInRef.current = Boolean(user);
        userIdRef.current = user?.id ?? null;
        let records: PaperRecord[];
        try {
          records = await getPaperLibrary(userIdRef.current);
          if (!isCurrent()) return;
        } catch {
          /* The device store itself could not be read: that is a failure, not an
             empty library, so the index reports it instead of showing "0 篇". */
          if (!isCurrent()) return;
          setLibraryError("无法读取本机论文库。本次没有删除或覆盖任何记录，可以重试读取。");
          setCloudStatus(navigator.onLine ? "error" : "offline");
          return;
        }
        hasLocalRecords = records.length > 0;
        setLibrary(records);
        skipPersistRef.current = true;
        setPaper(records[0] ?? samplePaper);
        if (records.length) setSearchQuery(records[0].title);
        if (hasLocalRecords || !user) setHydrated(true);
        if (user) {
          setCloudStatus("syncing");
          records = await refreshCloud();
          if (!isCurrent()) return;
          if (!hasLocalRecords && records.length) setSearchQuery(records[0].title);
          void syncNow();
        } else {
          setCloudStatus("guest");
        }
      } catch {
        if (!isCurrent()) return;
        if (!hasLocalRecords) setLibraryError("无法读取论文库状态。请检查网络或账户状态后重试。");
        setCloudStatus(navigator.onLine ? "error" : "offline");
      } finally {
        if (isCurrent()) {setHydrated(true);setCloudReadSettled(true);}
      }
    })();
    return () => { if (isCurrent()) hydrationEpoch.current++; };
  }, [hydrationAttempt, refreshCloud, setCloudStatus, syncNow]);

  useEffect(() => {
    const offline = () => {
      if (["ready", "syncing"].includes(cloudStateRef.current)) setCloudStatus("offline");
    };
    const online = () => {
      void syncNow();
    };
    const authChanged = () => {
      setBibliographyKey(null); setEvidenceDraft(null); setSourceTarget(null); setTagFilter(''); setCloudReadSettled(false);
      const epoch = ++hydrationEpochRef.current;
      void authFetch("/api/auth/session").then(async (response) => {
        if (!response.ok) throw new Error("账户状态不可用。");
        const session = await response.json() as { user?: { id: string } | null };
        if (hydrationEpochRef.current !== epoch) return;
        const previousOwner = userIdRef.current;
        signedInRef.current = Boolean(session.user);
        userIdRef.current = session.user?.id ?? null;
        if (previousOwner !== userIdRef.current) {
          setScreen('library'); setLibraryView(defaultLibraryView); setLibraryAction(null);
          writePaperLocation(null, true);
          dirtyRef.current = false;
          skipPersistRef.current = true;
          setPaper(samplePaper);
          setLibrary([]);
        }
        if (session.user) {
          await refreshCloud();
          if (hydrationEpochRef.current !== epoch) return;
          void syncNow();
        } else {
          const guest = await getPaperLibrary();
          if (userIdRef.current !== null || hydrationEpochRef.current !== epoch) return;
          setLibrary(guest);
          skipPersistRef.current = true;
          setPaper(guest[0] ?? samplePaper);
          setCloudStatus("guest");
        }
        if (hydrationEpochRef.current === epoch) {setHydrated(true);setCloudReadSettled(true);}
      }).catch(() => { if (hydrationEpochRef.current === epoch) {setCloudStatus("error"); setHydrated(true);setCloudReadSettled(true);} });
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
      if (paperRef.current.id !== paper.id || (paper.ownerId ?? null) !== userIdRef.current) return;
      const updated = { ...withReadingPosition(paper), ownerId: userIdRef.current ?? undefined, updatedAt: Date.now() };
      const persist = signedInRef.current ? savePaperAndQueue(updated, {requireExisting: true}) : savePaper(updated);
      void persist.then((saved) => {
        if (saved === false) {if (paperRef.current.id === paper.id) setSaveFeedback({key: JSON.stringify([paper.ownerId ?? null, paper.id]), state: 'error'}); return;}
        if ((paper.ownerId ?? null) !== userIdRef.current) return;
        if (paperRef.current === paper) dirtyRef.current = false;
        if (paperRef.current === paper) setSaveFeedback({key: JSON.stringify([paper.ownerId ?? null, paper.id]), state: 'saved'});
        setLibrary((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        if (signedInRef.current) void syncNow();
      }).catch(() => {if (paperRef.current === paper) setSaveFeedback({key: JSON.stringify([paper.ownerId ?? null, paper.id]), state: 'error'}); setCloudStatus("error");});
    }, 450);
    return () => window.clearTimeout(handle);
  }, [paper, hydrated, setCloudStatus, syncNow, withReadingPosition]);

  const updatePaper=useCallback((updater: (current: PaperRecord) => PaperRecord) => {
    const source = paperRef.current;
    if (source.id !== samplePaper.id) setSaveFeedback({key: JSON.stringify([source.ownerId ?? null, source.id]), state: 'saving'});
    if (userIdRef.current) {
      dirtyRef.current = true;
      setCloudStatus("syncing");
    }
    setPaper((current) => updater(withReadingPosition(current)));
  },[withReadingPosition,setCloudStatus]);

  const createAnnotation=useCallback((anchors:TextAnchor[],highlightOnly:boolean)=>{
    const current=paperRef.current;
    if(current.id===samplePaper.id){setMessage('示例只用于阅读演示；请先导入 PDF，再添加批注。');return;}
    if((current.ownerId??null)!==userIdRef.current)return;
    const valid=anchors.filter(anchor=>current.paragraphs.some(p=>p.id===anchor.paragraphId&&p.original.slice(anchor.start,anchor.end)===anchor.quote));
    if(!valid.length)return;
    const draft:AnnotationDraft={key:crypto.randomUUID(),paperKey:JSON.stringify([current.ownerId??null,current.id]),anchors:valid,comment:'',color:'yellow'};
    if(highlightOnly){
      const createdAt=Date.now();const additions=valid.map(anchor=>({...anchor,id:crypto.randomUUID(),createdAt,color:'yellow' as const,comment:''}));
      updatePaper(paper=>JSON.stringify([paper.ownerId??null,paper.id])!==draft.paperKey?paper:{...paper,paragraphs:paper.paragraphs.map(p=>{
        const added=additions.filter(a=>a.paragraphId===p.id).map(a=>({id:a.id,start:a.start,end:a.end,quote:a.quote,createdAt:a.createdAt,color:a.color,comment:a.comment}));
        return added.length?{...p,annotations:[...(p.annotations??[]),...added]}:p;
      })});
      setMessage(current.id===samplePaper.id?'已添加示例高亮；导入PDF后可长期保存批注。':'已添加高亮。');
    }else{
      setAnnotationDraft(draft);setPanels(previous=>({...previous,notes:true}));setMobilePanel(innerWidth<=760?'insight':'reader');
    }
  },[updatePaper,setMobilePanel]);

  const editAnnotation=useCallback((paragraphId:string,annotation:PaperAnnotation)=>{
    const current=paperRef.current;
    if((current.ownerId??null)!==userIdRef.current)return;
    setAnnotationDraft({key:crypto.randomUUID(),paperKey:JSON.stringify([current.ownerId??null,current.id]),annotationId:annotation.id,anchors:[{paragraphId,start:annotation.start,end:annotation.end,quote:annotation.quote}],comment:annotation.comment,color:annotation.color});
    setPanels(previous=>({...previous,notes:true}));setMobilePanel(innerWidth<=760?'insight':'reader');
  },[setMobilePanel]);

  function saveAnnotation(draft:AnnotationDraft){
    const current=paperRef.current;
    if(JSON.stringify([current.ownerId??null,current.id])!==draft.paperKey||(current.ownerId??null)!==userIdRef.current)return;
    const createdAt=Date.now();
    const additions=draft.anchors.map(anchor=>({paragraphId:anchor.paragraphId,annotation:{id:draft.annotationId??crypto.randomUUID(),start:anchor.start,end:anchor.end,quote:anchor.quote,comment:draft.comment,color:draft.color,createdAt:current.paragraphs.find(p=>p.id===anchor.paragraphId)?.annotations?.find(a=>a.id===draft.annotationId)?.createdAt??createdAt}}));
    updatePaper(paper=>JSON.stringify([paper.ownerId??null,paper.id])!==draft.paperKey?paper:{...paper,paragraphs:paper.paragraphs.map(p=>{
      const added=additions.filter(a=>a.paragraphId===p.id&&p.original.slice(a.annotation.start,a.annotation.end)===a.annotation.quote).map(a=>a.annotation);
      return added.length?{...p,annotations:[...(p.annotations??[]).filter(a=>a.id!==draft.annotationId),...added]}:p;
    })});
    setAnnotationDraft(null);setMessage(current.id===samplePaper.id?'示例批注已添加；导入PDF后可长期保存。':'批注已更新。');
  }

  function deleteAnnotation(paragraphId:string,id:string){
    const source=paperRef.current;
    if(!window.confirm('删除这条批注？原文和段落笔记会保留。'))return;
    if(source.id!==paperRef.current.id||source.ownerId!==paperRef.current.ownerId||(source.ownerId??null)!==userIdRef.current)return;
    updatePaper(current=>current.id!==source.id||current.ownerId!==source.ownerId?current:{...current,paragraphs:current.paragraphs.map(p=>p.id===paragraphId?{...p,annotations:(p.annotations??[]).filter(a=>a.id!==id)}:p)});
    if(annotationDraft?.annotationId===id)setAnnotationDraft(null);
  }

  function updateActiveParagraph(patch: Partial<Paragraph>) {
    updatePaper((current) => ({
      ...current,
      paragraphs: current.paragraphs.map((paragraph, index) => index === noteIndex ? { ...paragraph, ...patch } : paragraph),
    }));
  }

  function jumpToParagraph(index: number, originalPdf = false) {
    if (index < 0 || index >= paper.paragraphs.length) return;
    const entry = captureReading();
    if (entry.anchor.index !== index || mobilePanel !== 'reader' || Math.abs(entry.anchor.offset) > 2) {
      setTrail(previous => ({key: paperKey, entries: [...(previous.key === paperKey ? previous.entries : []).filter((item, position, all) => position !== all.length - 1 || item.mode !== entry.mode || item.anchor.index !== entry.anchor.index || Math.abs(item.anchor.offset - entry.anchor.offset) > 2), entry].slice(-12), forward: []}));
    }
    selectParagraph(index);
    setMobilePanel('reader');
    setCitationJump(previous => ({index, id: (previous?.id ?? 0) + 1, paperId: paper.id, ownerId: paper.ownerId}));
    if (originalPdf) setPdfRequest(previous => ({page: paper.paragraphs[index].page, id: (previous?.id ?? 0) + 1, paperId: paper.id, ownerId: paper.ownerId}));
  }

  function pinReference(index: number) {
    if (!paper.paragraphs[index]) return;
    navigationRef.current?.getPosition();
    setReference({key: paperKey, index});
    changePanels({library: false, notes: false});
    setMobilePanel('reader');
  }

  function closeReference() {
    navigationRef.current?.getPosition();
    setReference(null);
    referenceToggleRef.current?.focus({preventScroll: true});
  }

  function returnToReading(position: number) {
    const entry = trailEntries[position];
    if (!entry || !paper.paragraphs[entry.anchor.index]) return;
    setTrail({key: paperKey, entries: trailEntries.slice(0, position), forward: [...forwardEntries, captureReading(), ...trailEntries.slice(position + 1).reverse()].slice(-12)});
    restoreTrailEntry(entry);
  }

  function captureReading(): TrailEntry {
    const anchor = navigationRef.current?.getPosition() ?? {index: activeIndex, offset: 0};
    return {anchor, mode: mobilePanel, section: paper.paragraphs[anchor.index]?.section ?? ''};
  }

  function forwardToReading() {
    const entry = forwardEntries.at(-1);
    if (!entry || !paper.paragraphs[entry.anchor.index]) return;
    setTrail({key: paperKey, entries: [...trailEntries, captureReading()].slice(-12), forward: forwardEntries.slice(0, -1)});
    restoreTrailEntry(entry);
  }

  function restoreTrailEntry(entry: TrailEntry) {
    selectParagraph(entry.anchor.index);
    setCitationJump(previous => ({...entry.anchor, id: (previous?.id ?? 0) + 1, paperId: paper.id, ownerId: paper.ownerId}));
    setMobilePanel(entry.mode === 'ai' || entry.mode === 'search' ? entry.mode : 'reader');
  }

  async function handlePdf(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {setMessage('请选择不超过 50 MB 的 PDF。'); return;}
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("请选择 PDF 格式的英文论文。" );
      return;
    }
    setExtracting(true);
    setExtractProgress(0);
    setMessage("正在设备本地解析论文……");
    const sourceUser = userIdRef.current;
    try {
      const extracted = {...await extractPdf(file, setExtractProgress), ownerId: sourceUser ?? undefined};
      if (sourceUser !== userIdRef.current) throw new Error('账户已切换，请重新导入。');
      await persistCurrentPaper();
      if (sourceUser !== userIdRef.current) throw new Error('账户已切换，请重新导入。');
      skipPersistRef.current = true;
      setCitationJump(null); setPdfRequest(undefined);
      setPaper(extracted);
      setSearchQuery(extracted.title);
      if (signedInRef.current) {
        await savePaperAndQueue(extracted);
      }
      else await savePaper(extracted);
      let originalSaved = true;
      try {await savePaperPdf(extracted.id, sourceUser, file);}
      catch {originalSaved = false;}
      if (sourceUser !== userIdRef.current) throw new Error('账户已切换，导入记录仍按原账号保存在设备中。');
      setLibrary((current) => [extracted, ...current.filter((item) => item.id !== extracted.id)]);
      setMessage(`已读取 ${extracted.paragraphs.length} 个段落。${originalSaved ? '' : '设备空间不足或存储不可用；查看原 PDF 时请重新选择文件。'}`);
      setScreen('workspace'); writePaperLocation(extracted.id);
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

  async function translateParagraphs(mode: "current" | "all", paragraphIndex = activeIndex) {
    setMessage("");
    setTranslationProgress(0);
    setTranslationState('working');
    const sourceOwner = paper.ownerId ?? null;
    const sourceUser = userIdRef.current;
    try {
      const translator = await ensureTranslator();
      const targets = mode === "current"
        ? [paragraphIndex]
        : paper.paragraphs.map((_, index) => index).filter((index) => !paper.paragraphs[index].translation);
      if (!targets.length) {
        setTranslationState("done");
        setMessage("所有段落已经完成翻译。" );
        return;
      }
      for (let position = 0; position < targets.length; position += 1) {
        const target = paper.paragraphs[targets[position]];
        const translation = await translator.translate(target.original);
        if (paperRef.current.id !== paper.id || userIdRef.current !== sourceUser) {
          setTranslationState('ready');
          return;
        }
        // A delayed translation changes only its source paragraph. Reading,
        // notes, title edits and account/paper switches may happen meanwhile.
        updatePaper(current => current.id === paper.id && (current.ownerId ?? null) === sourceOwner ? {
          ...current,
          paragraphs: current.paragraphs.map(paragraph => paragraph.id === target.id && paragraph.original === target.original ? {...paragraph, translation} : paragraph),
        } : current);
        setTranslationProgress(Math.round(((position + 1) / targets.length) * 100));
      }
      setTranslationState("done");
      setMessage(`完成 ${targets.length} 个段落的设备端翻译。`);
    } catch (error) {
      setTranslationState("error");
      setMessage(error instanceof Error ? error.message : "本地翻译失败。" );
    }
  }

  async function removeFromLibrary(record: PaperRecord) {
    const sourceOwner = userIdRef.current;
    if ((record.ownerId ?? null) !== sourceOwner) return;
    const confirmation = signedInRef.current
      ? `从所有设备删除“${record.title}”的论文记忆？原始 PDF 不受影响；提取文本、翻译、笔记、阅读进度和 AI 结果将被删除。`
      : `从当前设备删除“${record.title}”的论文记忆？原始 PDF 不受影响。`;
    if (!window.confirm(confirmation)) return;
    try {
      if (sourceOwner) await deletePaperAndQueue(record.id, Date.now(), sourceOwner);
      else await deletePaper(record.id);
      await deletePaperPdf(record.id, record.ownerId ?? null);
      if (userIdRef.current !== sourceOwner) return;
      const remaining = library.filter((item) => item.id !== record.id);
      setLibrary(remaining);
      if (paper.id === record.id) {
        dirtyRef.current = false;
        skipPersistRef.current = true;
        setCitationJump(null); setPdfRequest(undefined);
        setPaper(remaining[0] ?? samplePaper);
      }
      if (signedInRef.current) {
        setMessage(navigator.onLine ? "论文记忆已从当前设备删除，云端删除正在同步。" : "论文记忆已从当前设备删除，云端删除等待同步。");
        void syncNow();
      }
    } catch { setMessage("删除未完成，请重试。" ); }
  }

  async function openPaper(record: PaperRecord) {
    if (record.id === paperRef.current.id && record.ownerId === paperRef.current.ownerId) return true;
    if (switchingRef.current || (record.ownerId ?? null) !== userIdRef.current) return false;
    switchingRef.current = true;
    const owner = userIdRef.current;
    try {
      let opened: PaperRecord;
      let source: PaperRecord;
      do {
        source = await persistCurrentPaper();
        opened = {...restoreReadingPosition(record), updatedAt: Date.now() + 1};
        const saved = await (signedInRef.current ? savePaperAndQueue(opened, {requireExisting: true}) : savePaper(opened));
        if (saved === false) throw new Error('论文已从本机删除。');
        if (userIdRef.current !== owner) throw new Error('账户已切换。');
      } while (paperRef.current !== source);
      setLibrary(items => [opened, ...items.filter(item => item.id !== opened.id)]);
      skipPersistRef.current = true;
      setCitationJump(null); setPdfRequest(undefined);
      setPaper(opened);
      setSearchQuery(record.title);
      setMobilePanel("reader");
      return true;
    } catch { setMessage('保存未完成，暂未切换论文。请重试。'); return false; }
    finally { switchingRef.current = false; }
  }

  async function persistCurrentPaper(): Promise<PaperRecord> {
    const current = paperRef.current;
    const owner = userIdRef.current;
    if (current.id === samplePaper.id || (current.ownerId ?? null) !== owner) return current;
    const updated = {...withReadingPosition(current), updatedAt: Date.now()};
    const saved = await (signedInRef.current ? savePaperAndQueue(updated, {requireExisting: true}) : savePaper(updated));
    if (saved === false) throw new Error('论文已从本机删除。');
    if (userIdRef.current !== owner) throw new Error('账户已切换。');
    if (paperRef.current !== current) return persistCurrentPaper();
    setLibrary(items => [updated, ...items.filter(item => item.id !== updated.id)]);
    if (paperRef.current === current) dirtyRef.current = false;
    if (signedInRef.current) void syncNow();
    return current;
  }

  function writePaperLocation(id: string | null, replace = false) {
    const url = new URL(location.href);
    url.searchParams.delete('paragraph');
    if (id) {url.searchParams.set('view', 'reader'); url.searchParams.set('paper', id);}
    else {url.searchParams.delete('view'); url.searchParams.delete('paper');}
    handledLocation.current = url.searchParams.toString();
    window.history[replace ? 'replaceState' : 'pushState'](null, '', `${url.pathname}${url.search}`);
  }

  async function enterPaper(record: PaperRecord) {
    const owner = userIdRef.current, epoch = hydrationEpochRef.current, actionKey = JSON.stringify([owner, epoch, record.id]);
    if (libraryAction || (record.ownerId ?? null) !== owner) return;
    setLibraryAction(actionKey);
    try {
      if (!await openPaper(record)) return;
      if (owner !== userIdRef.current || epoch !== hydrationEpochRef.current) return;
      returnPaperRef.current = record.id;
      changePanels({...panels, library: false});
      setScreen('workspace'); writePaperLocation(record.id);
    } finally {setLibraryAction(current => current === actionKey ? null : current);}
  }

  async function returnToLibrary() {
    try {
      navigationRef.current?.getPosition();
      await persistCurrentPaper();
      returnPaperRef.current = paperRef.current.id;
      setScreen('library'); writePaperLocation(null);
    } catch {setMessage('保存未完成，暂未离开阅读界面。请重试。');}
  }

  async function openDemo() {
    const owner = userIdRef.current;
    try {
      await persistCurrentPaper();
      if (owner !== userIdRef.current) return;
      skipPersistRef.current = true;
      setPaper(samplePaper); setMobilePanel('reader'); setScreen('workspace'); writePaperLocation(samplePaper.id);
    } catch {setMessage('保存未完成，暂未打开示例。请重试。');}
  }

  async function favoritePaper(record: PaperRecord) {
    const owner = userIdRef.current, epoch = hydrationEpochRef.current;
    const actionKey = JSON.stringify([owner, epoch, record.id]);
    if (libraryAction || (record.ownerId ?? null) !== owner) return;
    setLibraryAction(actionKey);
    try {
      if (paperRef.current.id === record.id) await persistCurrentPaper();
      const source = paperRef.current;
      const updated = await setPaperFavorite(record.id, owner, !record.favorite);
      if (owner !== userIdRef.current || epoch !== hydrationEpochRef.current) return;
      if (!updated) throw new Error('论文已删除或账户已变化，未更改收藏。');
      if (source.id === updated.id && source.ownerId === updated.ownerId) {
        if (paperRef.current === source) {skipPersistRef.current = true; setPaper(updated);}
        else updatePaper(current => current.id === updated.id ? {...current, favorite: updated.favorite} : current);
      }
      setLibrary(items => items.map(item => item.id === updated.id ? updated : item));
      if (owner) void syncNow();
    } catch (error) {setMessage(error instanceof Error ? error.message : '收藏未保存，请重试。');}
    finally {setLibraryAction(current => current === actionKey ? null : current);}
  }

  async function editLibraryDetails(record: PaperRecord) {
    const owner = userIdRef.current, epoch = hydrationEpochRef.current;
    if ((record.ownerId ?? null) !== owner) return;
    if (await openPaper(record) && owner === userIdRef.current && epoch === hydrationEpochRef.current) setBibliographyKey(JSON.stringify([record.ownerId ?? null, record.id]));
  }

  const backupTools = <PaperBackupTools key={paper.ownerId??'guest'} disabled={!hydrated} getRecords={async()=>{
    const owner=userIdRef.current,epoch=hydrationEpochRef.current;await persistCurrentPaper();const records=await getPaperLibrary(owner);
    if(owner!==userIdRef.current||epoch!==hydrationEpochRef.current)throw new Error('账户已切换，备份已取消。');return records;
  }} onRestore={async records=>{
    const owner=userIdRef.current,epoch=hydrationEpochRef.current;const user=await getCurrentUser();
    if((user?.id??null)!==owner||epoch!==hydrationEpochRef.current)throw new Error('账户已切换，恢复已取消。');
    await persistCurrentPaper();const copies=restoredPaperCopies(records,owner);
    await restorePaperBatch(copies,()=>owner===userIdRef.current&&epoch===hydrationEpochRef.current);
    if(owner!==userIdRef.current||epoch!==hydrationEpochRef.current)return;
    setLibrary(await getPaperLibrary(owner));if(owner)void syncNow();
  }}/>;

  function applyAiResult(result: AiSavedResult, source: PaperRecord, paragraph?: Paragraph) {
    if (paperRef.current.id !== source.id || (source.ownerId ?? null) !== userIdRef.current) return;
    updatePaper(current => {
      if (current.id !== source.id || current.ownerId !== source.ownerId) return current;
      if (paragraph && !current.paragraphs.some(p => p.id === paragraph.id && p.original === paragraph.original)) return current;
      if (result.action === 'translate' && paragraph && typeof result.data.translation === 'string') {
        return {...current, paragraphs: current.paragraphs.map(p => p.id === paragraph.id ? {...p, translation: result.data.translation as string} : p)};
      }
      return {...current, aiMemory: saveResult(current.aiMemory ?? {paragraph: {}, chats: []}, result, paragraph?.id)};
    });
  }

  function addEvidence(paragraph: Paragraph, annotation?: PaperAnnotation) {
    const current = paperRef.current;
    if (!current.ownerId || current.ownerId !== userIdRef.current || current.id === samplePaper.id) {setMessage('请登录并导入论文后再关联项目。');return;}
    const source = current.paragraphs.find(item=>item.id===paragraph.id);
    if (!source || source.original !== paragraph.original || (annotation && source.original.slice(annotation.start,annotation.end)!==annotation.quote)) {setMessage('原文已变化，请重新选择摘录。');return;}
    const quote = annotation?.quote ?? source.original;
    if (quote.length>30000) {setMessage('该段过长，请先选择部分文字添加批注，再加入项目。');return;}
    setEvidenceDraft({key:paperKey,draft:{paperId:current.id,paragraphId:source.id,paperTitle:current.title,fileName:current.fileName,page:source.page,section:source.section,quote,comment:annotation?.comment??source.note,...(annotation?{annotationId:annotation.id,start:annotation.start,end:annotation.end}:{})}});
  }

  const resolveSource = useEffectEvent(async () => {
    if (!sourceTarget || !hydrated || resolvingSource.current) return;
    if (sourceTarget.paperId === samplePaper.id) {skipPersistRef.current = true; setPaper(samplePaper); setSourceTarget(null); return;}
    const record = library.find(item=>item.id===sourceTarget.paperId && (item.ownerId??null)===userIdRef.current);
    if (!record) {
      if (!cloudReadSettled) return;
      setMessage(cloudState==='error'||cloudState==='offline'?'当前设备未找到来源，云端读取暂不可用。恢复网络后可重新打开来源链接。':'当前账户未找到原论文，可能已删除或尚未同步。项目中的摘录仍保留。');
      setSourceTarget(null);setScreen('library');return;
    }
    const index=sourceTarget.paragraphId ? record.paragraphs.findIndex(item=>item.id===sourceTarget.paragraphId) : record.activeParagraph;
    if(index<0){setMessage('原段落已不存在或已重新提取，未跳转到其他段落。项目中的摘录仍保留。');setSourceTarget(null);setScreen('library');return;}
    if(paper.id!==record.id||paper.ownerId!==record.ownerId){
      resolvingSource.current=true;
      try {if(!await openPaper(record))setSourceTarget(null);} finally {resolvingSource.current=false;}
      return;
    }
    setScreen('workspace');
    if (sourceTarget.paragraphId) jumpToParagraph(index);
    if(new URLSearchParams(locationQuery??'').get('mode')==='ai')setMobilePanel('ai');
    setSourceTarget(null);
  });
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)void resolveSource();});return()=>{active=false;};},[sourceTarget,hydrated,cloudReadSettled,library,paperKey]);

  return (
    <main className={`student-app paper-layout workspace-refresh ${craft.reading}`}>
      <Suspense fallback={null}><PaperLocation onChange={setLocationQuery}/></Suspense>
      <AppSidebar active="papers" profileTitle="PaperLab 工作台" profileSubtitle={cloudState === "ready" ? "论文记忆已同步" : cloudState === "syncing" ? "正在同步论文记忆" : "本地研究模式"} />
      <section ref={shellRef} className="student-main plab-shell" style={{'--paper-reading-size': `${fontSize}px`, '--paper-reference-width': `${referenceWidth}%`} as CSSProperties}>
      {/* Running head: the surface's own line, then only the tools that act on the
          library. The numeric register that used to sit here was removed because
          every value in it is already printed where it belongs: the library count in
          the index, the paragraph position and reading progress in the reader, the
          sync state beside the library, and the privacy facts in the colophon. */}
      <PageHeader className="workspace-header plab-head" title="论文研究" actions={<div className="plab-head-tools">
          {screen==='workspace'&&<button className={`plab-tool ${mobilePanel==='reader'?'desktop-paper-tool':''}`} type="button" onClick={()=>void returnToLibrary()} disabled={extracting}><ArrowLeft size={16} aria-hidden="true"/>返回论文列表</button>}
          {['working','done','error'].includes(translationState)&&<span className="paper-translation-feedback" role="status">{translatorStatusLabel(translationState,isEdge)}</span>}
          <button className="plab-tool plab-tool--primary" type="button" onClick={() => fileInputRef.current?.click()} disabled={extracting || !hydrated}>
            <Upload size={16} aria-hidden="true" />{extracting ? `解析中 ${extractProgress}%` : "导入 PDF"}
          </button>
          <input className="sr-only" ref={fileInputRef} type="file" accept="application/pdf,.pdf" aria-label="导入英文论文 PDF" disabled={!hydrated || extracting} onChange={handlePdf} />
        </div>} />

      <ResearchProjectTrail paperId={screen === 'workspace' ? paper.id : undefined}/>
      {message && <div className="paper-message" role="status">{message}</div>}
      {bibliographyKey===paperKey&&<PaperBibliographyEditor key={paperKey} paper={paper} library={library} onClose={()=>setBibliographyKey(null)} onSave={bibliography=>{updatePaper(current=>({...current,bibliography}));setBibliographyKey(null);setMessage('文献资料已更新，正在保存。');}}/>}
      {evidenceDraft?.key===paperKey&&paper.ownerId&&<ProjectEvidencePicker key={`${paperKey}:${new URLSearchParams(locationQuery ?? '').get('project') ?? ''}`} projectId={new URLSearchParams(locationQuery ?? '').get('project')} ownerId={paper.ownerId} draft={evidenceDraft.draft} onClose={()=>setEvidenceDraft(null)} onSaved={()=>{setEvidenceDraft(null);setMessage('摘录已加入项目，可从项目返回原段落。');}}/>}

      {screen==='library'?<PaperLibrary papers={library} hydrated={hydrated} error={libraryError} status={libraryAction?'正在处理…':{ready:'已同步',syncing:'正在同步',checking:'正在检查账户',error:'同步暂不可用',offline:'离线保存',guest:'设备端保存'}[cloudState]} view={libraryView} onView={setLibraryView} busy={Boolean(libraryAction)||extracting} tools={backupTools} onRetry={()=>{setLibraryError('');setHydrated(false);setHydrationAttempt(value=>value+1);}} onOpen={record=>void enterPaper(record)} onFavorite={record=>void favoritePaper(record)} onDetails={record=>void editLibraryDetails(record)} onDelete={record=>void removeFromLibrary(record)} onDemo={()=>void openDemo()}/>:<>
      <div className="paper-navigation-bar">
      <MotionNavigation className="paper-workspace-nav" label="论文工作模式" value={mobilePanel === 'ai' || mobilePanel === 'search' ? mobilePanel : 'reader'}>
        <button type="button" aria-pressed={!["ai", "search"].includes(mobilePanel)} onClick={() => setMobilePanel("reader")}><BookOpen size={16} aria-hidden="true" />阅读与笔记</button>
        <button type="button" aria-pressed={mobilePanel === "ai"} onClick={() => setMobilePanel("ai")}><Sparkles size={16} aria-hidden="true" />AI 分析</button>
        <button type="button" aria-pressed={mobilePanel === "search"} onClick={() => setMobilePanel("search")}><Search size={16} aria-hidden="true" />学术检索</button>
      </MotionNavigation>

      <div className="paper-layout-controls" hidden={mobilePanel === 'ai' || mobilePanel === 'search'}>
        <div>
          <button ref={libraryToggleRef} type="button" aria-controls="paper-library" aria-expanded={panels.library} onClick={() => changePanels({...panels, library: !panels.library})}><Library size={16} aria-hidden="true" />论文库</button>
          <button ref={notesToggleRef} type="button" aria-controls="paper-notes" aria-expanded={panels.notes} onClick={() => {setReference(null); changePanels({...panels, notes: !panels.notes});}}><PanelRight size={16} aria-hidden="true" />笔记</button>
          <button ref={referenceToggleRef} type="button" aria-controls="paper-reference" aria-expanded={referenceOpen} onClick={() => referenceOpen ? closeReference() : pinReference(activeIndex)}><Columns2 size={16} aria-hidden="true" />原文对照</button>
          <button type="button" aria-pressed={!panels.library && !panels.notes && !referenceOpen} onClick={() => {setReference(null); changePanels({library: false, notes: !panels.library && !panels.notes && !referenceOpen});}}><Scan size={16} aria-hidden="true" />专注阅读</button>
        </div>
        <span role="status">{workspaceStatus}</span>
        {!panels.notes && saveFeedback?.key === paperKey && saveFeedback.state === 'error' && <button className="desktop-paper-tool" type="button" onClick={() => updatePaper(current => ({...current}))}>重试保存</button>}
      </div>
      </div>
      <MotionNavigation as="div" className="paper-mobile-tabs" role="tablist" label="论文工作台面板" value={mobilePanel}>
        {(["library", "reader", "insight", "ai", "search"] as const).map((panel, index, choices) => <button id={`paper-tab-${panel}`} role="tab" aria-selected={mobilePanel === panel} tabIndex={mobilePanel === panel ? 0 : -1}
          aria-controls={{library:'paper-library',reader:'paper-reader',insight:'paper-notes',ai:'paper-ai',search:'paper-search'}[panel]}
          className={mobilePanel === panel ? "active" : ""} key={panel} onClick={() => setMobilePanel(panel)} type="button"
          onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % choices.length : event.key === 'ArrowLeft' ? (index + choices.length - 1) % choices.length : event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : null;
            if (next === null || event.altKey || event.ctrlKey || event.metaKey) return;
            event.preventDefault(); setMobilePanel(choices[next]);
            event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
          }}>{{ library: "论文库", reader: "阅读", insight: "笔记", ai: "AI", search: "检索" }[panel]}</button>)}
      </MotionNavigation>

      <section className="plab-workbench" data-library-open={panels.library} data-notes-open={panels.notes} data-reference-open={referenceOpen} hidden={mobilePanel === "ai" || mobilePanel === "search"}>
        {!hydrated ? <ReadingSkeleton /> : <>
        {/* 1 · Library Index. An archival index rather than a dark sidebar: ruled
            rows, the title as the entry, and the reader's own progress beneath it.
            The row keeps its two real controls (open, delete) unchanged. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles from the drawer's controls; the aside retains complementary semantics. */}
        <aside id="paper-library" className={`plab-index ${mobilePanel === "library" ? "mobile-visible" : ""}`} onKeyDown={event => {
          if (event.key === 'Escape') {event.stopPropagation(); changePanels({...panels, library: false}); setMobilePanel('reader'); (libraryToggleRef.current?.getClientRects().length ? libraryToggleRef.current : document.getElementById('paper-tab-reader'))?.focus();}
        }}>
          <div className="plab-index-head">
            <h2>论文库</h2>
            {/* An unread store has no count, so the index prints an absence rather
                than a zero that would claim the library is empty. */}
            <span className="journal-num">{libraryError ? "—" : library.length}</span>
            <button className="paper-panel-close" type="button" aria-label="收起论文库" onClick={() => {changePanels({...panels, library: false}); setMobilePanel('reader'); (libraryToggleRef.current?.getClientRects().length ? libraryToggleRef.current : document.getElementById('paper-tab-reader'))?.focus();}}><X size={16} aria-hidden="true" /></button>
          </div>
          {libraryError ? <p className="plab-index-error" role="alert">
            {libraryError}
            <button className="plab-index-retry" type="button" onClick={() => { setLibraryError(""); setHydrated(false); setHydrationAttempt((attempt) => attempt + 1); }}>重试读取</button>
          </p> : null}
          {!libraryError&&<><label className="paper-library-tags">按标签筛选<select aria-label="论文标签筛选" value={activeTagFilter} onChange={event=>setTagFilter(event.target.value)}><option value="">全部论文</option>{libraryTags.map(tag=><option key={tag}>{tag}</option>)}</select></label>{backupTools}</>}
          <div className="plab-index-list">
            {!libraryError && (filteredLibrary.length ? filteredLibrary.map((record) => {
              const progress = record.paragraphs.length ? Math.round(record.paragraphs.filter((item) => item.read).length / record.paragraphs.length * 100) : 0;
              const current = record.id === paper.id;
              return <article className={current ? "plab-index-row plab-index-row--current" : "plab-index-row"} key={record.id}>
                <button className="plab-index-open" type="button" onClick={() => {changePanels({...panels, library: false}); setMobilePanel('reader'); void openPaper(record);}}>
                  <strong>{record.title}</strong>
                  <small className="journal-num">{record.paragraphs.length} 段 · 已读 {progress}%</small>
                  {record.bibliography&&<small>{[record.bibliography.authors[0],record.bibliography.year,...record.bibliography.tags].filter(Boolean).join(' · ')}</small>}
                </button>
                <button className="plab-index-delete" type="button" aria-label={`删除 ${record.title}`} onClick={() => void removeFromLibrary(record)}><X size={14} aria-hidden="true" /></button>
                <span className="paper-library-filename">{record.fileName}</span>
              </article>;
            }) : <div className="plab-index-empty"><strong>{activeTagFilter?'此标签下没有论文':'还没有保存的论文'}</strong><span>{activeTagFilter?'选择全部论文可返回完整论文库。':'导入 PDF，开始阅读与整理文献。'}</span></div>)}
          </div>
          <div className="library-privacy" role="status"><strong>{{ ready: "云端记忆已同步", syncing: "正在同步更改", checking: "正在检查账户", error: "云同步暂不可用", offline: "当前离线", guest: "设备端记忆" }[cloudState]}</strong></div>
        </aside>

        {/* Full text is continuous; paragraph IDs still anchor notes and AI context. */}
        <section id="paper-reader" className={`plab-reader ${mobilePanel === "reader" ? "mobile-visible" : ""}`}>
          <ContinuousReader noteIndex={noteIndex} navigationRef={navigationRef} onNavigate={jumpToParagraph} onBack={trailEntries.length ? () => returnToReading(trailEntries.length - 1) : undefined} onForward={forwardEntries.length ? forwardToReading : undefined} key={`${paper.ownerId??'guest'}:${paper.id}`} paperId={paper.id} paragraphs={paper.paragraphs} activeIndex={activeIndex} showTranslations={showTranslations} mode={`${mobilePanel}-${panels.library}-${panels.notes}`} jump={citationJump?.paperId === paper.id && citationJump.ownerId === paper.ownerId ? citationJump : null} onSelect={selectParagraph} onCreateAnnotation={createAnnotation} onEditAnnotation={editAnnotation} header={<div className="plab-reader-bar">
            <div className="paper-source-record"><span>{paper.id === samplePaper.id ? '示例论文 · 仅供阅读演示' : paper.fileName}</span><span>{paper.paragraphs.length} 段 · {new Set(paper.paragraphs.map(paragraph => paragraph.section)).size} 个章节</span></div>
            <div className="paper-title-edit">
              <PaperTitle key={paperKey} value={paper.title} onChange={title => updatePaper(current => ({...current, title,bibliography:current.bibliography?{...current.bibliography,confirmed:false}:undefined}))} />
            </div>
          </div>} tools={<><div className="reader-controls">
              <button className="mobile-paper-tool" type="button" aria-label="返回论文列表" onClick={()=>void returnToLibrary()}><ArrowLeft size={15} aria-hidden="true"/>论文列表</button>
              <span>全文阅读</span>
              {paper.id!==samplePaper.id&&<button className="desktop-paper-tool" type="button" onClick={()=>setBibliographyKey(paperKey)}>文献资料与引用{paper.bibliography?.confirmed?' · 已确认':''}</button>}
              <button className="mobile-paper-tool" type="button" popoverTarget="mobile-paper-tools">论文工具</button>
              <div id="mobile-paper-tools" popover="auto" className={craft.mobileTools} onToggle={event=>{if(event.newState==='open')event.currentTarget.querySelector<HTMLButtonElement>('button')?.focus();}}>
                <h3>论文工具</h3>{paper.id!==samplePaper.id&&<button type="button" onClick={()=>{document.getElementById('mobile-paper-tools')?.hidePopover();setBibliographyKey(paperKey);}}>文献资料与引用</button>}
                <label>手机正文字号<select value={fontSize} onChange={event=>{const size=Number(event.target.value);setFontSize(size);try{localStorage.setItem('acaora:paper-font-size',String(size));}catch{/* Optional preference. */}}}>{[18,20,22].map(size=><option key={size} value={size}>{size} px</option>)}</select></label>
                <button type="button" disabled={translationState==='unsupported'||translationState==='working'} onClick={()=>{document.getElementById('mobile-paper-tools')?.hidePopover();void translateParagraphs('all');}}>翻译全部未译段落</button>
                <button type="button" popoverTarget="mobile-paper-tools" popoverTargetAction="hide">关闭工具</button>
              </div>
          {paper.id !== samplePaper.id && <OriginalPdf key={`${paper.ownerId ?? 'guest'}:${paper.id}`} paper={paper} request={pdfRequest?.paperId === paper.id && pdfRequest.ownerId === paper.ownerId ? pdfRequest : undefined} onRequestHandled={() => setPdfRequest(undefined)} onRepair={(source, title, sections) => {
            if (paperRef.current.id !== source.id || (source.ownerId ?? null) !== userIdRef.current) return;
            updatePaper(current => current.id === source.id && current.ownerId === source.ownerId ? {...current, title: current.title === source.title && !current.bibliography?.confirmed ? title : current.title, paragraphs: current.paragraphs.map((paragraph, index) => {const original=source.paragraphs[index];return original?.id===paragraph.id&&original.original===paragraph.original&&original.section===paragraph.section?{...paragraph,section:sections[index]??paragraph.section}:paragraph;})} : current);
          }} />}
              <div className="paper-reading-preferences desktop-paper-tool"><label>字号<select aria-label="正文字号" value={fontSize} onChange={event => {const size = Number(event.target.value); setFontSize(size); try {localStorage.setItem('acaora:paper-font-size', String(size));} catch { /* Optional preference. */ }}}>{[18,20,22].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
              {(trailEntries.length > 0 || forwardEntries.length > 0) && <div className="paper-reading-trail"><button type="button" aria-label="返回刚才的位置" title="返回（阅读区内 Alt＋←）" disabled={!trailEntries.length} onClick={() => returnToReading(trailEntries.length - 1)}><ArrowLeft size={15} aria-hidden="true" /><span>返回</span></button><button type="button" aria-label="前进到下一处阅读位置" title="前进（阅读区内 Alt＋→）" disabled={!forwardEntries.length} onClick={forwardToReading}><ArrowRight size={15} aria-hidden="true" /><span>前进</span></button>{trailEntries.length > 0 && <><button type="button" aria-label="阅读轨迹" popoverTarget="paper-reading-history" onClick={event => {
                const node = document.getElementById('paper-reading-history');
                if (!node) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                node.style.left = `${Math.max(16, Math.min(bounds.left, innerWidth - 316))}px`;
                node.style.top = `${Math.max(16, Math.min(bounds.bottom + 8, innerHeight - 220))}px`;
              }}><History size={15} aria-hidden="true"/><span>阅读轨迹</span></button><nav id="paper-reading-history" popover="auto" aria-label="阅读轨迹">{trailEntries.map((entry, index) => <button type="button" key={index} onClick={event => {event.currentTarget.closest('nav')?.hidePopover(); returnToReading(index);}}>{entry.section} · 第 {entry.anchor.index + 1} 段{entry.mode === 'ai' ? ' · AI 分析' : ''}</button>)}</nav></>}</div>}
              <button type="button" aria-pressed={showTranslations} onClick={() => setShowTranslations(value => !value)}>{showTranslations ? '隐藏译文' : '显示译文'}</button>
            </div>
            <div className="plab-reader-progress">
              <b className="journal-num">{paper.id===samplePaper.id?'示例论文':`${completion}% 已读`}</b>
              <i style={{ width: `${completion}%` }} />
            </div>
          </>} />
        </section>

        {/* Notes belong to the active paragraph; rule-based hints open on demand. */}
        <aside id="paper-notes" className={`plab-rail ${mobilePanel === "insight" ? "mobile-visible" : ""}`}>
          <div className="plab-rail-head"><h2>笔记与批注</h2><span role="status">{saveLabel}</span>{saveFeedback?.key === paperKey && saveFeedback.state === "error" && <button type="button" onClick={() => updatePaper(current => ({...current}))}>重试保存</button>}<button className="paper-panel-close" type="button" aria-label="收起笔记" onClick={() => {setAnnotationDraft(null);changePanels({...panels, notes: false}); setMobilePanel('reader'); (notesToggleRef.current?.getClientRects().length ? notesToggleRef.current : document.getElementById('paper-tab-reader'))?.focus();}}><X size={16} aria-hidden="true" /></button></div>
          {annotationDraft?.paperKey===JSON.stringify([paper.ownerId??null,paper.id])&&<AnnotationEditor key={annotationDraft.key} draft={annotationDraft} onSave={saveAnnotation} onCancel={()=>setAnnotationDraft(null)}/>}
          {noteParagraph && <div className="plab-rail-block">
            <p className="plab-reading-context">第 {noteIndex + 1} / {paper.paragraphs.length} 段 · 第 {noteParagraph.page} 页 · {noteParagraph.section}</p>
            <div className="paper-note-source desktop-paper-tool"><blockquote>{noteParagraph.original.slice(0,220)}{noteParagraph.original.length > 220 ? '…' : ''}</blockquote><div><SourcePreview key={`${paperKey}:${noteIndex}`} paper={paper} index={noteIndex} onNavigate={jumpToParagraph}/><button type="button" onClick={() => jumpToParagraph(noteIndex)}>定位原文</button><button type="button" aria-pressed={lockedNote?.key === paperKey && Boolean(lockedNote.pinned)} onClick={() => setLockedNote(lockedNote?.key === paperKey && lockedNote.pinned ? null : {key: paperKey, id: noteParagraph.id, pinned: true})}><Pin size={14} aria-hidden="true" />{lockedNote?.key === paperKey && lockedNote.pinned ? '取消固定' : '固定笔记'}</button></div></div>
            <textarea aria-label="段落笔记" onFocus={() => {if (innerWidth > 760) setLockedNote(previous => previous?.key === paperKey && previous.pinned ? previous : {key: paperKey, id: noteParagraph.id});}} onBlur={() => setLockedNote(previous => previous?.pinned ? previous : null)} value={noteParagraph.note} placeholder="记录重点、疑问或自己的解释……" onChange={(event) => updateActiveParagraph({ note: event.target.value })} />
            <div className="plab-rail-actions">
              <button type="button" aria-pressed={noteParagraph.bookmarked} onClick={() => updateActiveParagraph({bookmarked: !noteParagraph.bookmarked})}><Bookmark size={14} fill={noteParagraph.bookmarked ? 'currentColor' : 'none'} aria-hidden="true" />{noteParagraph.bookmarked ? '已收藏' : '收藏'}</button>
              <button type="button" aria-pressed={noteParagraph.read} onClick={() => updateActiveParagraph({read: !noteParagraph.read})}><Check size={14} aria-hidden="true" />{noteParagraph.read ? '已读' : '标记为已读'}</button>
              {paper.ownerId&&paper.id!==samplePaper.id&&<button type="button" onClick={()=>addEvidence(noteParagraph)}>加入项目</button>}
              <button type="button" onClick={() => {if (noteIndex !== activeIndex) jumpToParagraph(noteIndex); setMobilePanel('ai');}}>分析当前段落</button>
              <button type="button" disabled={translationState === 'unsupported' || translationState === 'working'} onClick={() => void translateParagraphs('current', noteIndex)}>翻译当前段落</button>
              <details className="paper-note-more desktop-paper-tool"><summary>更多工具</summary><button type="button" disabled={translationState === 'unsupported' || translationState === 'working'} onClick={() => void translateParagraphs('all')}>{translationState === 'working' ? `翻译中 ${translationProgress}%` : '翻译全部未译段落'}</button></details><button className="mobile-paper-tool" type="button" disabled={translationState === 'unsupported' || translationState === 'working'} onClick={() => void translateParagraphs('all')}>{translationState === 'working' ? `翻译中 ${translationProgress}%` : '翻译全部未译段落'}</button>
            </div>
          </div>}
          <NotesSummary key={`summary:${paperKey}`} paper={paper} onSelect={jumpToParagraph} onCompare={pinReference}/>
          <AnnotationPanel key={`annotations:${paperKey}`} paper={paper} onEdit={editAnnotation} onDelete={deleteAnnotation} onJump={jumpToParagraph} onCreate={createAnnotation} onCompare={pinReference} onAddToProject={paper.ownerId&&paper.id!==samplePaper.id?addEvidence:undefined}/>
          <details className="paper-reading-tools"><summary>翻译状态</summary>{!['working','done','error'].includes(translationState)&&<p>{translatorStatusLabel(translationState,isEdge)}</p>}<p>{translationStatusDetail(translationState,modelProgress)}</p></details>
          {insight && <details className="paper-hints">
            <summary>段落提示 <span>非 AI · 规则识别</span></summary>
            <div className="plab-rail-block"><strong className="plab-rail-role">{insight.role}</strong><p>{insight.explanation}</p></div>
            <div className="plab-rail-block"><h3>统计线索</h3>{insight.terms.length ? <div className="term-list">{insight.terms.map((term) => <b key={term}>{term}</b>)}</div> : <p>未识别到常见统计术语。</p>}</div>
            <div className="plab-rail-block"><h3>阅读检查</h3><ul className="plab-rail-questions">{insight.questions.map((question) => <li key={question}>{question}</li>)}</ul></div>
          </details>}

        </aside>
        {referenceOpen && reference && <ReferencePane key={paperKey} paper={paper} index={reference.index} activeIndex={activeIndex} width={referenceWidth} onResizeStart={() => {referenceResizeAnchor.current = navigationRef.current?.getPosition() ?? null;}} onResizeEnd={() => {referenceResizeAnchor.current = null;}} onWidth={width => {referencePendingAnchor.current = referenceResizeAnchor.current ?? navigationRef.current?.getPosition() ?? null; setReferenceWidth(width);}} onIndex={index => setReference({key: paperKey, index})} onJump={jumpToParagraph} onClose={closeReference}/>}
        </>}
      </section>

        <div id="paper-ai" className="paper-mode-content" hidden={mobilePanel !== "ai"}>
        {hydrated && (visited.ai || mobilePanel === 'ai') ? <AiStudio
          paper={paper}
          initialAction={new URLSearchParams(locationQuery??'').get('action')??undefined}
          activeParagraph={activeParagraph}
          activeIndex={activeIndex}
          mobileVisible={mobilePanel === "ai"}
          key={`${paper.ownerId ?? 'guest'}:${paper.id}`}
          onResult={applyAiResult}
          onCitation={jumpToParagraph}
          onSearchQuery={(query) => {
            if (paperRef.current.id !== paper.id || (paper.ownerId ?? null) !== userIdRef.current) return;
            setSearchQuery(query);
          }}
        /> : <AiConsoleSkeleton />}
        </div>

        <div id="paper-search" className="paper-mode-content" hidden={mobilePanel !== "search"}>
          {hydrated && (visited.search || mobilePanel === 'search') ? <LiteratureSearch seed={searchQuery}/> : mobilePanel === 'search' ? <DiscoverySkeleton/> : null}
        </div>
        </>}
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
  const loadingTask = pdfjs.getDocument({data: buffer});
  try {
  const document = await loadingTask.promise;
  const paragraphs: Paragraph[] = [];
  let currentSection = "未分节内容";
  let inferredTitle = file.name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
  let reachedReferences = false;
  const extractedPages: {lines:PdfLine[];height:number}[]=[];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string; transform: number[]; width: number } => "str" in item && 'width' in item && typeof item.str === "string" && Array.isArray(item.transform))
      .map((item) => ({ text: item.str.trim(), x: item.transform[4] ?? 0, y: Math.round(item.transform[5] ?? 0), width: item.width, size: Math.hypot(item.transform[2], item.transform[3]) }))
      .filter((item) => item.text);
    const viewport=page.getViewport({scale:1});
    const lines = readingOrderLines(items, viewport.width);

    if (pageNumber === 1) {
      inferredTitle = inferPdfTitle(lines, inferredTitle);
    }

    extractedPages.push({lines,height:viewport.height});
    onProgress(Math.round(pageNumber/document.numPages*80));
  }
  const cleanPages=stripRepeatedMargins(extractedPages);
  const evidenceText=cleanPages.flatMap(page=>page.lines.map(line=>line.text)).join(' ');
  const joinEvidence=buildPdfJoinEvidence(evidenceText);
  for(let index=0;index<cleanPages.length;index++){
    const pageNumber=index+1,lines=cleanPages[index].lines;
    let accumulator:PdfLine[]=[];
    let length=0;
    const flush=()=>{const text=joinPdfLines(accumulator,joinEvidence);if(text)paragraphs.push(makeParagraph(text,pageNumber,currentSection));accumulator=[];length=0;};
    const bodySize = bodyFontSize(lines);
    for (const item of lines) {
      const {text:line,size}=item;
      if (reachedReferences) break;
      const section = detectSection(line, size > bodySize + .5);
      if (section) {
        flush();
        if (['References', 'Acknowledgements', 'Supplementary Materials'].includes(section)) {reachedReferences = true; break;}
        currentSection = section;
        continue;
      }
      accumulator.push(item);length+=line.length;
      if (length > 520 && /[.!?)]$/.test(line)) flush();
    }
    flush();
    onProgress(80+Math.round(pageNumber/document.numPages*20));
  }

  const filtered = paragraphs.filter((paragraph) => paragraph.original.length > 0);
  if (!filtered.some(paragraph=>paragraph.original.length>=80)) throw new Error("没有识别到足够的可阅读文本。扫描版 PDF 暂不支持，请使用带文本层的论文。" );
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
  } finally {await loadingTask.destroy();}
}

function makeParagraph(original: string, page: number, section: string): Paragraph {
  return { id: crypto.randomUUID(), page, section, original: original.replace(/\s+/g, " ").trim(), translation: "", note: "", bookmarked: false, read: false };
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
