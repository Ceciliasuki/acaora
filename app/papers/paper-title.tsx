'use client';

import {useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {Pencil} from 'lucide-react';
import craft from './reading-craft.module.css';

/** Use the textarea's own layout, rather than a differently-wrapping text copy. */
export default function PaperTitle({value, onChange}: {value: string; onChange: (value: string) => void}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const desktop = useSyncExternalStore(callback => {const query = matchMedia('(min-width: 761px)'); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback);}, () => matchMedia('(min-width: 761px)').matches, () => true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const displayed = desktop && editing ? draft : value;
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || CSS.supports('field-sizing', 'content')) return;
    let width = 0;
    const fit = () => {field.style.height = 'auto'; field.style.height = `${field.scrollHeight}px`;};
    const observer = new ResizeObserver(() => {
      if (field.clientWidth === width) return;
      width = field.clientWidth; fit();
    });
    observer.observe(field); fit();
    document.fonts.addEventListener('loadingdone', fit);
    return () => {observer.disconnect(); document.fonts.removeEventListener('loadingdone', fit);};
  }, [displayed]);
  const finish = (save: boolean) => {if (save && draft.trim()) onChange(draft.trim()); setEditing(false); requestAnimationFrame(() => fieldRef.current?.closest('.paper-title-control')?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll: true}));};
  return <div className="paper-title-control">
    <h2 className="paper-document-title" aria-label={value}><textarea ref={fieldRef} className={craft.titleField} rows={1} aria-label="论文标题" spellCheck={false} value={displayed} readOnly={desktop && !editing} tabIndex={desktop && !editing ? -1 : 0}
      onChange={event => {const next = event.target.value.replace(/[\r\n]+/g, ' '); if (desktop) setDraft(next); else onChange(next);}}
      onKeyDown={event => {if (event.nativeEvent.isComposing) return; if (desktop && event.key === 'Escape') {event.preventDefault(); finish(false);} if (event.key === 'Enter') {event.preventDefault(); if (desktop) finish(true); else event.currentTarget.blur();}}} /></h2>
    <div className="paper-title-actions desktop-paper-tool">{editing ? <><button type="button" disabled={!draft.trim()} onClick={() => finish(true)}>保存标题</button><button type="button" onClick={() => finish(false)}>取消编辑</button></> : <button type="button" onClick={() => {setDraft(value); setEditing(true); requestAnimationFrame(() => fieldRef.current?.focus({preventScroll: true}));}}><Pencil size={14} aria-hidden="true" />编辑标题</button>}</div>
  </div>;
}
