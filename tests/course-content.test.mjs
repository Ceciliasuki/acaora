import assert from 'node:assert/strict';
import test from 'node:test';
import { listCourses, loadLesson, validateLesson } from '../app/courses/course-content.mjs';
test('catalog contains all seven existing course codes', () => {
  assert.deepEqual(listCourses().map(c=>c.code).sort(), ['STAT-201','STAT-302','STAT-306','ECON-301','ECON-204','TRADE-305','FIN-308'].sort());
});
test('unknown paths cannot escape the lesson whitelist', async () => {
  assert.equal(await loadLesson('STAT-201', '../../settings'), null);
  assert.equal(await loadLesson('unknown', 'lesson-1'), null);
});
test('an empty unreviewed lesson cannot be served as checked content', () => {
  assert.ok(validateLesson({id:'empty',status:'draft',sections:[],examples:[],questions:[]}).length > 0);
});
function validLesson() {
  return {id:'lesson-1',courseId:'STAT-201',chapterId:'chapter-1',title:'测试',version:1,status:'checked',level:'核心',objectives:['计算'],prerequisites:[],summary:['小结'],sources:[{title:'来源',url:'https://example.org',note:'范围'}],sections:[{heading:'定义',paragraphs:['正文']}],examples:Array.from({length:2},()=>({title:'例题',problem:'题设',steps:['步骤'],conclusion:'解释'})),questions:Array.from({length:6},(_,i)=>({id:'q-'+i,version:1,type:'numeric',prompt:'题设',answer:0,tolerance:0,explanation:'解析',hint:'提示',level:'基础',objective:'计算'}))};
}
test('validation rejects unsafe identities, missing versions and foreign learning objectives',()=>{
  for(const mutate of [l=>{l.id='../escape';},l=>{l.version=0;},l=>{l.questions[0].objective='尚未教授';},l=>{l.questions[0].explanation='';},l=>{l.questions[0].version=0;},l=>{l.questions[1].id=l.questions[0].id;},l=>{l.sources[0].url='javascript:alert(1)';}]) {
    const lesson=validLesson(); mutate(lesson);assert.ok(validateLesson(lesson).length>0);
  }
});
test('valid schemas are accepted and malformed collections produce diagnostics',()=>{
  assert.deepEqual(validateLesson(validLesson()),[]);
  for(const key of ['sections','questions','objectives','examples','sources']) {
    const lesson=validLesson();lesson[key]={};assert.doesNotThrow(()=>validateLesson(lesson));assert.ok(validateLesson(lesson).length>0);
  }
});
