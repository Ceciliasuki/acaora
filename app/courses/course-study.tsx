"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import type {CourseSummary,Question} from './course-types';
import CourseShell from './course-shell';
import CoursePractice from './course-practice';
import CourseStatus from './course-status';
import {useCourseProgress} from './use-course-progress';
import styles from './courses.module.css';
export default function CourseStudy({course,lessonId,title,questions,children}:{course:CourseSummary;lessonId:string|null;title:string;questions:Question[];children?:React.ReactNode}) {
 const progress=useCourseProgress(course.code);const [online,setOnline]=useState(true);
 const record=progress.record;
 useEffect(()=>{if(lessonId&&progress.ownerId&&progress.initialized)void record(lessonId,null,false);},[lessonId,progress.ownerId,progress.initialized,record]);
 useEffect(()=>{function changed(){setOnline(navigator.onLine);}changed();window.addEventListener('online',changed);window.addEventListener('offline',changed);return()=>{window.removeEventListener('online',changed);window.removeEventListener('offline',changed);};},[]);
 const lessons=course.chapters.flatMap(c=>c.lessons);const index=lessons.findIndex(l=>l.id===lessonId);const next=index>=0?lessons[index+1]:undefined;
 const completed=!!lessonId&&progress.snapshot.completedLessonIds.includes(lessonId);
 return <CourseShell title={course.name}><div className={styles.study}><nav aria-label="课程内导航"><Link href={`/courses/${course.code}`}>返回课程目录</Link><details className={styles.directory}><summary>章节导航</summary><ol>{lessons.map(lesson=><li key={lesson.id}>{online?<Link prefetch={false} href={`/courses/${course.code}/${lesson.id}`} aria-current={lesson.id===lessonId?'page':undefined}>{lesson.title}</Link>:<span>{lesson.title}</span>}</li>)}</ol></details></nav><div className={styles.studyBody}><header><p className={styles.muted}>{course.code}{lessonId?` · 第 ${index+1} 节`: ' · 作业与自测'}</p><h2 className={styles.lessonTitle}>{title}</h2></header><CourseStatus progress={progress}/>{!online&&<p className={styles.offline} role="status">当前已加载内容可继续阅读和作答；打开其他章节需要联网。</p>}{children}
 {progress.initialized?<CoursePractice key={`${progress.ownerId??'anonymous'}-${progress.snapshot.generation}`} questions={questions} attempts={progress.snapshot.attempts} onAttempt={attempt=>void record(lessonId,attempt,false)}/>:<p className={styles.muted}>正在读取练习记录…</p>}
 {lessonId&&<div className={styles.actions}>{completed?<span className={styles.completed}>本节已读</span>:<button type="button" disabled={!progress.initialized||!progress.ownerId} onClick={()=>void record(lessonId,null,true)}>标记本节已读</button>}{next&&(online?<Link prefetch={false} href={`/courses/${course.code}/${next.id}`}>下一节：{next.title}</Link>:<span>联网后可打开下一节。</span>)}</div>}
 </div></div></CourseShell>;
}
