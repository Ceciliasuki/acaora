import assert from 'node:assert/strict';import test from 'node:test';
import {studyNavigation} from '../app/courses/course-navigation.mjs';
test('draft chapters never receive study links or a clickable next-lesson target',()=>{
 const course={chapters:[{lessons:[{id:'lesson-1'},{id:'lesson-2'}]}]};
 const nav=studyNavigation(course,['lesson-1'],'lesson-1');
 assert.equal(nav.next,null);assert.equal(nav.items[1].available,false);
 const checked=studyNavigation(course,['lesson-1','lesson-2'],'lesson-1');assert.equal(checked.next.id,'lesson-2');
});
test('guided next step skips electives without skipping an unchecked core lesson',()=>{
 const course={chapters:[{lessons:[{id:'lesson-1'},{id:'lesson-2',optional:true},{id:'lesson-3'}]}]};
 assert.equal(studyNavigation(course,['lesson-1','lesson-2','lesson-3'],'lesson-1').next.id,'lesson-3');
 assert.equal(studyNavigation(course,['lesson-1','lesson-2'],'lesson-1').next,null);
 assert.equal(studyNavigation(course,['lesson-1','lesson-2','lesson-3'],'lesson-2').next.id,'lesson-3');
});
