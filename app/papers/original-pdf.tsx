'use client';

import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import type {PaperRecord} from './paper-types';
import {getPaperPdf, savePaperPdf} from './paper-original-storage';
import {bodyFontSize, detectSection, inferPdfTitle, type PdfLine} from './pdf-text';
import styles from './original-pdf.module.css';

type Props = {paper: PaperRecord; onRepair: (source: PaperRecord, title: string, sections: string[]) => void};

export default function OriginalPdf({paper, onRepair}: Props) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<Blob | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(paper.paragraphs[paper.activeParagraph]?.page ?? 1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(800);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

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
      const scale = Math.min(2, width / page.getViewport({scale: 1}).width);
      const viewport = page.getViewport({scale});
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      render = page.render({canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0]});
      return render.promise;
    }).catch(caught => {if (active && caught?.name !== 'RenderingCancelledException') setError('这一页未能显示，请切换页面重试。');});
    return () => {active = false; render?.cancel();};
  }, [pdf, pageNumber, width]);

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
      for (let number = 1; number <= document.numPages; number++) {
        const content = await (await document.getPage(number)).getTextContent();
        const lines = new Map<number, {text: string; size: number; x: number}[]>();
        for (const item of content.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const y = Math.round(item.transform[5]);
          lines.set(y, [...(lines.get(y) ?? []), {text: item.str.trim(), size: Math.hypot(item.transform[2], item.transform[3]), x: item.transform[4]}]);
        }
        pages.push([...lines].sort(([a], [b]) => b - a).map(([y, items]) => ({y, size: Math.max(...items.map(item => item.size)), text: items.sort((a, b) => a.x - b.x).map(item => item.text).join(' ').replace(/\s+/g, ' ').trim()})));
      }
      const text = pages.flat().map(line => line.text).join(' ').replace(/\s+/g, ' ');
      const anchors = paper.paragraphs.slice(0, 3).map(p => p.original.replace(/\s+/g, ' ').slice(0, 100));
      if (!anchors.some(anchor => anchor.length >= 24 && text.includes(anchor))) throw new Error('文件内容与这篇论文不匹配，请选择导入时使用的原 PDF。');
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
    <button type="button" onClick={() => {setPageNumber(paper.paragraphs[paper.activeParagraph]?.page ?? 1); setOpen(true);}}>查看原 PDF</button>
    {open && <dialog ref={dialogRef} className={styles.dialog} aria-label="原 PDF" onCancel={() => setOpen(false)} onClose={() => setOpen(false)}>
      <header className={styles.header}><strong>原 PDF</strong><button type="button" aria-label="关闭原 PDF" onClick={() => setOpen(false)}>关闭</button></header>
      <p className={styles.privacy}>原文件只保存在当前设备，不上传；清除浏览器数据后需重新选择。</p>
      <div className={styles.controls}>
        {pdf && <><button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber(n => n - 1)}>上一页</button><label>页码 <input type="number" min={1} max={pdf.numPages} aria-label="原 PDF 页码" value={pageNumber} onChange={e => setPageNumber(Math.max(1, Math.min(pdf.numPages, Number(e.target.value) || 1)))} /> / {pdf.numPages}</label><button type="button" disabled={pageNumber >= pdf.numPages} onClick={() => setPageNumber(n => n + 1)}>下一页</button></>}
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
