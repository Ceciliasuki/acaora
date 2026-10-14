'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Eye, X} from 'lucide-react';
import type {PaperRecord} from './paper-types';

/** A source peek never changes the reading cursor until a navigation is chosen. */
export default function SourcePreview({paper, index, onNavigate}: {paper: PaperRecord; index: number; onNavigate: (index: number, originalPdf?: boolean) => void}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const paragraph = paper.paragraphs[index];
  const cancel = () => {clearTimeout(timer.current);};
  const close = () => {cancel(); surface.current?.hidePopover();};
  function show(keyboard = false) {
    cancel();
    const node = surface.current, button = trigger.current;
    if (!node || !button) return;
    const bounds = button.getBoundingClientRect();
    const width = Math.min(420, innerWidth - 32);
    node.style.width = `${width}px`;
    node.style.left = `${Math.max(16, Math.min(bounds.right - width, innerWidth - width - 16))}px`;
    node.style.maxHeight = `${Math.min(500, innerHeight - 32)}px`;
    node.showPopover();
    const height = node.getBoundingClientRect().height;
    const below = innerHeight - bounds.bottom - 24;
    const above = bounds.top - 24;
    if (height <= below) node.style.top = `${bounds.bottom + 8}px`;
    else {
      const upward = above >= below;
      node.style.maxHeight = `${Math.max(1, upward ? above : below)}px`;
      node.style.top = `${upward ? Math.max(16, bounds.top - node.getBoundingClientRect().height - 8) : bounds.bottom + 8}px`;
    }
    if (keyboard) node.focus({preventScroll: true});
  }
  useEffect(() => {
    if (!open) return;
    const hide = (event?: Event) => {if (event?.target instanceof Node && surface.current?.contains(event.target)) return; surface.current?.hidePopover();};
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !surface.current?.matches(':popover-open')) return;
      event.preventDefault(); event.stopPropagation(); hide(); trigger.current?.focus({preventScroll: true});
    };
    window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide);
    document.addEventListener('keydown', keys, true);
    return () => {clearTimeout(timer.current); window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); document.removeEventListener('keydown', keys, true);};
  }, [open]);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!paragraph) return null;
  const navigate = (pdf = false) => {close(); onNavigate(index, pdf);};
  return <span className="paper-source-peek desktop-paper-tool" onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) close();}} onPointerEnter={() => {cancel(); timer.current = setTimeout(() => show(), 250);}} onPointerLeave={() => {cancel(); if (!surface.current?.contains(document.activeElement)) timer.current = setTimeout(close, 250);}}>
    <button ref={trigger} type="button" className="paper-peek-trigger" aria-label={`预览原文第 ${index + 1} 段`} aria-expanded={open} aria-controls={id} onClick={event => {if (open) close(); else show(event.detail === 0);}}><Eye size={15} aria-hidden="true" /></button>
    <div ref={surface} id={id} popover="auto" className="paper-source-preview" role="dialog" aria-label={`原文预览：第 ${index + 1} 段`} tabIndex={-1}
      onToggle={event => setOpen(event.newState === 'open')}>
      <header><strong>原文 · 第 {index + 1} 段</strong><button type="button" aria-label="关闭原文预览" onClick={() => {close(); trigger.current?.focus({preventScroll: true});}}><X size={16} aria-hidden="true" /></button></header>
      <p className="paper-preview-source">{paragraph.section} · 第 {paragraph.page} 页</p>
      <blockquote>{paragraph.original}</blockquote>
      <footer><button type="button" onClick={() => navigate()}>定位正文</button>{paper.id !== 'sample-paper' && <button type="button" onClick={() => navigate(true)}>打开原 PDF 页</button>}</footer>
    </div>
  </span>;
}
