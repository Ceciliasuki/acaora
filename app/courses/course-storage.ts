"use client";
import type {CourseOperation,CourseSnapshot} from './course-types';
import {courseStorageKey,orderCourseQueue} from './course-sync.mjs';
type StoredCourse={key:string;ownerId:string;snapshot:CourseSnapshot};
let database:Promise<IDBDatabase>|null=null;
function openDatabase() {
  if(!database) database=new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('acaora-curated-courses',2);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains('snapshots'))request.result.createObjectStore('snapshots',{keyPath:'key'});
      if(!request.result.objectStoreNames.contains('queue'))request.result.createObjectStore('queue',{keyPath:'operationId'}).createIndex('ownerId','ownerId');
      request.result.createObjectStore('metadata');
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>{database=null;reject(request.error);};
  });
  return database;
}
async function transact<T>(stores:string[],mode:IDBTransactionMode,work:(transaction:IDBTransaction)=>IDBRequest<T>) {
  const db=await openDatabase();
  return new Promise<T>((resolve,reject)=>{
    const transaction=db.transaction(stores,mode);let result:T;
    const request=work(transaction);request.onsuccess=()=>{result=request.result;};
    transaction.oncomplete=()=>resolve(result);transaction.onabort=()=>reject(transaction.error??new Error('记录未保存'));transaction.onerror=()=>reject(transaction.error);
  });
}
export async function loadLocalCourse(ownerId:string,courseId:string) {
  const stored=await transact<StoredCourse|undefined>(['snapshots'],'readonly',t=>t.objectStore('snapshots').get(courseStorageKey(ownerId,courseId)));
  return stored?.ownerId===ownerId?stored.snapshot:null;
}
export async function saveLocalCourse(ownerId:string,snapshot:CourseSnapshot) {
  await transact(['snapshots'],'readwrite',t=>t.objectStore('snapshots').put({key:courseStorageKey(ownerId,snapshot.courseId),ownerId,snapshot}));
}
export async function persistCourseOperation(operation:CourseOperation,snapshot:CourseSnapshot) {
  const db=await openDatabase();
  await new Promise<void>((resolve,reject)=>{
    const t=db.transaction(['snapshots','queue','metadata'],'readwrite');
    const sequence=t.objectStore('metadata').get('sequence');
    sequence.onsuccess=()=>{
      const next=(sequence.result??0)+1;
      t.objectStore('metadata').put(next,'sequence');
      t.objectStore('snapshots').put({key:courseStorageKey(operation.ownerId,operation.courseId),ownerId:operation.ownerId,snapshot});
      t.objectStore('queue').put({...operation,sequence:next});
    };
    t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error??new Error('记录未保存'));t.onerror=()=>reject(t.error);
  });
}
export async function readCourseQueue(ownerId:string,courseId:string):Promise<CourseOperation[]> {
  const operations=await transact<CourseOperation[]>(['queue'],'readonly',t=>t.objectStore('queue').index('ownerId').getAll(ownerId));
  return orderCourseQueue(operations.filter(op=>op.ownerId===ownerId&&op.courseId===courseId));
}
export async function removeCourseOperation(operationId:string) {await transact(['queue'],'readwrite',t=>t.objectStore('queue').delete(operationId));}
export async function loadCourseReset(ownerId:string,courseId:string):Promise<number|null> {return (await transact<number|undefined>(['metadata'],'readonly',t=>t.objectStore('metadata').get(`reset:${courseStorageKey(ownerId,courseId)}`)))??null;}
export async function saveCourseReset(ownerId:string,courseId:string,generation:number|null) {
 const key=`reset:${courseStorageKey(ownerId,courseId)}`;
 if(generation===null)await transact(['metadata'],'readwrite',t=>t.objectStore('metadata').delete(key));
 else await transact(['metadata'],'readwrite',t=>t.objectStore('metadata').put(generation,key));
}
