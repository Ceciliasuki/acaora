'use client';
import {Menu} from 'lucide-react';
import Link from 'next/link';
import {useRef,useState,type KeyboardEvent} from 'react';

export default function HomeMobileMenu() {
  const [open,setOpen]=useState(false),trigger=useRef<HTMLButtonElement>(null);
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&open){setOpen(false);trigger.current?.focus();event.stopPropagation();}};
  return <div className="home-mobile-menu">
    <button ref={trigger} type="button" aria-label="打开主导航" aria-expanded={open} aria-controls="home-mobile-links" onClick={()=>setOpen(!open)} onKeyDown={escape}><Menu size={20} aria-hidden="true"/></button>
    {open&&<nav id="home-mobile-links" aria-label="移动主导航">{[['/dashboard','总览'],['/papers','论文阅读'],['/data','数据分析'],['/projects','研究项目'],['/courses','课程学习'],['/help','使用帮助']].map(([href,label])=><Link href={href} key={href} onClick={()=>setOpen(false)} onKeyDown={escape}>{label}</Link>)}</nav>}
  </div>;
}
