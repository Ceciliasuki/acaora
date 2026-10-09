"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {authChangeEvent,authFetch,getCurrentUser} from '../lib/auth-client';
import type {Attempt,CourseOperation,CourseSnapshot} from './course-types';
import {flushCourseQueue,mergeCourseSnapshot} from './course-sync.mjs';
import {loadLocalCourse,persistCourseOperation,readCourseQueue,removeCourseOperation,saveLocalCourse,loadCourseReset,saveCourseReset} from './course-storage';
const empty=(courseId:string):CourseSnapshot=>({courseId,generation:1,completedLessonIds:[],lastLessonId:null,attempts:[]});
type ProgressState='loading'|'anonymous'|'local'|'pending'|'read-error'|'reset-error'|'synced'|'reset'|'signed-out'|'storage-error';
type Envelope={ownerId?:string;snapshot?:CourseSnapshot};
export function useCourseProgress(courseId:string) {
 const [snapshot,setSnapshot]=useState<CourseSnapshot>(empty(courseId));
 const [status,setStatus]=useState<ProgressState>('loading');
 const [ownerId,setOwnerId]=useState<string|null>(null);
 const [initialized,setInitialized]=useState(false);
 const owner=useRef<string|null>(null);
 const current=useRef<CourseSnapshot>(empty(courseId));
 const epoch=useRef(0);
 const busy=useRef(false);
 const pendingReset=useRef<number|null>(null);
 const chain=useRef<Promise<unknown>>(Promise.resolve());
 const endpoint=`/api/courses/${courseId}/progress`;
 const serialize=useCallback(<T,>(work:()=>Promise<T>):Promise<T>=>{
   const next=chain.current.then(work);chain.current=next.catch(()=>{});return next;
 },[]);
 const flush=useCallback(async function flushPending(){
  const user=owner.current,token=epoch.current;
  if(!user||busy.current)return;
  busy.current=true;
  const isCurrent=()=>owner.current===user&&epoch.current===token;
  const resetGeneration=pendingReset.current;
  try {
   // A retry must actually contact the cloud even when the upload queue is empty.
   let response:Response,body:Envelope;
   try {
    response=await authFetch(endpoint,resetGeneration===null?undefined:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ownerId:user,generation:resetGeneration})});
    body=await response.json() as Envelope;
   }catch{if(isCurrent())setStatus(resetGeneration===null?'read-error':'reset-error');return;}
   if(!isCurrent())return;
   if(response.status===401||body.snapshot&&body.ownerId!==user){setStatus('signed-out');return;}
   if(!(response.ok||resetGeneration!==null&&response.status===409)||!body.snapshot||body.ownerId!==user){setStatus(resetGeneration===null?'read-error':'reset-error');return;}
   const remote=body.snapshot;
   await serialize(async()=>{
    if(!isCurrent())return;
    const queued=await readCourseQueue(user,courseId);
    if(!isCurrent())return;
    for(const op of queued)if(op.generation!==remote.generation){
     if(!isCurrent())return;
     await removeCourseOperation(op.operationId);
    }
    // The queue read/removals can outlive an account switch. Never merge the
    // new account's cleared ref into the old account's durable snapshot.
    if(!isCurrent())return;
    const next=resetGeneration===null?mergeCourseSnapshot(current.current,remote):remote;
    await saveLocalCourse(user,next);
    if(isCurrent()){current.current=next;setSnapshot(next);}
   });
   if(!isCurrent())return;
   if(resetGeneration!==null){await saveCourseReset(user,courseId,null);if(isCurrent()){pendingReset.current=null;setStatus('reset');}return;}
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
  finally{busy.current=false;if(isCurrent()&&resetGeneration===null&&pendingReset.current!==null)void flushPending();}
 },[courseId,endpoint,serialize]);
 useEffect(()=>{
  let disposed=false;
  const sessionEpoch=epoch;
  async function load() {
    const token=++epoch.current;owner.current=null;pendingReset.current=null;current.current=empty(courseId);
    let authenticated=false;
    try {
      const user=await getCurrentUser();if(disposed||token!==epoch.current)return;
      if(!user){setOwnerId(null);setSnapshot(empty(courseId));setStatus('anonymous');setInitialized(true);return;}
      authenticated=true;
      const local=await loadLocalCourse(user.id,courseId);if(disposed||token!==epoch.current)return;
      const resetIntent=await loadCourseReset(user.id,courseId);if(disposed||token!==epoch.current)return;pendingReset.current=resetIntent;
      // Publish the owner only after restoring their state. Reconnects and
      // effects from the previous render must not write an empty new snapshot.
      current.current=local??empty(courseId);owner.current=user.id;setOwnerId(user.id);setSnapshot(current.current);setStatus('local');
      const response=await authFetch(endpoint);if(disposed||token!==epoch.current)return;
      const body=await response.json() as Envelope;
      if(disposed||token!==epoch.current)return;
      if(response.status===401||body.snapshot&&body.ownerId!==user.id){owner.current=null;setOwnerId(null);setSnapshot(empty(courseId));setStatus('signed-out');setInitialized(true);return;}
      if(!response.ok||!body.snapshot){setStatus('read-error');setInitialized(true);return;}
      const remote=body.snapshot;
      await serialize(async()=>{
       if(disposed||token!==epoch.current)return;
       const merged=mergeCourseSnapshot(current.current,remote);
       const queued=await readCourseQueue(user.id,courseId);
       if(disposed||token!==epoch.current)return;
       for(const op of queued.filter(op=>op.generation!==remote.generation))await removeCourseOperation(op.operationId);
       if(disposed||token!==epoch.current)return;
       await saveLocalCourse(user.id,merged);
       if(disposed||token!==epoch.current)return;
       current.current=merged;setSnapshot(merged);
      });
      if(!disposed&&token===epoch.current){setStatus('synced');setInitialized(true);void flush();}
    }catch{if(!disposed&&token===epoch.current){setStatus(authenticated?'read-error':'anonymous');setInitialized(true);}}
  }
  function changed(){epoch.current++;owner.current=null;setOwnerId(null);setSnapshot(empty(courseId));setStatus('loading');setInitialized(false);void load();}
  function online(){void flush();}
  void load();window.addEventListener(authChangeEvent,changed);window.addEventListener('online',online);
  return()=>{disposed=true;sessionEpoch.current++;owner.current=null;window.removeEventListener(authChangeEvent,changed);window.removeEventListener('online',online);};
 },[courseId,endpoint,flush,serialize]);
 const record=useCallback(async(lessonId:string|null,attempt:Attempt|null,complete:boolean)=>{
  const user=owner.current,token=epoch.current;
  if(!initialized||user!==ownerId)return;
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
 },[ownerId,initialized,serialize,flush]);
 const reset=useCallback(async()=>{
  const user=owner.current,token=epoch.current;if(!user)return;
  const generation=current.current.generation;
  try {
   await saveCourseReset(user,courseId,generation);
   if(owner.current!==user||epoch.current!==token)return;
   pendingReset.current=generation;setStatus('reset-error');
   await flush();
  }catch{if(owner.current===user&&epoch.current===token)setStatus('storage-error');}
 },[courseId,flush]);
 return {ownerId,initialized,snapshot,status,record,reset,retry:flush};
}
