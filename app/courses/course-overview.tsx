"use client";
import Link from 'next/link';
import {useState} from 'react';
import type {CourseSummary} from './course-types';
import {useCourseProgress} from './use-course-progress';
import CourseStatus from './course-status';
import styles from './courses.module.css';
export default function CourseOverview({course,available,assessments=[]}:{course:CourseSummary;available:string[];assessments?:string[]}) {
 const progress=useCourseProgress(course.code);const [confirmReset,setConfirmReset]=useState(false);
 const last=progress.snapshot.lastLessonId;
 const resume=last&&available.includes(last)?last:available[0];
 return <article className={styles.overview}><header><p className={styles.muted}>{course.code} · {course.track}</p><h2>{course.name}</h2><p>{course.description}</p><p className={styles.muted}>先修：{course.prerequisites.join('、')}</p></header>
  <CourseStatus progress={progress}/>
  <div className={styles.actions}>{resume&&<Link className={styles.primaryLink} prefetch={false} href={`/courses/${course.code}/${resume}`} aria-label={last?'继续学习':`开始学习${course.name}`}>{last?'继续学习':'开始学习'}</Link>}<span className={styles.muted}>已读 {progress.snapshot.completedLessonIds.filter(id=>available.includes(id)).length} / {course.chapters.flatMap(c=>c.lessons).length} 节</span></div>
  <ol className={styles.chapters}>{course.chapters.map((chapter,i)=><li key={chapter.id}><h3>{i+1}. {chapter.title}</h3><ul>{chapter.lessons.map(lesson=><li key={lesson.id}>{available.includes(lesson.id)?<Link prefetch={false} href={`/courses/${course.code}/${lesson.id}`}>{lesson.title}</Link>:<span>{lesson.title} · 编写与核验中</span>}<small>{lesson.level}{progress.snapshot.completedLessonIds.includes(lesson.id)?' · 已读':''}</small></li>)}</ul>{assessments.includes(chapter.id)&&<Link prefetch={false} href={`/courses/${course.code}/assessments/${chapter.id}`}>章节作业</Link>}</li>)}</ol>
  <div className={styles.actions}><Link href={`/courses/${course.code}`}>完整目录与自测</Link>{['midterm','final'].filter(id=>assessments.includes(id)).map(id=><Link key={id} prefetch={false} href={`/courses/${course.code}/assessments/${id}`}>{id==='midterm'?'阶段自测':'综合自测'}</Link>)}<Link href={`/courses/${course.code}/review`}>复习作答记录</Link></div>
  {progress.ownerId&&<div className={styles.reset}>{confirmReset?<><p>清空本课程的已读标记和继续位置？历史作答保留，但不计入新的学习记录。</p><div className={styles.actions}><button type="button" onClick={()=>{setConfirmReset(false);void progress.reset();}}>确认重置本课程</button><button type="button" onClick={()=>setConfirmReset(false)}>取消</button></div></>:<button type="button" onClick={()=>setConfirmReset(true)}>重置本课程进度</button>}</div>}
 </article>;
}
