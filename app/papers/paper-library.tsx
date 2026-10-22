"use client";

import {useId, useRef, type ReactNode} from 'react';
import {BookOpen, FileText, MoreHorizontal, Search, Star, Trash2, X} from 'lucide-react';
import type {PaperRecord} from './paper-types';
import styles from './paper-library.module.css';

export type LibraryView = {query: string; scope: 'all' | 'favorites'; sort: 'added' | 'updated' | 'title'};
export const defaultLibraryView: LibraryView = {query: '', scope: 'all', sort: 'added'};

type RowProps = {paper: PaperRecord; busy: boolean; onOpen: () => void; onFavorite: () => void; onDetails: () => void; onDelete: () => void};
function PaperRow({paper,busy,onOpen,onFavorite,onDetails,onDelete}: RowProps) {
  const menuId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const progress = paper.paragraphs.length ? Math.round(paper.paragraphs.filter(p=>p.read).length / paper.paragraphs.length * 100) : 0;
  function closeMenu() {document.getElementById(menuId)?.hidePopover();}
  return <article className={styles.row} aria-label={paper.title}>
    <button id={`paper-open-${paper.id}`} type="button" className={styles.entry} aria-label={`打开论文：${paper.title}`} onClick={onOpen} disabled={busy}>
      <FileText size={21} aria-hidden="true"/>
      <span className={styles.copy}><strong>{paper.title}</strong>
        <span className={styles.meta}>{[paper.bibliography?.authors.slice(0,2).join('、'),paper.bibliography?.year,paper.bibliography?.venue].filter(Boolean).join(' · ') || paper.fileName}</span>
        <span className={styles.progress}>{paper.paragraphs.length} 段 · 已读 {progress}%{paper.bibliography?.tags.length ? ` · ${paper.bibliography.tags.join('、')}` : ''}</span>
      </span>
    </button>
    <div className={styles.actions}>
      <button type="button" aria-label={`${paper.favorite?'取消收藏':'收藏'} ${paper.title}`} title={paper.favorite?'取消收藏':'收藏'} aria-pressed={Boolean(paper.favorite)} onClick={onFavorite} disabled={busy}><Star size={18} fill={paper.favorite?'currentColor':'none'} aria-hidden="true"/></button>
      <button ref={toggle} type="button" popoverTarget={menuId} aria-label={`更多操作：${paper.title}`} title="更多操作" aria-haspopup="menu" disabled={busy} onClick={event=>{
        const menu=document.getElementById(menuId),bounds=event.currentTarget.getBoundingClientRect();
        if(menu){menu.style.left=`${Math.max(12,Math.min(bounds.right-212,innerWidth-224))}px`;menu.style.top=`${Math.max(12,Math.min(bounds.bottom+6,innerHeight-124))}px`;}
      }}><MoreHorizontal size={20} aria-hidden="true"/></button>
      <div className={styles.menu} id={menuId} popover="auto" role="menu" tabIndex={-1} aria-label={`${paper.title}的操作`} onToggle={event=>{
        if(event.newState==='open')event.currentTarget.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
      }} onKeyDown={event=>{
        const items=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
        const current=items.indexOf(document.activeElement as HTMLButtonElement);
        const next=event.key==='ArrowDown'?(current+1)%items.length:event.key==='ArrowUp'?(current-1+items.length)%items.length:event.key==='Home'?0:event.key==='End'?items.length-1:null;
        if(next!==null){event.preventDefault();items[next]?.focus();}
        if(event.key==='Escape'){event.preventDefault();closeMenu();toggle.current?.focus();}
        if(event.key==='Tab')closeMenu();
      }}>
        <button type="button" role="menuitem" onClick={()=>{closeMenu();onDetails();}}><FileText size={16} aria-hidden="true"/>文献资料与引用</button>
        <button type="button" role="menuitem" className={styles.delete} onClick={()=>{closeMenu();onDelete();}}><Trash2 size={16} aria-hidden="true"/>删除论文</button>
      </div>
    </div>
  </article>;
}

