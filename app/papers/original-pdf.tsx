'use client';

import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import type {PaperRecord} from './paper-types';
import {getPaperPdf, savePaperPdf} from './paper-original-storage';
import {bodyFontSize, detectSection, inferPdfTitle, readingOrderLines, type PdfLine} from './pdf-text';
import styles from './original-pdf.module.css';

type Props = {paper: PaperRecord; request?: {page: number; id: number}; onRequestHandled: () => void; onRepair: (source: PaperRecord, title: string, sections: string[]) => void};

export default function OriginalPdf({paper, request, onRequestHandled, onRepair}: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<Blob | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(paper.paragraphs[paper.activeParagraph]?.page ?? 1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(800);
  const [pageWidth, setPageWidth] = useState(612);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const historyKey = `acaora:pdf-view:${JSON.stringify([paper.ownerId ?? null, paper.id])}`;
  const fitScale = Math.min(2, width / pageWidth);

  function restoreView(target?: number) {
    let saved: {page?: number; zoom?: number | 'fit'} = {};
    try {saved = JSON.parse(localStorage.getItem(historyKey) ?? '{}') ?? {};} catch { /* Device preferences are optional. */ }
    setPageNumber(target ?? (Number.isInteger(saved.page) && saved.page! > 0 ? saved.page! : paper.paragraphs[paper.activeParagraph]?.page ?? 1));
    setZoom(typeof saved.zoom === 'number' && Number.isFinite(saved.zoom) ? Math.max(.25, Math.min(3, saved.zoom)) : 'fit');
    setError(''); setOpen(true);
  }

  useEffect(() => {
    if (!request) return;
    let active = true;
    void Promise.resolve().then(() => {if (active) {restoreView(request.page); onRequestHandled();}});
    return () => {active = false;};
    // A citation explicitly requests a page; ordinary paper edits must not reopen the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (!open || !pdf) return;
    try {localStorage.setItem(historyKey, JSON.stringify({page: pageNumber, zoom}));} catch { /* Reading still works without history storage. */ }
  }, [historyKey, open, pdf, pageNumber, zoom]);

  useEffect(() => {mountedRef.current = true; return () => {mountedRef.current = false;};}, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current!;
    dialog.showModal();
    let active = true;
    void getPaperPdf(paper.id, paper.ownerId ?? null).then(blob => {if (active) setFile(blob);}).catch(() => {if (active) setError('无法读取设备中的原 PDF，请重新选择文件。');});
    const observer = new ResizeObserver(entries => setWidth(Math.max(200, entries[0].contentRect.width - 32)));
    observer.observe(bodyRef.current!);
    return () => {active = false; observer.disconnect(); dialog.close();};
  }, [open, paper.id, paper.ownerId]);

  useEffect(() => {
    if (!open || !file) return;
    let active = true;
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    void (async () => {
      const pdfjs = await import('pdfjs-dist');
      if (!active) return;
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!active) return;
      task = pdfjs.getDocument({data: bytes});
      const document = await task.promise;
      if (active) {setPdf(document); setPageNumber(number => Math.max(1, Math.min(number, document.numPages)));}
    })().catch(() => {if (active) setError('原 PDF 无法打开；加密或损坏的文件可能不受支持。');});
    return () => {active = false; setPdf(null); void task?.destroy();};
  }, [file, open]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let active = true;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    const canvas = canvasRef.current;
    void pdf.getPage(pageNumber).then(page => {
      if (!active) return;
      const baseWidth = page.getViewport({scale: 1}).width;
      setPageWidth(baseWidth);
      const scale = zoom === 'fit' ? Math.min(2, width / baseWidth) : zoom;
      const viewport = page.getViewport({scale});
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(16_000_000 / (viewport.width * viewport.height)));
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      render = page.render({canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0]});
      return render.promise;
    }).catch(caught => {if (active && caught?.name !== 'RenderingCancelledException') setError('这一页未能显示，请切换页面重试。');});
    return () => {active = false; render?.cancel();};
  }, [pdf, pageNumber, width, zoom]);

  async function attach(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    if (selected.size > 50 * 1024 * 1024) {setError('请选择不超过 50 MB 的 PDF。'); return;}
    setBusy(true); setError('');
    let document: PDFDocumentProxy | undefined;
    let loadingTask: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      loadingTask = pdfjs.getDocument({data: new Uint8Array(await selected.arrayBuffer())});
      document = await loadingTask.promise;
      const pages: PdfLine[][] = [];
      const legacyText: string[] = [];
      for (let number = 1; number <= document.numPages; number++) {
        const content = await (await document.getPage(number)).getTextContent();
        const items = content.items.filter((item): item is typeof item & {str: string; transform: number[]; width: number} => 'str' in item && 'width' in item && Boolean(item.str.trim())).map(item => ({text: item.str.trim(), size: Math.hypot(item.transform[2], item.transform[3]), x: item.transform[4], y: Math.round(item.transform[5]), width: item.width}));
        const lines = new Map<number, {text: string; size: number; x: number}[]>();
        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const y = Math.round(item.transform[5]);
          lines.set(y, [...(lines.get(y) ?? []), {text: item.str.trim(), size: Math.hypot(item.transform[2], item.transform[3]), x: item.transform[4]}]);
        }
        legacyText.push([...lines].sort(([a], [b]) => b - a).map(([, items]) => items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ')).join(' '));
        pages.push(readingOrderLines(items, (await document.getPage(number)).getViewport({scale: 1}).width));
      }
      const text = pages.flat().map(line => line.text).join(' ').replace(/\s+/g, ' ');
      const anchors = paper.paragraphs.slice(0, 3).map(p => p.original.replace(/\s+/g, ' ').slice(0, 100));
      const oldText = legacyText.join(' ').replace(/\s+/g, ' ');
      if (!anchors.some(anchor => anchor.length >= 24 && (text.includes(anchor) || oldText.includes(anchor)))) throw new Error('文件内容与这篇论文不匹配，请选择导入时使用的原 PDF。');
      await savePaperPdf(paper.id, paper.ownerId ?? null, selected);
      if (!mountedRef.current) return;
      setFile(selected);
      const inferred = inferPdfTitle(pages[0], paper.title);
      const title = inferred.startsWith(paper.title) && paper.paragraphs[0]?.original.startsWith(inferred) ? inferred : paper.title;
      const headings = pages.flatMap(lines => {
        const bodySize = bodyFontSize(lines);
        return lines.filter(line => /^\d+(?:\.\d+)*[.)]?\s+/.test(line.text) && detectSection(line.text, line.size > bodySize + .5));
      });
      let section: string | null = null;
      const sections = paper.paragraphs.map((paragraph, index) => {
        if (index && paper.paragraphs[index - 1].section !== paragraph.section) section = null;
        let lastPosition = -1;
        for (const heading of headings) {
          const position = paragraph.original.indexOf(heading.text);
          if (position > lastPosition) {section = detectSection(heading.text, true); lastPosition = position;}
        }
        return section ?? paragraph.section;
      });
      onRepair(paper, title, sections);
    } catch (caught) {if (mountedRef.current) setError(caught instanceof Error ? caught.message : '原 PDF 未能保存，请重试。');}
    finally {void loadingTask?.destroy(); if (mountedRef.current) setBusy(false);}
  }

  return <>
    <button type="button" onClick={() => restoreView()}>查看原 PDF</button>
    {open && <dialog ref={dialogRef} className={styles.dialog} aria-label="原 PDF" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header className={styles.header}><strong>原 PDF</strong><button type="button" aria-label="关闭原 PDF" onClick={() => setOpen(false)}>关闭</button></header>
      <p className={styles.privacy}>原文件只保存在当前设备，不上传；清除浏览器数据后需重新选择。</p>
      <div className={styles.controls}>
        {pdf && <><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(n => n - 1)}>上一页</button><label>页码 <input type="number" min={1} max={pdf.numPages} aria-label="原 PDF 页码" value={pageNumber} onChange={e => setPageNumber(Math.max(1, Math.min(pdf.numPages, Number(e.target.value) || 1)))} /> / {pdf.numPages}</label><button type="button" disabled={pageNumber >= pdf.numPages} onClick={() => setPageNumber(n => n + 1)}>下一页</button></>}
        {pdf && <div className={styles.zoom} aria-label="原 PDF 缩放">
          <button type="button" aria-label="缩小原 PDF" disabled={zoom !== 'fit' && zoom <= .25} onClick={() => setZoom(Math.max(.25, (zoom === 'fit' ? fitScale : zoom) - .25))}>−</button>
          <output aria-label="原 PDF 缩放比例">{Math.round((zoom === 'fit' ? fitScale : zoom) * 100)}%</output>
          <button type="button" aria-label="放大原 PDF" disabled={zoom !== 'fit' && zoom >= 3} onClick={() => setZoom(Math.min(3, (zoom === 'fit' ? fitScale : zoom) + .25))}>+</button>
          <button type="button" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>适合宽度</button>
        </div>}
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? '正在检查原文件…' : file ? '重新选择原 PDF' : '选择原 PDF'}</button>
        <input ref={inputRef} type="file" hidden accept="application/pdf,.pdf" aria-label="选择当前论文的原 PDF" onChange={attach} />
      </div>
      {error && <p role="alert">{error}</p>}
      <div className={styles.body} ref={bodyRef}>
        {pdf ? <canvas ref={canvasRef} aria-label={`原 PDF 第 ${pageNumber} 页`} role="img" /> : <p>{file ? '正在打开原 PDF…' : '此设备尚未保存原文件。选择这篇论文的原 PDF，即可按原页查看图表；原有笔记和段落编号会保留。'}</p>}
      </div>
    </dialog>}
  </>;
}
