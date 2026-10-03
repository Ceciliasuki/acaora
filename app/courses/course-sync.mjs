export function courseStorageKey(ownerId,courseId) { return JSON.stringify([ownerId,courseId]); }
export function orderCourseQueue(operations) {
  // Pre-upgrade entries have no recoverable navigation timestamp. Send them
  // before newly sequenced entries so new navigation remains the final position.
  return [...operations].sort((a,b)=>(a.sequence??0)-(b.sequence??0));
}
export function mergeCourseSnapshot(local,remote) {
  if(local.courseId!==remote.courseId)throw new Error('不能合并不同课程');
  if(local.generation!==remote.generation)return local.generation>remote.generation?local:remote;
  const attempts=new Map(local.attempts.map(a=>[a.id,a]));
  for(const a of remote.attempts)attempts.set(a.id,a);
  return {...remote,completedLessonIds:[...new Set([...local.completedLessonIds,...remote.completedLessonIds])].sort(),attempts:[...attempts.values()].sort((a,b)=>(a.createdAt??0)-(b.createdAt??0)||a.id.localeCompare(b.id))};
}
export async function flushCourseQueue({ownerId,operations,send,remove,onSnapshot,isCurrent=()=>true}) {
  for(const operation of operations.filter(op=>op.ownerId===ownerId)) {
    if(!isCurrent())return 'signed-out';
    let result;
    try {result=await send(operation);}catch {return 'pending';}
    if(!isCurrent())return 'signed-out';
    if(result.status===401)return 'signed-out';
    if(result.status===409&&result.snapshot) {
      await onSnapshot(result.snapshot);
      if(!isCurrent())return 'signed-out';
      for(const stale of operations.filter(op=>op.ownerId===ownerId&&op.courseId===operation.courseId&&op.generation!==result.snapshot.generation))await remove(stale.operationId);
      return 'reset';
    }
    if(result.status!==200||!result.snapshot)return 'pending';
    await onSnapshot(result.snapshot);
    if(!isCurrent())return 'signed-out';
    await remove(operation.operationId);
  }
  return 'synced';
}
