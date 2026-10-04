"use client";

import {useCallback, useEffect, useRef} from 'react';
import type {Paragraph} from './paper-types';

type Props = {
  paperId: string;
  paragraphs: Paragraph[];
  activeIndex: number;
  showTranslations: boolean;
  mode: string;
  onSelect: (index: number) => void;
};

export default function ContinuousReader({paperId, paragraphs, activeIndex, showTranslations, mode, onSelect}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(activeIndex);
  const positioningRef = useRef(false);
  const positionFrameRef = useRef(0);
  const sections = [...new Set(paragraphs.map(p => p.section))];

  useEffect(() => {currentRef.current = activeIndex;}, [activeIndex]);

  const select = useCallback((index: number) => {
    if (currentRef.current === index) return;
    currentRef.current = index;
    onSelect(index);
  }, [onSelect]);

  const position = useCallback((index: number) => {
    const root = rootRef.current;
    const node = root?.querySelector<HTMLElement>(`[data-paragraph-index="${index}"]`);
    if (!root || !node || !root.getClientRects().length) return;
    positioningRef.current = true;
    cancelAnimationFrame(positionFrameRef.current);
    if (getComputedStyle(root).overflowY !== 'visible') {
      root.scrollTop += node.getBoundingClientRect().top - root.getBoundingClientRect().top - 24;
    } else {
      const tabs = document.querySelector<HTMLElement>('.paper-mobile-tabs');
      window.scrollTo({top: window.scrollY + node.getBoundingClientRect().top - (tabs?.offsetHeight ?? 0) - 24, behavior: 'instant'});
    }
    positionFrameRef.current = requestAnimationFrame(() => {
      positionFrameRef.current = requestAnimationFrame(() => {positioningRef.current = false;});
    });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const nodes = root.querySelectorAll<HTMLElement>('[data-paragraph-index]');
    // Paragraph starts are ordered. Binary search avoids measuring every paragraph
    // on each frame of a long paper; scrolling never marks content as read.
    const trackPosition = () => {
      if (positioningRef.current || !root.getClientRects().length) return;
      const bounds = root.getBoundingClientRect();
      const pane = getComputedStyle(root).overflowY !== 'visible';
      const tabs = document.querySelector<HTMLElement>('.paper-mobile-tabs');
      const anchor = pane ? bounds.top + 24 : (tabs?.offsetHeight ?? 0) + 24;
      if (!pane && (bounds.top >= window.innerHeight || bounds.bottom <= anchor)) return;
      let low = 0, high = nodes.length - 1, index = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (nodes[mid].getBoundingClientRect().top <= anchor) {index = mid; low = mid + 1;}
        else high = mid - 1;
      }
      // A short final paragraph cannot reach the top anchor. At the end of a
      // scrollable article, its final paragraph still owns notes and AI context.
      const atEnd = pane
        ? root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 1
        : bounds.top < anchor && bounds.bottom <= window.innerHeight;
      if (nodes.length) select(atEnd ? nodes.length - 1 : index);
    };
    const schedule = () => {cancelAnimationFrame(frame); frame = requestAnimationFrame(trackPosition);};
    root.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    // Restore only on mount/paper or mode change, not when scrolling changes the
    // active paragraph. Otherwise saving the position would pull the reader back.
    const restore = requestAnimationFrame(() => {if (currentRef.current > 0) position(currentRef.current);});
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(restore); cancelAnimationFrame(positionFrameRef.current);
      positioningRef.current = false;
      root.removeEventListener('scroll', schedule); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
    };
  }, [paperId, paragraphs.length, mode, select, position]);

  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- The named reader supports keyboard scrolling and paragraph selection without pretending to be a different widget.
  return <div className="plab-reader-scroll" ref={rootRef} role="region" aria-label="论文正文" tabIndex={0} aria-keyshortcuts="ArrowUp ArrowDown Home End"
    onKeyDown={event => {
      if (event.target !== event.currentTarget || !paragraphs.length) return;
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? paragraphs.length - 1
        : event.key === 'ArrowUp' ? Math.max(0, currentRef.current - 1)
        : event.key === 'ArrowDown' ? Math.min(paragraphs.length - 1, currentRef.current + 1) : null;
      if (index === null) return;
      event.preventDefault(); select(index); position(index);
    }}
    onPointerUp={event => {
      if (window.getSelection()?.isCollapsed === false) return;
      const node = (event.target as HTMLElement).closest<HTMLElement>('[data-paragraph-index]');
      if (node) select(Number(node.dataset.paragraphIndex));
    }}>
    {sections.length > 0 && <nav className="section-chips" aria-label="论文章节">{sections.map(section => <button key={section} type="button"
      className={paragraphs[activeIndex]?.section === section ? 'active' : ''}
      onClick={() => {const index = paragraphs.findIndex(p => p.section === section); select(index); position(index);}}>{section}</button>)}</nav>}
    {paragraphs.length ? <article className="plab-page plab-continuous-text"><div className="plab-body">
      {paragraphs.map((paragraph, index) => <div key={paragraph.id} className="plab-paragraph" data-paragraph-id={paragraph.id} data-paragraph-index={index} data-active={index === activeIndex}>
        {(index === 0 || paragraphs[index - 1].section !== paragraph.section) && <h2>{paragraph.section}</h2>}
        <p>{paragraph.original}</p>
        {showTranslations && paragraph.translation && <div className="plab-inline-translation"><p>{paragraph.translation}</p></div>}
      </div>)}
    </div></article> : <div className="paper-empty"><strong>未识别到正文段落</strong><p>请使用包含文本层的 PDF，扫描版暂不支持。</p></div>}
  </div>;
}
