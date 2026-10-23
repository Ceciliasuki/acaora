"use client";

import {memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref} from 'react';
import type {Paragraph, PaperAnnotation, TextAnchor} from './paper-types';
import {annotationSegments} from './paper-annotations.mjs';
import SelectionTools from './selection-tools';
import {readingCue, useAnnotationCue} from '../components/reading-cue';
import MotionNavigation from '../components/motion-navigation';
import ReaderNavigator, {FindText, type NavigatorHandle} from './reader-navigator';
import {findInPaper, type FindOptions, type FindRange} from './reader-find';
import {inferTextLanguage} from './pdf-text';

export type ReadingAnchor = {index: number; offset: number};
export type ReaderNavigation = {getPosition: () => ReadingAnchor; restorePosition: (anchor: ReadingAnchor) => void};
type Props = {
  navigationRef?: Ref<ReaderNavigation>;
  onNavigate?: (index: number) => void;
  onBack?: () => void;
  onForward?: () => void;
  noteIndex?: number;
  header?: ReactNode;
  tools?: ReactNode;
  paperId: string;
  paragraphs: Paragraph[];
  activeIndex: number;
  showTranslations: boolean;
  mode: string;
  onSelect: (index: number) => void;
  jump?: {index: number; id: number; offset?: number} | null;
  onCreateAnnotation: (anchors:TextAnchor[],highlightOnly:boolean)=>void;
  onEditAnnotation: (paragraphId:string,annotation:PaperAnnotation)=>void;
};

