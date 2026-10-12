"use client";
import {useState} from 'react';
import type {CourseSummary} from './course-types';
import CourseShell from './course-shell';
import CourseOverview from './course-overview';
import styles from './courses.module.css';
import MotionNavigation from '../components/motion-navigation';
export default function CourseCatalog({courses,availability,assessments}:{courses:CourseSummary[];availability:Record<string,string[]>;assessments:Record<string,string[]>}) {
 const [track,setTrack]=useState('全部');const [code,setCode]=useState(courses[0].code);
 const visible=courses.filter(c=>track==='全部'||c.track===track);const selected=visible.find(c=>c.code===code)??visible[0];
 return <CourseShell title="课程中心" toolbar={<><MotionNavigation as="div" className="page-bar-seg" role="group" label="课程方向" value={track}>{['全部','统计学','经济学'].map(x=><button type="button" key={x} aria-pressed={track===x} onClick={()=>setTrack(x)}>{x}</button>)}</MotionNavigation><span className="page-bar-spacer"/><span className="page-bar-date">显示 {visible.length} / {courses.length} 门</span></>}>
   <div className={`${styles.catalog} course-catalog-layout`}><nav className="course-catalog-index" aria-label="选择课程"><h2>课程目录</h2><MotionNavigation as="div" className="course-selection" label="课程列表" value={selected.code}><ul className={styles.courseList}>{visible.map(course=><li key={course.code}><button type="button" aria-current={selected.code===course.code?'true':undefined} onClick={()=>setCode(course.code)}><small>{course.code}</small><span>{course.name}</span></button></li>)}</ul></MotionNavigation></nav><CourseOverview key={selected.code} course={selected} available={availability[selected.code]} assessments={assessments[selected.code]}/></div>
 </CourseShell>;
}
