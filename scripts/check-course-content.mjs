import {readFile} from 'node:fs/promises';
import {listCourses,loadLesson,loadAssessment,validateCatalog} from '../app/courses/course-content.mjs';
import path from 'node:path';
import {auditMathMarkup,auditNumericalEvidence} from '../app/courses/course-evidence.mjs';
const args=process.argv.slice(2).filter(arg=>arg!=='--');
const selected=args.includes('--course')?args[args.indexOf('--course')+1]:args[0];
const courses=listCourses();
if(selected&&!courses.some(c=>c.code===selected)) throw new Error('未知课程');
const failures=validateCatalog(courses);
const allIds=new Set();
let lessons=0,questions=0;
for(const course of courses.filter(c=>!selected||c.code===selected)) {
  const lessonIds=new Set();
  const checkedLessons=[],checkedAssessments=[],prompts=new Set();
  for(const chapter of course.chapters) {
    for(const entry of chapter.lessons) {
      if(lessonIds.has(entry.id)) failures.push(`${course.code} 重复课节 ${entry.id}`);
      lessonIds.add(entry.id);
      const lesson=await loadLesson(course.code,entry.id);
      if(!lesson){failures.push(`${course.code}/${entry.id} 缺失或未通过内容校验`);continue;}
      if(lesson.chapterId!==chapter.id) failures.push(`${course.code}/${entry.id} 章节不一致`);
      lessons++;
      checkedLessons.push(lesson);
      failures.push(...auditMathMarkup(lesson).map(error=>`${course.code}/${entry.id} ${error}`));
      for(const section of lesson.sections)if(section.figure) {
        try {
          const svg=await readFile(path.join('public',section.figure.src.slice(1)),'utf8');
          if(!svg.includes('<svg')||/<(?:script|foreignObject)\b|\bon\w+\s*=|(?:xlink:)?href\s*=/i.test(svg))failures.push(`${course.code}/${entry.id} 图形文件含非静态内容`);
        } catch {failures.push(`${course.code}/${entry.id} 图形文件缺失`);}
      }
      for(const objective of lesson.objectives)if(!lesson.questions.some(q=>q.objective===objective))failures.push(`${course.code}/${entry.id} 目标未配套练习：${objective}`);
      for(const level of ['基础','核心','挑战'])if(!lesson.questions.some(q=>q.level===level))failures.push(`${course.code}/${entry.id} 缺少${level}练习`);
      for(const q of lesson.questions) {
        if(allIds.has(q.id)) failures.push(`重复题目 ${q.id}`);
        const prompt=q.prompt.replace(/\s+/g,'');
        if(prompts.has(prompt))failures.push(`重复题干 ${q.id}`);
        prompts.add(prompt);
        allIds.add(q.id);questions++;
      }
    }
  }
  for(const entry of course.format==='guided'?['case-study']:[...course.chapters.map(c=>c.id),'midterm','final']) {
    const assessment=await loadAssessment(course.code,entry);
    if(!assessment){failures.push(`${course.code}/${entry} 作业或综合自测未通过`);continue;}
    checkedAssessments.push(assessment);
    failures.push(...auditMathMarkup(assessment).map(error=>`${course.code}/${entry} ${error}`));
    for(const q of assessment.questions) {
      if(allIds.has(q.id))failures.push(`重复题目 ${q.id}`);
      const prompt=q.prompt.replace(/\s+/g,'');
      if(prompts.has(prompt))failures.push(`重复题干 ${q.id}`);
      prompts.add(prompt);
      allIds.add(q.id);questions++;
    }
  }
  try {
    const coverage=JSON.parse(await readFile(path.join('content/courses',course.code,'coverage.json'),'utf8'));
    if(coverage.status!=='checked'||!coverage.targets?.length||coverage.targets.some(t=>t.status!=='checked'||!/^https?:\/\//.test(t.source)||!t.basis?.trim()||!t.lessonIds?.length||t.lessonIds.some(id=>!lessonIds.has(id)))) failures.push(`${course.code} 对标覆盖未通过`);
    const mapped=new Set((coverage.targets??[]).flatMap(t=>t.lessonIds??[]));
    for(const id of lessonIds)if(!mapped.has(id))failures.push(`${course.code}/${id} 未映射对标目标`);
  } catch {failures.push(`${course.code} 缺少覆盖记录`);}
  try {
    const calculations=JSON.parse(await readFile(path.join('content/courses',course.code,'calculations.json'),'utf8'));
    failures.push(...auditNumericalEvidence(checkedLessons,checkedAssessments,calculations).map(error=>`${course.code} ${error}`));
  } catch {failures.push(`${course.code} 缺少独立计算记录`);}
}
if(failures.length) {console.error(failures.join('\n'));process.exitCode=1;}
else console.log(`${selected??'七门课程'}：${lessons} 节、${questions} 题结构检查通过。内容深度与计算须另见逐门审查记录。`);
