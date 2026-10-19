'use client';

import {memo, useEffect, useRef, useState, type KeyboardEvent} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import styles from './original-pdf.module.css';

export default function PdfThumbnails({pdf, current, rotation, onSelect}: {pdf: PDFDocumentProxy; current: number; rotation: number; onSelect: (page: number) => void}) {
  const root = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState<Set<number>>(new Set());
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(entries => {
      setVisible(previous => {
        const next = new Set(previous);
        for (const entry of entries) {const page = Number((entry.target as HTMLElement).dataset.pdfThumbnail); if (entry.isIntersecting) next.add(page); else next.delete(page);}
        return next.size === previous.size && [...next].every(page => previous.has(page)) ? previous : next;
      });
    }, {root: node, rootMargin: '160px'});
    node.querySelectorAll('[data-pdf-thumbnail]').forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [pdf]);
  useEffect(() => {
    const container = root.current, button = container?.querySelector<HTMLElement>(`[data-pdf-thumbnail="${current}"]`);
    if (!container || !button) return;
    const bounds = container.getBoundingClientRect(), target = button.getBoundingClientRect();
    if (target.top < bounds.top) container.scrollTop -= bounds.top - target.top;
    else if (target.bottom > bounds.bottom) container.scrollTop += target.bottom - bounds.bottom;
  }, [current]);
  function move(event: KeyboardEvent<HTMLButtonElement>, page: number) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? Math.min(pdf.numPages, page + 1) : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? Math.max(1, page - 1) : event.key === 'Home' ? 1 : event.key === 'End' ? pdf.numPages : null;
    if (next === null) return;
    event.preventDefault(); onSelect(next); root.current?.querySelector<HTMLButtonElement>(`[data-pdf-thumbnail="${next}"]`)?.focus({preventScroll: true});
  }
  return <nav ref={root} className={styles.thumbnails} aria-label="原 PDF 页览">
    {Array.from({length: pdf.numPages}, (_, index) => index + 1).map(page => <button key={page} type="button" data-pdf-thumbnail={page} aria-label={`查看原 PDF 第 ${page} 页`} aria-current={page === current ? 'page' : undefined} onClick={() => onSelect(page)} onKeyDown={event => move(event, page)}>
      <Thumbnail pdf={pdf} pageNumber={page} rotation={rotation} visible={visible.has(page) || page === current}/><span>第 {page} 页</span>
    </button>)}
  </nav>;
}

const Thumbnail = memo(function Thumbnail({pdf, pageNumber, rotation, visible}: {pdf: PDFDocumentProxy; pageNumber: number; rotation: number; visible: boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!visible || !canvas.current) return;
    const node = canvas.current;
    let active = true;
    let render: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    void pdf.getPage(pageNumber).then(page => {
      if (!active) return;
      const angle = (page.rotate + rotation) % 360;
      const base = page.getViewport({scale: 1, rotation: angle});
      const viewport = page.getViewport({scale: 96 / base.width, rotation: angle});
      node.width = Math.ceil(viewport.width * 1.5); node.height = Math.ceil(viewport.height * 1.5);
      node.style.width = `${viewport.width}px`; node.style.height = `${viewport.height}px`;
      render = page.render({canvas: node, viewport, transform: [1.5, 0, 0, 1.5, 0, 0]});
      return render.promise;
    }).catch(error => {if (active && error?.name !== 'RenderingCancelledException') setFailed(true);});
    return () => {active = false; render?.cancel();};
  }, [pdf, pageNumber, rotation, visible]);
  return <span className={styles.thumbnailImage} aria-hidden="true">{visible && !failed ? <canvas ref={canvas}/> : <span>{failed ? '缩略图不可用' : 'PDF'}</span>}</span>;
});
