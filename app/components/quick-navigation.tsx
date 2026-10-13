"use client";

import {ArrowUpRight, Search, X} from 'lucide-react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useId, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {navigation} from './workspace-navigation';

export default function QuickNavigation({onNavigate}: {onNavigate: () => void}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const id = useId();
  const router = useRouter();
  const results = navigation.filter(item => `${item.label} ${item.description} ${item.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));
  function show() {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery(''); setIndex(0); setOpen(true);
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.repeat) {
        event.preventDefault();
        if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
        previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setQuery(''); setIndex(0); setOpen(true);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal(); inputRef.current?.focus();
    const previous = previousFocus.current;
    // Escape closes this top-layer surface before the underlying drawer or reader.
    const keys = (event: KeyboardEvent) => {
      if(event.key === 'Escape') {event.stopPropagation(); return;}
      if(event.key !== 'Tab') return;
      const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href]'));
      const first=controls[0], last=controls[controls.length-1];
      if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
    };
    const backdrop = (event: MouseEvent) => {
      if(event.target !== dialog) return;
      const bounds=dialog.getBoundingClientRect();
      if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom) setOpen(false);
    };
    dialog.addEventListener('keydown',keys); dialog.addEventListener('click',backdrop);
    return () => {dialog.removeEventListener('keydown',keys); dialog.removeEventListener('click',backdrop); dialog.close(); if (previous?.isConnected && !previous.closest('[inert]')) previous.focus();};
  }, [open]);
  function close() { setOpen(false); }
  function navigate(href: string) { close(); onNavigate(); router.push(href); }
  return <>
    <button className="workspace-quick-launch" type="button" aria-label="快捷导航" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" onClick={show}>
      <Search size={20} aria-hidden="true"/><span>快捷导航</span><kbd aria-hidden="true">Ctrl K</kbd>
    </button>
    {open && createPortal(<dialog ref={dialogRef} className="workspace-command" aria-labelledby={`${id}-title`}
      onCancel={event=>{event.preventDefault(); close();}} onClose={close}>
      <header><h2 id={`${id}-title`}>快捷导航</h2><button type="button" aria-label="关闭快捷导航" onClick={close}><X size={20} aria-hidden="true"/></button></header>
      <div className="workspace-command-search"><Search size={20} aria-hidden="true"/>
        <input ref={inputRef} role="combobox" aria-label="搜索工作台页面" aria-controls={`${id}-results`} aria-expanded="true" aria-autocomplete="list"
          aria-activedescendant={results[index] ? `${id}-${results[index].id}` : undefined} value={query} placeholder="搜索页面，例如课程、论文、设置"
          onChange={event=>{setQuery(event.target.value); setIndex(0);}}
          onKeyDown={event=>{
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {event.preventDefault(); if(results.length) setIndex(current=>(current+(event.key==='ArrowDown'?1:-1)+results.length)%results.length);}
            if (event.key === 'Enter' && results[index]) {event.preventDefault(); navigate(results[index].href);}
          }}/>
      </div>
      <div id={`${id}-results`} role="listbox" aria-label="工作台页面" className="workspace-command-results">
        {results.map((item, resultIndex)=>{const Icon=item.icon; return <Link key={item.id} id={`${id}-${item.id}`} href={item.href} prefetch={false}
          role="option" aria-selected={index===resultIndex} onMouseEnter={()=>setIndex(resultIndex)} onFocus={()=>setIndex(resultIndex)} onClick={()=>{close();onNavigate();}}>
          <Icon size={20} aria-hidden="true"/><div><strong>{item.label}</strong><span>{item.description}</span></div><ArrowUpRight size={17} aria-hidden="true"/>
        </Link>;})}
      </div>
      {!results.length && <p className="workspace-command-empty" role="status">没有匹配的页面。试试“课程”“论文”或“设置”。</p>}
      <footer><span>↑ ↓ 选择 · Enter 打开</span><kbd>Esc 关闭</kbd></footer>
    </dialog>, document.body)}
  </>;
}
