'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {authChangeEvent,authFetch,getCurrentUser} from '../lib/auth-client';
import {loadLocalCourse,loadCourseReset,readCourseQueue} from './course-storage';
import {mergeCourseSnapshot} from './course-sync.mjs';
import type {CourseOperation,CourseSnapshot,CourseSummary} from './course-types';
import styles from './course-selection.module.css';

type Entry={snapshot:CourseSnapshot|null;local:boolean;pending?:boolean;error:boolean};
export default function CourseResume({courses}:{courses:CourseSummary[]}) {
  const [state,setState]=useState<{status:'loading'|'anonymous'|'ready'|'error';entries:Record<string,Entry>}>({status:'loading',entries:{}});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true,epoch=0;
    async function load(){
      const token=++epoch;setState({status:'loading',entries:{}});
      try {
        const user=await getCurrentUser();if(!active||epoch!==token)return;
        if(!user){setState({status:'anonymous',entries:{}});return;}
        const entries=await Promise.all(courses.map(async course=>{
          let local:CourseSnapshot|null=null,queue:CourseOperation[]=[];
          try{local=await loadLocalCourse(user.id,course.code);if(await loadCourseReset(user.id,course.code)!==null)return [course.code,{snapshot:null,local:true,error:true}] as const;}catch{/* Cloud read remains available when device storage fails. */}
          try{queue=await readCourseQueue(user.id,course.code);}catch{/* A queue read failure must not hide available account progress. */}
          try {
            const response=await authFetch(`/api/courses/${course.code}/progress`);
            const body=await response.json() as {ownerId?:string;snapshot?:CourseSnapshot};
            if(!response.ok||body.ownerId!==user.id||!body.snapshot||body.snapshot.courseId!==course.code)throw new Error('进度读取失败');
            const snapshot=local?mergeCourseSnapshot(local,body.snapshot):body.snapshot;
            const available=new Set(course.chapters.flatMap(ch=>ch.lessons.map(lesson=>lesson.id)));
            // The queue is ordered by device sequence, not lesson ID. Only
            // navigation from the account's current reset generation can win.
            const pending=[...queue].reverse().find(operation=>operation.ownerId===user.id&&operation.courseId===course.code&&operation.generation===body.snapshot!.generation&&operation.generation===snapshot.generation&&operation.lastLessonId!==null&&available.has(operation.lastLessonId));
            return [course.code,{snapshot:pending?{...snapshot,lastLessonId:pending.lastLessonId}:snapshot,local:false,pending:Boolean(pending),error:false}] as const;
          }catch{return [course.code,{snapshot:local,local:Boolean(local),error:true}] as const;}
        }));
        if(active&&epoch===token)setState({status:'ready',entries:Object.fromEntries(entries)});
      }catch{if(active&&epoch===token)setState({status:'error',entries:{}});}
    }
    void load();window.addEventListener(authChangeEvent,load);
    return()=>{active=false;epoch++;window.removeEventListener(authChangeEvent,load);};
  },[courses,retry]);
  const resumable=courses.flatMap(course=>{
    const entry=state.entries[course.code],lessons=course.chapters.flatMap(ch=>ch.lessons),last=lessons.find(l=>l.id===entry?.snapshot?.lastLessonId);
    return last&&entry?.snapshot?[{course,entry,last,completed:lessons.filter(l=>entry.snapshot!.completedLessonIds.includes(l.id)).length}]:[];
  });
  const failed=Object.values(state.entries).filter(e=>e.error).length;
  return <section className={styles.resume} aria-label="继续学习">
    <h2>继续学习</h2>
    {state.status==='loading'?<p role="status">正在读取各课程进度…</p>:state.status==='anonymous'?<p>登录后可读取账户的上次课时。仍可从下方选择课程阅读。</p>:state.status==='error'?<p role="alert">进度暂时无法读取，课程列表仍可使用。</p>:<>
      {!resumable.length&&!failed&&<p>还没有可继续的课时。请从下方选择一门课程。</p>}
      {resumable.map(({course,entry,last,completed})=><article key={course.code}><div><h3>{course.name}</h3><p>上次课时：{last.title} · 已标记完成 {completed} 节{entry.pending?' · 本机新位置，待同步到账户':entry.local?' · 本机记录，云端暂不可用':''}</p></div><Link href={`/courses/${course.code}/${last.id}`} aria-label={`继续学习：${course.name}`} prefetch={false}>继续学习<span className="sr-only">：{course.name}</span></Link></article>)}
      {failed>0&&<p role="status">{failed} 门课程的账户进度尚未确认；未读取的进度不计为零。</p>}
    </>}
    {(state.status==='error'||failed>0)&&<button type="button" onClick={()=>setRetry(x=>x+1)}>重新读取进度</button>}
  </section>;
}
