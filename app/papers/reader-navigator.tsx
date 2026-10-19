'use client';

import {useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref} from 'react';
import {ChevronDown, ChevronUp, List, Search, X} from 'lucide-react';
import type {Paragraph} from './paper-types';
import type {FindOptions, FindRange, FindResult} from './reader-find';
import styles from './reader-navigator.module.css';

export type NavigatorHandle = {openFind: () => void; close: () => void};
type Props = {
  ref?: Ref<NavigatorHandle>;
  paragraphs: Paragraph[];
  activeIndex: number;
  find: FindOptions;
  matches: FindResult[];
  onFind: (options: FindOptions) => void;
  onNavigate: (index: number) => void;
};

export function FindText({text, start = 0, ranges = []}: {text: string; start?: number; ranges?: FindRange[]}) {
  const pieces = [];
  let cursor = 0;
  for (const range of ranges) {
    const from = Math.max(0, range.start - start), to = Math.min(text.length, range.end - start);
    if (to <= from) continue;
    if (from > cursor) pieces.push(text.slice(cursor, from));
    pieces.push(<mark className={styles.match} key={from}>{text.slice(from, to)}</mark>);
    cursor = to;
  }
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return <>{pieces}</>;
}

export default function ReaderNavigator({ref, paragraphs, activeIndex, find, matches, onFind, onNavigate}: Props) {
  const id = useId();
  const surface = useRef<HTMLDivElement>(null);
  const outlineButton = useRef<HTMLButtonElement>(null);
  const findButton = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const modeRef = useRef<'outline' | 'find'>('outline');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'outline' | 'find'>('outline');
  const [outlineQuery, setOutlineQuery] = useState('');
  const [selected, setSelected] = useState(-1);
  const chapters = useMemo(() => paragraphs.flatMap((paragraph, index) => {
    if (index && paragraphs[index - 1].section === paragraph.section) return [];
    let end = index + 1;
    while (end < paragraphs.length && paragraphs[end].section === paragraph.section) end++;
    return [{index, end, title: paragraph.section, page: paragraph.page}];
  }), [paragraphs]);
  const visibleChapters = chapters.filter(chapter => chapter.title.toLocaleLowerCase().includes(outlineQuery.trim().toLocaleLowerCase()));

  const close = useCallback((restoreFocus = true) => {
    surface.current?.hidePopover();
    if (restoreFocus) (modeRef.current === 'outline' ? outlineButton : findButton).current?.focus({preventScroll: true});
  }, []);
  const place = useCallback(() => {
    const node = surface.current, button = (modeRef.current === 'outline' ? outlineButton : findButton).current;
    if (!node || !button) return;
    const bounds = button.getBoundingClientRect();
    const viewport = window.visualViewport;
    const bottom = (viewport?.height ?? innerHeight) + (viewport?.offsetTop ?? 0);
    const width = Math.min(420, innerWidth - 32);
    node.style.width = `${width}px`;
    node.style.left = `${Math.max(16, Math.min(bounds.left, innerWidth - width - 16))}px`;
    node.style.top = `${Math.max((viewport?.offsetTop ?? 0) + 16, Math.min(bounds.bottom + 8, bottom - 280))}px`;
    node.style.maxHeight = `${Math.max(80, bottom - Number.parseFloat(node.style.top) - 16)}px`;
  }, []);
  function show(next: 'outline' | 'find') {
    const node = surface.current;
    if (!node) return;
    modeRef.current = next;
    place();
    setMode(next);
    setOpen(true);
    node.showPopover();
    requestAnimationFrame(() => {input.current?.focus({preventScroll: true}); input.current?.select();});
  }
  useImperativeHandle(ref, () => ({openFind: () => show('find'), close: () => close(false)}));
  useEffect(() => {
    if (!open) return;
    const keys = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !surface.current?.matches(':popover-open')) return;
      event.preventDefault(); event.stopPropagation(); close();
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    document.addEventListener('keydown', keys, true);
    return () => {window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place); document.removeEventListener('keydown', keys, true);};
  }, [open, close, place]);

  function move(direction: number) {
    if (!matches.length) return;
    const next = selected < 0 ? (direction > 0 ? 0 : matches.length - 1) : (selected + direction + matches.length) % matches.length;
    setSelected(next);
    onNavigate(matches[next].index);
  }
  function updateFind(next: FindOptions) {setSelected(-1); onFind(next);}

  return <div className={styles.controls}>
    <button ref={outlineButton} type="button" aria-label="章节目录" aria-controls={id} aria-expanded={open && mode === 'outline'} onClick={() => open && mode === 'outline' ? close() : show('outline')}><List size={16} aria-hidden="true"/><span>目录</span></button>
    <button ref={findButton} type="button" aria-label="文内查找" title="文内查找（阅读区内 Ctrl / ⌘ + F）" aria-controls={id} aria-expanded={open && mode === 'find'} onClick={() => open && mode === 'find' ? close() : show('find')}><Search size={16} aria-hidden="true"/><span>查找</span></button>
    <div ref={surface} id={id} popover="auto" className={styles.surface} role="region" aria-label={mode === 'outline' ? '章节目录' : '文内查找'} data-reader-find={mode === 'find' ? '' : undefined} onToggle={event => setOpen(event.newState === 'open')}>
      <header><strong>{mode === 'outline' ? '章节目录' : '文内查找'}</strong><button type="button" aria-label={mode === 'outline' ? '关闭章节目录' : '关闭文内查找'} onClick={() => close()}><X size={16} aria-hidden="true"/></button></header>
      {mode === 'outline' ? <>
        <input ref={input} type="search" aria-label="筛选章节" value={outlineQuery} placeholder="输入章节名称" onChange={event => setOutlineQuery(event.target.value)}/>
        <nav className={styles.results} aria-label="章节列表">
          {visibleChapters.map(chapter => <button key={chapter.index} type="button" aria-current={activeIndex >= chapter.index && activeIndex < chapter.end ? 'location' : undefined} onClick={() => {close(false); onNavigate(chapter.index);}}><strong>{chapter.title}</strong><span>第 {chapter.page} 页 · {chapter.end - chapter.index} 段</span></button>)}
          {!visibleChapters.length && <p role="status">没有匹配的章节，请换一个名称。</p>}
        </nav>
      </> : <>
        <input ref={input} type="search" aria-label="查找论文原文" maxLength={160} value={find.query} placeholder="查找原文中的词句" onChange={event => updateFind({...find, query: event.target.value})} onKeyDown={event => {if (event.key === 'Enter' && !event.nativeEvent.isComposing) {event.preventDefault(); move(event.shiftKey ? -1 : 1);}}}/>
        <div className={styles.findOptions}><label><input type="checkbox" checked={find.caseSensitive} onChange={event => updateFind({...find, caseSensitive: event.target.checked})}/>区分大小写</label><div><button type="button" aria-label="上一个匹配段落" disabled={!matches.length} onClick={() => move(-1)}><ChevronUp size={16} aria-hidden="true"/></button><button type="button" aria-label="下一个匹配段落" disabled={!matches.length} onClick={() => move(1)}><ChevronDown size={16} aria-hidden="true"/></button></div></div>
        <p className={styles.status} role="status">{!find.query.trim() ? '仅查找当前论文原文；Enter 下一段，Shift＋Enter 上一段。' : matches.length ? `${matches.length} 个段落匹配${selected >= 0 ? ` · 当前第 ${selected + 1} 个` : ''}` : '原文中没有匹配，请缩短词句或取消区分大小写。'}</p>
        <div className={styles.results}>
          {matches.slice(0, 100).map((match, resultIndex) => {
            const paragraph = paragraphs[match.index];
            const start = Math.max(0, match.ranges[0].start - 45);
            const excerpt = paragraph.original.slice(start, match.ranges[0].end + 90);
            return <button key={match.index} type="button" aria-label={`定位匹配段落 P${match.index + 1}`} aria-pressed={selected === resultIndex} onClick={() => {setSelected(resultIndex); onNavigate(match.index);}}><span>P{match.index + 1} · {paragraph.section} · 第 {paragraph.page} 页</span><p>{start > 0 && '…'}<FindText text={excerpt} start={start} ranges={match.ranges}/>{start + excerpt.length < paragraph.original.length && '…'}</p></button>;
          })}
          {matches.length > 100 && <p>展示前 100 个匹配段落；用前后按钮可继续遍历全部结果。</p>}
        </div>
        {find.query && <button className={styles.clear} type="button" onClick={() => {updateFind({...find, query: ''}); input.current?.focus();}}>清除查找与高亮</button>}
      </>}
    </div>
  </div>;
}
