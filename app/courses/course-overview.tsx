"use client";

import Link from 'next/link';
import {useState} from 'react';
import {ArrowRight, Check, ChevronRight} from 'lucide-react';
import type {CourseSummary} from './course-types';
import {useCourseProgress} from './use-course-progress';
import CourseStatus from './course-status';
import styles from './courses.module.css';

export default function CourseOverview({course,available,assessments=[]}:{course:CourseSummary;available:string[];assessments?:string[]}) {
 const progress=useCourseProgress(course.code);
 const [confirmReset,setConfirmReset]=useState(false);
 const last=progress.snapshot.lastLessonId;
 const resume=last&&available.includes(last)?last:available[0];
 const coreLessons=course.chapters.flatMap(c=>c.lessons).filter(l=>!l.optional);
 const completed=coreLessons.filter(l=>available.includes(l.id)&&progress.snapshot.completedLessonIds.includes(l.id)).length;

 return <article className={`${styles.overview} course-overview`}>
  <header>
   <p className={styles.muted}>{course.code} · {course.track}</p>
   <h2>{course.name}</h2>
   <p>{course.description}</p>
   <p className={styles.muted}>先修：{course.prerequisites.join('、')}</p>
   <div className={`${styles.actions} course-start`}>
    {resume&&<Link className={styles.primaryLink} prefetch={false} href={`/courses/${course.code}/${resume}`} aria-label={last?'继续学习':`开始学习${course.name}`}>{last?'继续学习':'开始学习'}<ArrowRight size={17} aria-hidden="true"/></Link>}
    <span className={styles.muted}>核心已读 {completed} / {coreLessons.length} 节</span>
   </div>
   <CourseStatus progress={progress}/>
  </header>
  <div className="course-syllabus-heading"><h3>课程大纲</h3><span>{course.chapters.length} 章</span></div>
  <ol className={styles.chapters}>{course.chapters.map((chapter,i)=>{
   const single=chapter.lessons.length===1&&chapter.lessons[0].title===chapter.title;
   return <li key={chapter.id} data-single={single}>
    {!single&&<h3><span className="course-chapter-number">{String(i+1).padStart(2,'0')}</span><span>{chapter.title}</span></h3>}
    <ul>{chapter.lessons.map(lesson=>{
     const read=progress.snapshot.completedLessonIds.includes(lesson.id);
     const content=<><span className="course-chapter-number">{single?String(i+1).padStart(2,'0'):null}</span><span className="course-lesson-copy"><span>{lesson.title}{!available.includes(lesson.id)&&' · 编写与核验中'}</span><small>{lesson.optional?'选学':lesson.level}{read?' · 已读':''}</small></span>{read?<Check size={17} aria-hidden="true"/>:<ChevronRight size={17} aria-hidden="true"/>}</>;
     return <li key={lesson.id}>{available.includes(lesson.id)?<Link className="course-lesson-link" aria-label={lesson.title} prefetch={false} href={`/courses/${course.code}/${lesson.id}`}>{content}</Link>:<span className="course-lesson-link course-lesson-unavailable">{content}</span>}</li>;
    })}</ul>
   </li>;
  })}</ol>
  {assessments.includes('case-study')&&<div className="course-case-link"><Link prefetch={false} href={`/courses/${course.code}/assessments/case-study`}>综合案例<ArrowRight size={17} aria-hidden="true"/></Link><span>串联本课程的知识与练习</span></div>}
  <details className={styles.references}><summary>学习记录</summary><Link className="course-record-link" href={`/courses/${course.code}/review`}>复习作答记录<ArrowRight size={16} aria-hidden="true"/></Link>
   {progress.ownerId&&<div className={styles.reset}>{confirmReset?<><p>清空本课程的已读标记和继续位置？历史作答保留，但不计入新的学习记录。</p><div className={styles.actions}><button type="button" onClick={()=>{setConfirmReset(false);void progress.reset();}}>确认重置本课程</button><button type="button" onClick={()=>setConfirmReset(false)}>取消</button></div></>:<button type="button" onClick={()=>setConfirmReset(true)}>重置本课程进度</button>}</div>}
  </details>
 </article>;
}