export default memo(function ContinuousReader({navigationRef, onNavigate, onBack, onForward, noteIndex, header, tools, paperId, paragraphs, activeIndex, showTranslations, mode, onSelect, jump,onCreateAnnotation,onEditAnnotation}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  useAnnotationCue(rootRef, JSON.stringify(paragraphs.flatMap(p => (p.annotations ?? []).map(a => a.id))));
  const navigatorRef = useRef<NavigatorHandle>(null);
  const [find, setFind] = useState<FindOptions>({query: '', caseSensitive: false});
  const matches = useMemo(() => findInPaper(paragraphs, find), [paragraphs, find]);
  const matchRanges = useMemo(() => new Map(matches.map(match => [match.index, match.ranges])), [matches]);
  useEffect(() => {navigatorRef.current?.close();}, [mode]);
  const currentRef = useRef(activeIndex);
  const positioningRef = useRef(false);
  const positionFrameRef = useRef(0);
  const handledJump = useRef<number | null>(null);
  const sections = useMemo(() => [...new Set(paragraphs.map(p => p.section))], [paragraphs]);
  const remembered = useRef<ReadingAnchor>({index: activeIndex, offset: 0});
  const hasPosition = useRef(false);
  const getPosition = useCallback(() => {
    const root = rootRef.current;
    const node = root?.querySelector<HTMLElement>(`[data-paragraph-index="${currentRef.current}"]`);
    if (root?.getClientRects().length && node) {
      hasPosition.current = true;
      const navigation = root.querySelector<HTMLElement>('.paper-reading-navigation');
      const inset = navigation && getComputedStyle(navigation).position === 'sticky' ? navigation.offsetHeight : 0;
      const pane = getComputedStyle(root).overflowY !== 'visible';
      const tabs = document.querySelector<HTMLElement>('.paper-mobile-tabs');
      const anchor = (pane ? root.getBoundingClientRect().top : tabs?.offsetHeight ?? 0) + inset + 24;
      remembered.current = {index: currentRef.current, offset: node.getBoundingClientRect().top - anchor};
    }
    return remembered.current;
  }, []);

  useEffect(() => {currentRef.current = activeIndex;}, [activeIndex]);

  const select = useCallback((index: number) => {
    if (currentRef.current === index) return;
    currentRef.current = index;
    onSelect(index);
  }, [onSelect]);

  const position = useCallback((index: number, offset = 0) => {
    const root = rootRef.current;
    const node = root?.querySelector<HTMLElement>(`[data-paragraph-index="${index}"]`);
    if (!root || !node) return;
    if (!root.getClientRects().length) {remembered.current = {index, offset}; hasPosition.current = true; return;}
    hasPosition.current = true;
    positioningRef.current = true;
    cancelAnimationFrame(positionFrameRef.current);
    if (getComputedStyle(root).overflowY !== 'visible') {
      const chapters = root.querySelector<HTMLElement>('.paper-reading-navigation, .section-chips');
      const inset = chapters && getComputedStyle(chapters).position === 'sticky' ? chapters.offsetHeight : 0;
      root.scrollTop += node.getBoundingClientRect().top - root.getBoundingClientRect().top - inset - 24 - offset;
    } else {
      const tabs = document.querySelector<HTMLElement>('.paper-mobile-tabs');
      const navigation = root.querySelector<HTMLElement>('.paper-reading-navigation');
      const inset = navigation && getComputedStyle(navigation).position === 'sticky' ? navigation.offsetHeight : 0;
      window.scrollTo({top: window.scrollY + node.getBoundingClientRect().top - (tabs?.offsetHeight ?? 0) - inset - 24 - offset, behavior: 'instant'});
    }
    positionFrameRef.current = requestAnimationFrame(() => {
      positionFrameRef.current = requestAnimationFrame(() => {positioningRef.current = false;});
    });
  }, []);
  useImperativeHandle(navigationRef, () => ({getPosition, restorePosition: anchor => {select(anchor.index); position(anchor.index, anchor.offset);}}), [getPosition, select, position]);

  useEffect(() => {
    if (!jump || jump.index >= paragraphs.length) return;
    let clearCue = () => {};
    const frame = requestAnimationFrame(() => {
      clearCue = readingCue(rootRef.current?.querySelector<HTMLElement>(`[data-paragraph-index="${jump.index}"] [data-original-text]`) ?? null);
      position(jump.index, jump.offset); handledJump.current = jump.id;
      // Find stays keyboard-operable while Enter cycles through source locations.
      if (!rootRef.current?.querySelector('[data-reader-find]')?.contains(document.activeElement)) rootRef.current?.focus({preventScroll: true});
    });
    return () => {cancelAnimationFrame(frame); clearCue();};
  }, [jump, paragraphs.length, position]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    let disposed = false;
    let restoring = currentRef.current > 0;
    const newJump = Boolean(jump && jump.id !== handledJump.current);
    const resume = () => {restoring = false;};
    const nodes = root.querySelectorAll<HTMLElement>('[data-paragraph-index]');
    // Paragraph starts are ordered. Binary search avoids measuring every paragraph
    // on each frame of a long paper; scrolling never marks content as read.
    const trackPosition = () => {
      if (restoring || positioningRef.current || !root.getClientRects().length) return;
      const bounds = root.getBoundingClientRect();
      const pane = getComputedStyle(root).overflowY !== 'visible';
      const tabs = document.querySelector<HTMLElement>('.paper-mobile-tabs');
      const chapters = root.querySelector<HTMLElement>('.paper-reading-navigation, .section-chips');
      const inset = chapters && getComputedStyle(chapters).position === 'sticky' ? chapters.offsetHeight : 0;
      const anchor = pane ? bounds.top + inset + 24 : (tabs?.offsetHeight ?? 0) + inset + 24;
      if (!pane && (bounds.top >= window.innerHeight || bounds.bottom <= anchor)) return;
      let low = 0, high = nodes.length - 1, index = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        // scrollTop can round to a CSS pixel while font layout stays fractional.
        // A restored paragraph 0.125px below its anchor still owns the cursor.
        if (nodes[mid].getBoundingClientRect().top <= anchor + 1) {index = mid; low = mid + 1;}
        else high = mid - 1;
      }
      // A short final paragraph cannot reach the top anchor. At the end of a
      // scrollable article, its final paragraph still owns notes and AI context.
      const atEnd = pane
        ? root.scrollTop > 0 && root.scrollTop + root.clientHeight >= root.scrollHeight - 1
        : bounds.top < anchor && bounds.bottom <= window.innerHeight;
      if (nodes.length) {select(atEnd ? nodes.length - 1 : index); getPosition();}
    };
    const schedule = () => {cancelAnimationFrame(frame); frame = requestAnimationFrame(trackPosition);};
    let viewportWidth = window.innerWidth;
    // A breakpoint can switch between document and inner-pane scrolling.
    // A mobile browser toolbar changing only the height should not move the text.
    const resize = () => {
      if (window.innerWidth === viewportWidth) return;
      viewportWidth = window.innerWidth;
      cancelAnimationFrame(frame); if (hasPosition.current || currentRef.current > 0) position(currentRef.current, remembered.current.offset);
    };
    // The main navigation can reflow text without resizing the window. Keep the
    // same source anchor throughout that width change, including at breakpoints.
    let readerWidth = 0;
    const observer = new ResizeObserver(entries => {
      // Text can wrap at a fractional width even when integer clientWidth is
      // unchanged; skipping that final reflow loses the restored source anchor.
      const width = entries[0]?.contentRect.width ?? 0;
      if (!width || width === readerWidth) return;
      readerWidth = width;
      cancelAnimationFrame(frame);
      if (hasPosition.current || currentRef.current > 0) position(currentRef.current, remembered.current.offset);
    });
    observer.observe(root);
    root.addEventListener('scroll', schedule, {passive: true});
    root.addEventListener('wheel', resume, {passive: true});
    root.addEventListener('pointerdown', resume);
    root.addEventListener('keydown', resume);
    window.addEventListener('touchmove', resume, {passive: true});
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', resize);
    // This effect restores on mount/paper or mode change, not when scrolling changes the
    // active paragraph. Otherwise saving the position would pull the reader back.
    const restore = requestAnimationFrame(() => {
      if (newJump || (currentRef.current <= 0 && !hasPosition.current)) {restoring = false; return;}
      position(currentRef.current, remembered.current.offset);
      // A swapped webfont can change every paragraph's height after the first
      // restore. Preserve its source anchor until fonts settle; user input wins.
      void document.fonts.ready.then(() => {
        if (disposed || !restoring) return;
        position(currentRef.current, remembered.current.offset); restoring = false;
      });
    });
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame); cancelAnimationFrame(restore); cancelAnimationFrame(positionFrameRef.current);
      positioningRef.current = false;
      root.removeEventListener('scroll', schedule); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', resize);
      root.removeEventListener('wheel', resume); root.removeEventListener('pointerdown', resume); root.removeEventListener('keydown', resume);
      window.removeEventListener('touchmove', resume);
    };
  }, [paperId, paragraphs.length, mode, select, position, getPosition, jump]);

  useEffect(() => {
    const selected = rootRef.current?.querySelector<HTMLElement>('.section-chips [aria-current="location"]');
    const strip = selected?.parentElement;
    if (!selected || !strip) return;
    const a = selected.getBoundingClientRect(), b = strip.getBoundingClientRect();
    if (a.left < b.left) strip.scrollLeft -= b.left - a.left + 8;
    else if (a.right > b.right) strip.scrollLeft += a.right - b.right + 8;
  }, [activeIndex, mode]);

  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- The named reader supports keyboard scrolling and paragraph selection without pretending to be a different widget.
  return <div className="plab-reader-scroll" ref={rootRef} role="region" aria-label="论文正文" tabIndex={0} aria-keyshortcuts="ArrowUp ArrowDown Home End Alt+A Alt+M Control+f Meta+f Control+Alt+g Meta+Alt+g Alt+ArrowLeft Alt+ArrowRight"
    onKeyDown={event => {
      if (event.defaultPrevented || event.nativeEvent.isComposing || document.querySelector('dialog[open]')) return;
      const editing = (event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]');
      if (!editing && !event.shiftKey && event.altKey && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
        event.preventDefault(); navigatorRef.current?.openLocation(); return;
      }
      if (!editing && !event.shiftKey && event.altKey && !event.ctrlKey && !event.metaKey) {
        const move = event.key === 'ArrowLeft' ? onBack : event.key === 'ArrowRight' ? onForward : undefined;
        if (move) {event.preventDefault(); move(); return;}
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f' && !document.querySelector('dialog[open]')) {
        event.preventDefault(); navigatorRef.current?.openFind(); return;
      }
      if (event.target !== event.currentTarget || !paragraphs.length || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
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
    {header}
    <div className="paper-reading-navigation">
    <div className="paper-chapter-navigation">
    <ReaderNavigator ref={navigatorRef} paragraphs={paragraphs} activeIndex={activeIndex} find={find} matches={matches} onFind={setFind} onNavigate={index => {if (onNavigate) onNavigate(index); else {select(index); position(index);}}}/>
    {sections.length > 0 && <MotionNavigation className="section-chips" label="论文章节" value={paragraphs[activeIndex]?.section ?? ''}>{sections.map(section => <button key={section} type="button"
      className={paragraphs[activeIndex]?.section === section ? 'active' : ''} aria-current={paragraphs[activeIndex]?.section === section ? 'location' : undefined}
      onClick={() => {const index = paragraphs.findIndex(p => p.section === section); if (onNavigate) onNavigate(index); else {select(index); position(index);}}}>{section}</button>)}</MotionNavigation>}
    </div>
    {tools}
    </div>
    {paragraphs.length ? <article className="plab-page plab-continuous-text"><div className="plab-body">
      {paragraphs.map((paragraph, index) => <ReaderParagraph key={paragraph.id} paragraph={paragraph} index={index} active={index === activeIndex} noteActive={index === noteIndex}
        startsSection={index === 0 || paragraphs[index - 1].section !== paragraph.section} showTranslations={showTranslations} ranges={matchRanges.get(index)} onEditAnnotation={onEditAnnotation} />)}
    </div></article> : <div className="paper-empty"><strong>未识别到正文段落</strong><p>请使用包含文本层的 PDF，扫描版暂不支持。</p></div>}
    <SelectionTools rootRef={rootRef} onCreate={onCreateAnnotation}/>
  </div>;
});

// Only the previous/current paragraph changes during reading. Stable text and
// notes keep their existing objects, so React can skip the rest of the article.
const ReaderParagraph = memo(function ReaderParagraph({paragraph, index, active, noteActive, startsSection, showTranslations,ranges,onEditAnnotation}: {
  paragraph: Paragraph; index: number; active: boolean; noteActive: boolean; startsSection: boolean; showTranslations: boolean;
  ranges?: FindRange[];
  onEditAnnotation: (paragraphId:string,annotation:PaperAnnotation)=>void;
}) {
  const translationLanguage = inferTextLanguage(paragraph.translation);
  return <div className="plab-paragraph" data-paragraph-id={paragraph.id} data-paragraph-index={index} data-active={active} data-note-active={noteActive}>
    {startsSection && <h2>{paragraph.section}</h2>}
    <p data-original-text lang={inferTextLanguage(paragraph.original)}>{annotationSegments(paragraph).map(segment=>segment.annotation?<button type="button" key={segment.start} data-annotation-id={segment.annotation.id} className={`paper-text-mark color-${segment.annotation.color}`} aria-label={`查看批注：${segment.annotation.quote.slice(0,50)}`} onClick={()=>{if(window.getSelection()?.isCollapsed!==false)onEditAnnotation(paragraph.id,segment.annotation!);}}><FindText text={segment.text} start={segment.start} ranges={ranges}/></button>:<span key={segment.start}><FindText text={segment.text} start={segment.start} ranges={ranges}/></span>)}</p>
    {showTranslations && paragraph.translation && <div className="plab-inline-translation"><p lang={translationLanguage === 'zh' ? 'zh-CN' : translationLanguage}>{paragraph.translation}</p></div>}
  </div>;
});
