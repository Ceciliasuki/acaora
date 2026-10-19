'use client';

import {useEffect, useRef, useState} from 'react';
import {ArrowLeftRight, ChevronLeft, ChevronRight, X} from 'lucide-react';
import type {PaperRecord} from './paper-types';
import styles from './reference-pane.module.css';

type Props = {paper: PaperRecord; index: number; activeIndex: number; width: number; onIndex: (index: number) => void; onWidth: (width: number) => void; onResizeStart: () => void; onResizeEnd: () => void; onJump: (index: number, pdf?: boolean) => void; onClose: () => void};

/** A second source position stays independent of the reading cursor and notes. */
export default function ReferencePane({paper, index, activeIndex, width, onIndex, onWidth, onResizeStart, onResizeEnd, onJump, onClose}: Props) {
  const [translation, setTranslation] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const pane = useRef<HTMLElement>(null);
  const drag = useRef<number | null>(null);
  const paragraph = paper.paragraphs[index];
  const selected = Math.min(index, paper.paragraphs.length - 1);
  useEffect(() => {body.current?.scrollTo({top: 0});}, [index]);
  if (!paragraph) return null;
  const clamp = (next: number) => Math.max(30, Math.min(50, Math.round(next)));
  const resize = (clientX: number) => {
    const bounds = pane.current?.parentElement?.getBoundingClientRect();
    if (bounds) onWidth(clamp((bounds.right - clientX) / bounds.width * 100));
  };
  return <>
    {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- The APG window splitter is a focusable separator with range values and pointer/arrow controls. */}
    <div className={styles.divider} role="separator" tabIndex={0} aria-label="调整原文对照宽度" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={50} aria-valuenow={width} aria-valuetext={`对照窗占 ${width}%`} style={{left: `calc(${100 - width}% - 6px)`}}
      onPointerDown={event => {onResizeStart(); drag.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event => {if (drag.current === event.pointerId) resize(event.clientX);}}
      onPointerUp={event => {drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); onResizeEnd();}}
      onPointerCancel={() => {drag.current = null; onResizeEnd();}} onDoubleClick={() => {onResizeStart(); onWidth(38); onResizeEnd();}}
      onKeyDown={event => {
        const next = event.key === 'ArrowLeft' ? width + 2 : event.key === 'ArrowRight' ? width - 2 : event.key === 'Home' ? 30 : event.key === 'End' ? 50 : null;
        if (next === null) return;
        event.preventDefault(); onResizeStart(); onWidth(clamp(next)); onResizeEnd();
      }}/>
    <aside ref={pane} id="paper-reference" className={styles.pane} aria-label="固定原文对照">
      <header><div><h2>原文对照</h2><p>独立查看另一处原文，主阅读位置保持不动。</p></div><button type="button" aria-label="关闭原文对照" onClick={onClose}><X size={16} aria-hidden="true"/></button></header>
      <div className={styles.navigation}>
        <label>对照段落<select aria-label="选择对照段落" value={selected} onChange={event => onIndex(Number(event.target.value))}>{paper.paragraphs.map((item, i) => <option key={item.id} value={i}>P{i + 1} · {item.section} · 第 {item.page} 页</option>)}</select></label>
        <div><button type="button" aria-label="上一个对照段落" disabled={!index} onClick={() => onIndex(index - 1)}><ChevronLeft size={16} aria-hidden="true"/></button><button type="button" aria-label="下一个对照段落" disabled={index >= paper.paragraphs.length - 1} onClick={() => onIndex(index + 1)}><ChevronRight size={16} aria-hidden="true"/></button><button type="button" disabled={index === activeIndex} onClick={() => onIndex(activeIndex)}>替换为当前段落</button></div>
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A named scrolling region needs keyboard scrolling even though its source text is read-only. */}
      <div ref={body} className={styles.body} role="region" aria-label="对照原文" tabIndex={0}>
        <p className={styles.location}>P{index + 1} · {paragraph.section} · 第 {paragraph.page} 页</p>
        <p className={styles.original}>{paragraph.original}</p>
        {translation && <div className={styles.translation}><strong>已有译文</strong><p>{paragraph.translation || '这一段还没有译文。可在主阅读区翻译后再对照。'}</p></div>}
      </div>
      <footer><button type="button" onClick={() => onJump(index)}>定位主阅读区</button><button type="button" disabled={index === activeIndex} onClick={() => {onIndex(activeIndex); onJump(index);}}><ArrowLeftRight size={15} aria-hidden="true"/>交换阅读位置</button><button type="button" aria-pressed={translation} onClick={() => setTranslation(value => !value)}>{translation ? '隐藏对照译文' : '显示对照译文'}</button>{paper.id !== 'sample-paper' && <button type="button" onClick={() => onJump(index, true)}>查看对应原 PDF 页</button>}</footer>
    </aside>
  </>;
}
