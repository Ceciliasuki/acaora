const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export function validateCourseOperation(value,ownerId,course,questions) {
 const errors=[];
 if(!value||typeof value!=='object'||Array.isArray(value))return ['请求格式无效'];
 if(value.ownerId!==ownerId||value.courseId!==course.code||!uuid(value.operationId))errors.push('账号、课程或操作标识不一致');
 if(!Number.isSafeInteger(value.generation)||value.generation<1||value.generation>2147483647)errors.push('进度代次无效');
 const lessons=new Set(course.chapters.flatMap(c=>c.lessons.map(l=>l.id)));
 if(!Array.isArray(value.completedLessonIds)||value.completedLessonIds.length>256||value.completedLessonIds.some(id=>!lessons.has(id)))errors.push('完成课节不在目录中');
 if(value.lastLessonId!==null&&!lessons.has(value.lastLessonId))errors.push('阅读位置无效');
 if(!Array.isArray(value.attempts)||value.attempts.length>50)return [...errors,'尝试批次无效'];
 const ids=new Set();
 for(const attempt of value.attempts) {
  if(!attempt||!uuid(attempt.id)||ids.has(attempt.id)){errors.push('尝试标识无效或重复');continue;}
  ids.add(attempt.id);
  const question=questions.get(attempt.questionId);
  if(!question||!Number.isSafeInteger(attempt.questionVersion)||attempt.questionVersion<1||attempt.questionVersion>question.version)errors.push('题目或版本不在内容清单中');
  if(typeof attempt.answer!=='string'||attempt.answer.length>8000||typeof attempt.viewedSolution!=='boolean'||!Number.isSafeInteger(attempt.createdAt)||attempt.createdAt<0||attempt.createdAt>8640000000000000)errors.push('作答记录无效');
 }
 return errors;
}
