"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {authChangeEvent,authFetch,getCurrentUser} from '../lib/auth-client';
import type {Attempt,CourseOperation,CourseSnapshot} from './course-types';
import {flushCourseQueue,mergeCourseSnapshot} from './course-sync.mjs';
import {loadLocalCourse,persistCourseOperation,readCourseQueue,removeCourseOperation,saveLocalCourse} from './course-storage';
const empty=(courseId:string):CourseSnapshot=>({courseId,generation:1,completedLessonIds:[],lastLessonId:null,attempts:[]});
type ProgressState='loading'|'anonymous'|'local'|'pending'|'synced'|'reset'|'signed-out'|'storage-error';
type Envelope={ownerId?:string;snapshot?:CourseSnapshot};
export function useCourseProgress(courseId:string) {
 const [snapshot,setSnapshot]=useState<CourseSnapshot>(empty(courseId));
 const [status,setStatus]=useState<ProgressState>('loading');
 const [ownerId,setOwnerId]=useState<string|null>(null);
 const owner=useRef<string|null>(null);
 const current=useRef<CourseSnapshot>(empty(courseId));
 const epoch=useRef(0);
 const busy=useRef(false);
 const chain=useRef<Promise<unknown>>(Promise.resolve());
 const endpoint=`/api/courses/${courseId}/progress`;
 const serialize=useCallback(<T,>(work:()=>Promise<T>):Promise<T>=>{
   const next=chain.current.then(work);chain.current=next.catch(()=>{});return next;
 },[]);
 const flush=useCallback(async()=>{
  const user=owner.current,token=epoch.current;
  if(!user||busy.current)return;
  busy.current=true;
  const isCurrent=()=>owner.current===user&&epoch.current===token;
  try {
   let again=true;
   while(again&&isCurrent()) {
   const operations=await readCourseQueue(user,courseId);if(!isCurrent())return;
   const result=await flushCourseQueue({ownerId:user,operations,isCurrent,
    send:async(op)=>{
      const response=await authFetch(endpoint,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(op)});
      const body=await response.json() as Envelope;
      return {status:body.snapshot&&body.ownerId!==user?401:response.status,snapshot:body.ownerId===user?body.snapshot:undefined};
    },
    remove:removeCourseOperation,
    onSnapshot:remote=>serialize(async()=>{
      if(!isCurrent())return;
      const merged=mergeCourseSnapshot(current.current,remote);await saveLocalCourse(user,merged);
      if(isCurrent()){current.current=merged;setSnapshot(merged);}
    })
   });
   if(isCurrent())setStatus(result);
   again=result==='synced'&&isCurrent()&&(await readCourseQueue(user,courseId)).length>0;
   }
  }catch{if(isCurrent())setStatus('storage-error');}
  finally{busy.current=false;}
 },[courseId,endpoint,serialize]);
 useEffect(()=>{
  let disposed=false;
  const sessionEpoch=epoch;
  async function load() {
    const token=++epoch.current;owner.current=null;current.current=empty(courseId);
    try {
      const user=await getCurrentUser();if(disposed||token!==epoch.current)return;
      owner.current=user?.id??null;
      if(!user){setOwnerId(null);setSnapshot(empty(courseId));setStatus('anonymous');return;}
      const local=await loadLocalCourse(user.id,courseId);if(disposed||token!==epoch.current)return;
      current.current=local??empty(courseId);setOwnerId(user.id);setSnapshot(current.current);setStatus('local');
      const response=await authFetch(endpoint);if(disposed||token!==epoch.current)return;
      const body=await response.json() as Envelope;
      if(response.status===401||body.snapshot&&body.ownerId!==user.id){owner.current=null;setOwnerId(null);setSnapshot(empty(courseId));setStatus('signed-out');return;}
      if(!response.ok||!body.snapshot){setStatus('pending');return;}
      const remote=body.snapshot;
      await serialize(async()=>{
       if(disposed||token!==epoch.current)return;
       const merged=mergeCourseSnapshot(current.current,remote);
       const queued=await readCourseQueue(user.id,courseId);
       for(const op of queued.filter(op=>op.generation!==remote.generation))await removeCourseOperation(op.operationId);
       await saveLocalCourse(user.id,merged);current.current=merged;setSnapshot(merged);
      });
      if(!disposed&&token===epoch.current){setStatus('synced');void flush();}
    }catch{if(!disposed&&token===epoch.current)setStatus(owner.current?'pending':'anonymous');}
  }
  function changed(){epoch.current++;owner.current=null;setOwnerId(null);setSnapshot(empty(courseId));setStatus('loading');void load();}
  function online(){void flush();}
  void load();window.addEventListener(authChangeEvent,changed);window.addEventListener('online',online);
  return()=>{disposed=true;sessionEpoch.current++;owner.current=null;window.removeEventListener(authChangeEvent,changed);window.removeEventListener('online',online);};
 },[courseId,endpoint,flush,serialize]);
 const record=useCallback(async(lessonId:string|null,attempt:Attempt|null,complete:boolean)=>{
  const user=owner.current,token=epoch.current;
  if(!user){setStatus('anonymous');return;}
  try {
   await serialize(async()=>{
    if(owner.current!==user||epoch.current!==token)return;
    const previous=current.current;
    const next:CourseSnapshot={...previous,lastLessonId:lessonId??previous.lastLessonId,completedLessonIds:complete&&lessonId?[...new Set([...previous.completedLessonIds,lessonId])]:previous.completedLessonIds,attempts:attempt?[...previous.attempts,attempt]:previous.attempts};
    const operation:CourseOperation={...next,ownerId:user,operationId:crypto.randomUUID(),attempts:attempt?[attempt]:[]};
    await persistCourseOperation(operation,next);
    if(owner.current===user&&epoch.current===token){current.current=next;setSnapshot(next);setStatus('pending');}
   });
   void flush();
  }catch{if(owner.current===user&&epoch.current===token)setStatus('storage-error');}
 },[serialize,flush]);
 const reset=useCallback(async()=>{
  const user=owner.current,token=epoch.current;if(!user)return;
  try{
   const response=await authFetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerId:user,generation:current.current.generation})});
   const body=await response.json() as Envelope;
   if(epoch.current!==token||owner.current!==user)return;
   if(![200,409].includes(response.status)||!body.snapshot||body.ownerId!==user){setStatus('pending');return;}
   const remote=body.snapshot;
   await serialize(async()=>{
     if(epoch.current!==token||owner.current!==user)return;
     for(const op of await readCourseQueue(user,courseId))if(op.generation!==remote.generation)await removeCourseOperation(op.operationId);
     await saveLocalCourse(user,remote);current.current=remote;setSnapshot(remote);setStatus('reset');
   });
  }catch{if(epoch.current===token)setStatus('pending');}
 },[courseId,endpoint,serialize]);
 return {ownerId,snapshot,status,record,reset,retry:flush};
}
