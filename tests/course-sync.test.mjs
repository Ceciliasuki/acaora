import assert from 'node:assert/strict';
import test from 'node:test';
import {mergeCourseSnapshot,flushCourseQueue,courseStorageKey,orderCourseQueue} from '../app/courses/course-sync.mjs';
const snapshot=(more={})=>({courseId:'STAT-201',generation:1,completedLessonIds:[],lastLessonId:null,attempts:[],...more});
const operation=(more={})=>({...snapshot(),ownerId:'a',operationId:'operation',...more});
test('concurrent completion and attempt sets merge idempotently',()=>{
 const a=snapshot({completedLessonIds:['lesson-1'],attempts:[{id:'a'}]});
 const b=snapshot({completedLessonIds:['lesson-2'],attempts:[{id:'b'}]});
 const merged=mergeCourseSnapshot(a,b);
 assert.deepEqual(merged.completedLessonIds,['lesson-1','lesson-2']);assert.equal(merged.attempts.length,2);
 assert.deepEqual(mergeCourseSnapshot(merged,b),merged);
});
test('new generation replaces old completed records and attempts',()=>{
 const local=snapshot({completedLessonIds:['lesson-1'],attempts:[{id:'old'}]});
 const remote=snapshot({generation:2});assert.deepEqual(mergeCourseSnapshot(local,remote),remote);
});
test('a late response from an older generation cannot undo a reset',()=>{
 const current=snapshot({generation:2});const late=snapshot({completedLessonIds:['lesson-1']});
 assert.deepEqual(mergeCourseSnapshot(current,late),current);
});
test('unrelated course records cannot be merged and account keys differ',()=>{
 assert.throws(()=>mergeCourseSnapshot(snapshot(),snapshot({courseId:'FIN-308'})));
 assert.notEqual(courseStorageKey('a','STAT-201'),courseStorageKey('b','STAT-201'));
});
test('401 and 503 retain durable operations, with no cross-account send',async()=>{
 for(const status of [401,503]) {
  const removed=[],sent=[];
  const result=await flushCourseQueue({ownerId:'a',operations:[operation(),operation({ownerId:'b',operationId:'foreign'})],send:async(op)=>{sent.push(op);return {status};},remove:async(id)=>removed.push(id),onSnapshot:async()=>{}});
  assert.deepEqual(removed,[]);assert.equal(sent.length,1);assert.equal(result,status===401?'signed-out':'pending');
 }
});
test('409 adopts server reset and discards all stale operations, including later ones',async()=>{
 const removed=[],sent=[];let adopted;
 const result=await flushCourseQueue({ownerId:'a',operations:[operation(),operation({operationId:'later'})],send:async(op)=>{sent.push(op);return {status:409,snapshot:snapshot({generation:2})};},remove:async(id)=>removed.push(id),onSnapshot:async(s)=>{adopted=s;}});
 assert.equal(result,'reset');assert.equal(sent.length,1);assert.deepEqual(removed,['operation','later']);assert.equal(adopted.generation,2);
});
test('successful operation is only removed after durable snapshot update',async()=>{
 const actions=[];
 assert.equal(await flushCourseQueue({ownerId:'a',operations:[operation()],send:async()=>({status:200,snapshot:snapshot()}),onSnapshot:async()=>actions.push('save'),remove:async()=>actions.push('remove')}),'synced');
 assert.deepEqual(actions,['save','remove']);
 await assert.rejects(flushCourseQueue({ownerId:'a',operations:[operation()],send:async()=>({status:200,snapshot:snapshot()}),onSnapshot:async()=>{throw Error('disk');},remove:async()=>actions.push('wrong-removal')}));
 assert.deepEqual(actions,['save','remove']);
});
test('switching accounts during snapshot persistence leaves the original queue intact',async()=>{
 let current=true;const removed=[];
 const result=await flushCourseQueue({ownerId:'a',operations:[operation()],isCurrent:()=>current,send:async()=>({status:200,snapshot:snapshot()}),onSnapshot:async()=>{current=false;},remove:async(id)=>removed.push(id)});
 assert.equal(result,'signed-out');assert.deepEqual(removed,[]);
});

test('durable sequence restores navigation order despite random operation IDs',()=>{
 const first=operation({operationId:'ffffffff',sequence:1,lastLessonId:'lesson-1'});
 const second=operation({operationId:'11111111',sequence:2,lastLessonId:'lesson-2'});
 assert.deepEqual(orderCourseQueue([second,first]),[first,second]);
});
