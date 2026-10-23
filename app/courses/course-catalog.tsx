"use client";
import {useRef,useState} from 'react';
import Link from 'next/link';
import {BookOpen,ChevronRight,Search,X} from 'lucide-react';
import type {CourseSummary} from './course-types';
import CourseShell from './course-shell';
import styles from './course-selection.module.css';
import MotionNavigation from '../components/motion-navigation';
import CourseResume from './course-resume';
export default function CourseCatalog({courses}:{courses:CourseSummary[]}) {
 const [track,setTrack]=useState('全部');const [query,setQuery]=useState('');
 const searchInput=useRef<HTMLInputElement>(null);
 const term=query.trim().toLocaleLowerCase();
 const visible=courses.filter(c=>(track==='全部'||c.track===track)&&(!term||[c.code,c.name,c.track,c.description,...c.prerequisites].join(' ').toLocaleLowerCase().includes(term)));
 return <CourseShell title="课程中心" catalog>
  <section className={styles.selection} aria-label="课程选择">
   <CourseResume courses={courses}/>
   <header className={styles.heading}><div><h2>全部课程</h2><span>{courses.length} 门课程</span></div>
    <div className={styles.search}><Search size={18} aria-hidden="true"/><input ref={searchInput} type="search" aria-label="搜索课程" placeholder="搜索课程" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="清空课程搜索" onClick={()=>{setQuery('');searchInput.current?.focus();}}><X size={16} aria-hidden="true"/></button>}</div>
   </header>
   <div className={styles.toolbar}>
    <MotionNavigation as="div" className={styles.filters} role="group" label="课程方向" value={track}>{['全部','统计学','经济学'].map(x=><button type="button" key={x} aria-pressed={track===x} onClick={()=>setTrack(x)}>{x}</button>)}</MotionNavigation>
    {(term||track!=='全部')&&<span className={styles.results} role="status">{visible.length} 门符合条件</span>}
   </div>
   <nav aria-label="选择课程"><ul className={styles.rows}>{visible.map(course=>{
    const core=course.chapters.flatMap(chapter=>chapter.lessons).filter(lesson=>!lesson.optional).length;
    return <li key={course.code}><Link prefetch={false} href={`/courses/${course.code}`} aria-label={`选择课程：${course.name}`}><span className={styles.courseIcon}><BookOpen size={22} aria-hidden="true"/></span><span className={styles.copy}><span className={styles.title}><strong>{course.name}</strong><span className={styles.track}>{course.track}</span></span><span className={styles.prerequisites}>先修：{course.prerequisites.join('、')}</span></span><span className={styles.structure}><span>{course.chapters.length} 章</span><span>{core} 节核心课</span></span><span className={styles.open}><span>查看课程</span><ChevronRight size={18} aria-hidden="true"/></span></Link></li>;
   })}</ul></nav>
   {!visible.length&&<div className={styles.empty}><h3>没有找到符合条件的课程</h3><button type="button" onClick={()=>{setQuery('');setTrack('全部');searchInput.current?.focus();}}>显示全部课程</button></div>}
  </section>
 </CourseShell>;
}