type Props = {papers: PaperRecord[]; hydrated: boolean; error: string; status: string; view: LibraryView; onView: (view: LibraryView) => void; busy: boolean; tools: ReactNode; onRetry: () => void; onOpen: (paper: PaperRecord) => void; onFavorite: (paper: PaperRecord) => void; onDetails: (paper: PaperRecord) => void; onDelete: (paper: PaperRecord) => void; onDemo: () => void};
export default function PaperLibrary({papers,hydrated,error,status,view,onView,busy,tools,onRetry,onOpen,onFavorite,onDetails,onDelete,onDemo}: Props) {
  const searchInput = useRef<HTMLInputElement>(null);
  const query=view.query.trim().toLocaleLowerCase();
  const filtered=papers.filter(p=>(view.scope!=='favorites'||p.favorite)&&(!query||[p.title,p.fileName,p.bibliography?.authors.join(' '),p.bibliography?.tags.join(' ')].join(' ').toLocaleLowerCase().includes(query)));
  const visible=[...filtered].sort((a,b)=>view.sort==='title'?a.title.localeCompare(b.title,'zh-CN'):view.sort==='updated'?b.updatedAt-a.updatedAt:b.addedAt-a.addedAt);
  return <section className={`${styles.library} paper-library-screen`} aria-label="论文列表">
    <header className={styles.heading}><div><h2>我的论文</h2><span>{error?'数量暂不可用':hydrated?`${papers.length} 篇论文`:'正在读取论文库…'}</span></div><span role="status" className={styles.sync}>{status}</span></header>
    <div className={styles.toolbar}>
      <div className={styles.search}><Search size={18} aria-hidden="true"/><input ref={searchInput} type="search" aria-label="搜索论文" placeholder="搜索论文" value={view.query} onChange={event=>onView({...view,query:event.target.value})}/>{view.query&&<button type="button" className={styles.clearSearch} aria-label="清空搜索" title="清空搜索" onClick={()=>{onView({...view,query:''});searchInput.current?.focus();}}><X size={16} aria-hidden="true"/></button>}</div>
      <div className={styles.filters} role="group" aria-label="论文列表范围"><button type="button" aria-pressed={view.scope==='all'} onClick={()=>onView({...view,scope:'all'})}>全部</button><button type="button" aria-pressed={view.scope==='favorites'} onClick={()=>onView({...view,scope:'favorites'})}><Star size={15} aria-hidden="true"/>收藏</button></div>
      <label className={styles.sort}>排序<select aria-label="论文排序" value={view.sort} onChange={event=>onView({...view,sort:event.target.value as LibraryView['sort']})}><option value="added">最近导入</option><option value="updated">最近更新</option><option value="title">标题</option></select></label>
    </div>
    {error?<div className={styles.empty} role="alert"><h3>暂时无法读取论文库</h3><p>{error}</p><button type="button" onClick={onRetry}>重试读取</button></div>:!hydrated?<div className={styles.loading} aria-label="正在读取论文列表" aria-busy="true">{[0,1,2].map(i=><div key={i}><span/><span/></div>)}</div>:visible.length?<div className={styles.rows}>{visible.map(p=><PaperRow key={p.id} paper={p} busy={busy} onOpen={()=>onOpen(p)} onFavorite={()=>onFavorite(p)} onDetails={()=>onDetails(p)} onDelete={()=>onDelete(p)}/>)}</div>:<div className={styles.empty}><BookOpen size={30} aria-hidden="true"/><h3>{papers.length?'没有找到符合条件的论文':'还没有论文'}</h3><p>{papers.length?'调整搜索词或切换列表范围。':'从右上方导入 PDF，再选择论文进入阅读工作台。'}</p>{papers.length>0&&<button type="button" onClick={()=>onView(defaultLibraryView)}>显示全部论文</button>}</div>}
    <footer className={styles.footer}><div>{tools}</div><button type="button" className={styles.demo} disabled={!hydrated||busy} onClick={onDemo}>打开示例论文</button></footer>
  </section>;
}
