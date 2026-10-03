import assert from 'node:assert/strict';import test from 'node:test';
import {validateCourseOperation} from '../app/courses/course-request.mjs';
const course={code:'STAT-201',chapters:[{lessons:[{id:'lesson-1'}]}]};
const questions=new Map([['STAT-201-q',{version:1}]]);
const valid=()=>({ownerId:'a',courseId:'STAT-201',operationId:'c672f29f-ddd9-4b15-9550-c4d4844a02f9',generation:1,completedLessonIds:['lesson-1'],lastLessonId:'lesson-1',attempts:[{id:'9d4c36c8-dcbb-4d7e-a33e-4150228dd0df',questionId:'STAT-201-q',questionVersion:1,answer:'0',viewedSolution:false,createdAt:1}]});
test('operation whitelist rejects foreign identities, invalid lesson IDs, versions and oversized batches',()=>{
 assert.deepEqual(validateCourseOperation(valid(),'a',course,questions),[]);
 for(const mutate of [v=>v.ownerId='b',v=>v.courseId='FIN-308',v=>v.completedLessonIds=['../escape'],v=>v.lastLessonId='unknown',v=>v.generation=0,v=>v.attempts[0].questionVersion=2,v=>v.attempts[0].answer='x'.repeat(8001),v=>v.attempts=Array(51).fill(v.attempts[0]),v=>v.attempts[0].viewedSolution='false']) {const value=valid();mutate(value);assert.ok(validateCourseOperation(value,'a',course,questions).length);}
});
test('malformed untrusted input returns diagnostics rather than throwing',()=>{
 for(const value of [null,[],{},'invalid',{...valid(),attempts:[null]},{...valid(),completedLessonIds:{} }])assert.doesNotThrow(()=>assert.ok(validateCourseOperation(value,'a',course,questions).length));
});

test('published question revisions preserve historical attempts without accepting future versions',()=>{
 const revised=new Map([['STAT-201-q',{version:2}]]);
 assert.deepEqual(validateCourseOperation(valid(),'a',course,revised),[]);
 for(const version of [0,-1,1.5,3]) {const op=valid();op.attempts[0].questionVersion=version;assert.ok(validateCourseOperation(op,'a',course,revised).length);}
});
