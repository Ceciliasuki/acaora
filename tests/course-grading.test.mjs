import assert from 'node:assert/strict';
import test from 'node:test';
import { gradeQuestion, createQuestionAttempt, latestQuestionAttempt } from '../app/courses/course-grading.mjs';
test('open answers are self-checks, not fabricated grades', () => {
  const result = gradeQuestion({type:'open',answer:'条件'}, '我的推导');
  assert.equal(result.status, 'self-check'); assert.equal('score' in result, false);
});
test('numeric grading handles blanks, zero, tolerance and nonfinite numbers', () => {
  const q={type:'numeric',answer:0,tolerance:0.001};
  assert.equal(gradeQuestion(q,'').status,'unanswered');
  assert.equal(gradeQuestion(q,'0').status,'correct');
  assert.equal(gradeQuestion(q,'0.0005').status,'correct');
  assert.equal(gradeQuestion(q,'0.1').status,'incorrect');
  assert.equal(gradeQuestion(q,'Infinity').status,'incorrect');
  assert.equal(gradeQuestion(q,'0x0').status,'incorrect');
});
test('choices compare option IDs, not substrings', () => {
  const q={type:'choice',answer:'b'};
  assert.equal(gradeQuestion(q,'b').status,'correct');
  assert.equal(gradeQuestion(q,'abc').status,'incorrect');
});
test('viewing a solution is recorded without inventing a correct answer',()=>{
  const q={id:'q',version:1,type:'numeric',answer:0,tolerance:0};
  assert.equal(createQuestionAttempt(q,'',false),null);
  const attempt=createQuestionAttempt(q,'',true);
  assert.equal(attempt.viewedSolution,true);
  assert.equal(gradeQuestion(q,attempt.answer).status,'unanswered');
  assert.notEqual(createQuestionAttempt(q,'0',false).id,createQuestionAttempt(q,'0',false).id);
});
test('a new question version does not inherit a previously correct attempt',()=>{
  const old={id:'a',questionId:'q',questionVersion:1,answer:'0',createdAt:2,viewedSolution:false};
  assert.equal(latestQuestionAttempt({id:'q',version:2},[old]),null);
  assert.equal(latestQuestionAttempt({id:'q',version:1},[old]),old);
});
test('two actions in one millisecond remain ordered for answer restoration',()=>{
 const original=Date.now;const fixed=original();Date.now=()=>fixed;
 try {const q={id:'q',version:1};const first=createQuestionAttempt(q,'0',false),second=createQuestionAttempt(q,'1',true);assert.ok(second.createdAt>first.createdAt);assert.equal(latestQuestionAttempt(q,[first,second]),second);}
 finally {Date.now=original;}
});
