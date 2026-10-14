"use client";

import {BookOpen, Minimize2} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import AppSidebar from '../components/app-sidebar';
import focused from '../focused-workspaces.module.css';
import craft from '../operational-craft.module.css';
import {PageHeader} from '../components/ui';
export default function CourseShell({title,children,toolbar,focusable=false}:{title:string;children:React.ReactNode;toolbar?:React.ReactNode;focusable?:boolean}) {
 const [readingFocus,setReadingFocus]=useState(false);
 const bodyRef=useRef<HTMLDivElement>(null);
 const toggleRef=useRef<HTMLButtonElement>(null);
 const changeFocus=useCallback(()=>{
  const body=bodyRef.current;
  body?.getAnimations().forEach(animation=>animation.cancel());
  const before=body?.getBoundingClientRect();
  flushSync(()=>setReadingFocus(current=>!current));
  const after=body?.getBoundingClientRect();
  if(body && before && after && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
   body.animate([{transform:`translate(${before.left-after.left}px, ${before.top-after.top}px)`,opacity:.75},{transform:'translate(0,0)',opacity:1}],{duration:380,easing:'cubic-bezier(.16,1,.3,1)'});
  }
 },[]);
 useEffect(()=>{
  if(!readingFocus)return;
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape' && !document.querySelector('dialog[open], [aria-modal="true"]')){changeFocus();toggleRef.current?.focus();}};
  window.addEventListener('keydown',escape);
  return()=>window.removeEventListener('keydown',escape);
 },[readingFocus,changeFocus]);
 useEffect(()=>{const body=bodyRef.current;return()=>body?.getAnimations().forEach(animation=>animation.cancel());},[]);
 return <main className={`student-app learning-app workspace-refresh ${craft.craft}`} data-reading-focus={readingFocus}><AppSidebar active="courses" profileTitle="课程学习中心" profileSubtitle="统计学 × 国际经贸"/><section className={`workspace learning-main courses-shell ${focused.focused}`}><PageHeader className="workspace-header" title={title} description="阅读讲解、完成练习，继续上次的学习。" actions={toolbar}/><div ref={bodyRef} className="page-body">{children}</div></section>{focusable && <button ref={toggleRef} type="button" className="course-focus-toggle" aria-pressed={readingFocus} onClick={changeFocus}><span className="course-focus-icons"><BookOpen size={18} aria-hidden="true"/><Minimize2 size={18} aria-hidden="true"/></span><span>{readingFocus?'退出专注':'专注阅读'}</span>{readingFocus && <kbd>Esc</kbd>}</button>}</main>;
}
