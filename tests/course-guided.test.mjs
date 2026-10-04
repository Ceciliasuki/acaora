import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLesson,loadLesson,loadAssessment} from '../app/courses/course-content.mjs';
import {guidedQuestions} from '../app/courses/course-guided.mjs';
test('guided lessons have one example and three valid core questions without losing optional material',async()=>{
 const source=await loadLesson('STAT-201','lesson-1');
 const lesson={...source,format:'guided',examples:source.examples.slice(0,1),questions:[source.questions[0],source.questions[2],source.questions[5]]};
 lesson.coreQuestionIds=lesson.questions.map(q=>q.id);
 assert.deepEqual(validateLesson(lesson),[]);
 for(const ids of [[],[lesson.questions[0].id],Array(3).fill(lesson.questions[0].id),[...lesson.coreQuestionIds.slice(0,2),'unknown']]){
  assert.ok(validateLesson({...lesson,coreQuestionIds:ids}).length);
 }
 const split=guidedQuestions(source.questions,lesson.coreQuestionIds);
 assert.equal(split.core.length,3);assert.equal(split.optional.length,3);
 assert.deepEqual(new Set([...split.core,...split.optional].map(q=>q.id)),new Set(source.questions.map(q=>q.id)));
});
test('guided case is a checked original scenario with three exercises',async()=>{
 const assessment=await loadAssessment('STAT-201','case-study');
 assert.ok(assessment);assert.equal(assessment.questions.length,3);assert.ok(assessment.context?.length);
 assert.equal(await loadAssessment('STAT-201','../case-study'),null);
});
