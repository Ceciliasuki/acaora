"use client";
import Link from 'next/link';
import type {CourseSummary,Question} from './course-types';
import {useCourseProgress} from './use-course-progress';
import {gradeQuestion} from './course-grading.mjs';
import {CourseText} from './course-text';
import CourseStatus from './course-status';
import styles from './courses.module.css';
export default function CourseReview({course,items}:{course:CourseSummary;items:{question:Question;href:string}[]}) {
 const progress=useCourseProgress(course.code);
 const records=items.flatMap(item=>{
  const attempt=progress.snapshot.attempts.filter(a=>a.questionId===item.question.id).sort((a,b)=>b.createdAt-a.createdAt)[0];
  if(!attempt)return [];
  const outdated=attempt.questionVersion!==item.question.version;
  const status=outdated?'outdated':gradeQuestion(item.question,attempt.answer).status;
  return status==='correct'&&!attempt.viewedSolution?[]:[{...item,attempt,status}];
 });
 return <div className={styles.overview}><Link href={`/courses/${course.code}`}>返回课程目录</Link><h2>复习作答记录</h2><CourseStatus progress={progress}/><p className={styles.muted}>列出答错、需要自查、看过解析或版本已更新的题目。读完和正确作答分别记录，均不等于已掌握课程。</p>{progress.initialized&&records.length===0&&<p>当前没有待复习记录；完成练习后可回到这里核对。</p>}{records.map(item=><section key={item.question.id} className={styles.question}><h3>{item.status==='outdated'?'题目已更新，需重新作答':item.attempt.viewedSolution?'曾查看解析':item.status==='self-check'?'开放题待自查':item.status==='incorrect'?'答案需复查':'尚未作答'}</h3><p><CourseText text={item.question.prompt}/></p>{item.attempt.answer&&<p>上次作答：<CourseText text={item.attempt.answer}/></p>}<Link prefetch={false} href={`${item.href}#title-${item.question.id}`}>回到题目</Link></section>)}</div>;
}
