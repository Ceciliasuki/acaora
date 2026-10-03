import {readFile} from 'node:fs/promises';
import {listCourses,loadLesson,loadAssessment} from '../app/courses/course-content.mjs';
import path from 'node:path';
const selected=process.argv[2];
const courses=listCourses();
if(selected&&!courses.some(c=>c.code===selected)) throw new Error('未知课程');
const failures=[];
const allIds=new Set();
let lessons=0,questions=0;
for(const course of courses.filter(c=>!selected||c.code===selected)) {
  const lessonIds=new Set();
  for(const chapter of course.chapters) {
    for(const entry of chapter.lessons) {
      if(lessonIds.has(entry.id)) failures.push(`${course.code} 重复课节 ${entry.id}`);
      lessonIds.add(entry.id);
      const lesson=await loadLesson(course.code,entry.id);
      if(!lesson){failures.push(`${course.code}/${entry.id} 缺失或未通过内容校验`);continue;}
      if(lesson.chapterId!==chapter.id) failures.push(`${course.code}/${entry.id} 章节不一致`);
      lessons++;
      for(const q of lesson.questions) {
        if(allIds.has(q.id)) failures.push(`重复题目 ${q.id}`);
        allIds.add(q.id);questions++;
      }
    }
  }
  for(const entry of [...course.chapters.map(c=>c.id),'midterm','final']) {
    const assessment=await loadAssessment(course.code,entry);
    if(!assessment){failures.push(`${course.code}/${entry} 作业或综合自测未通过`);continue;}
    for(const q of assessment.questions) {
      if(allIds.has(q.id))failures.push(`重复题目 ${q.id}`);
      allIds.add(q.id);questions++;
    }
  }
  try {
    const coverage=JSON.parse(await readFile(path.join('content/courses',course.code,'coverage.json'),'utf8'));
    if(coverage.status!=='checked'||!coverage.targets?.length||coverage.targets.some(t=>!t.source||!t.lessonIds?.length||t.lessonIds.some(id=>!lessonIds.has(id)))) failures.push(`${course.code} 对标覆盖未通过`);
  } catch {failures.push(`${course.code} 缺少覆盖记录`);}
}
if(failures.length) {console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`${selected??'七门课程'}：${lessons} 节、${questions} 题结构检查通过。内容深度与计算须另见逐门审查记录。`);
