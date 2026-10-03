import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.join(process.cwd(), "content", "courses");
export function listCourses() { return JSON.parse(readFileSync(path.join(root,"catalog.json"),"utf8")); }
const text = value => typeof value === "string" && value.trim().length > 0;
const texts = value => Array.isArray(value) && value.length > 0 && value.every(text);
const id = value => typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value);
const version = value => Number.isSafeInteger(value) && value > 0;
export function validateCatalog(courses) {
  if(!Array.isArray(courses)||!courses.length)return ['目录格式无效'];
  const errors=[],codes=new Set();
  for(const course of courses) {
    if(!course||!id(course.code)||codes.has(course.code)||!text(course.name)||!Array.isArray(course.chapters)) {errors.push('课程标识重复或格式无效');continue;}
    codes.add(course.code);
    const graph=new Map(),chapters=new Set();
    for(const chapter of course.chapters) {
      if(!chapter||!id(chapter.id)||chapters.has(chapter.id)||!text(chapter.title)||!Array.isArray(chapter.lessons)||!chapter.lessons.length) {errors.push(`${course.code} 章节无效`);continue;}
      chapters.add(chapter.id);
      for(const lesson of chapter.lessons) {
        if(!lesson||!id(lesson.id)||graph.has(lesson.id)||!text(lesson.title)||!Array.isArray(lesson.prerequisites)) {errors.push(`${course.code} 课节标识重复或先修无效`);continue;}
        graph.set(lesson.id,lesson.prerequisites);
      }
    }
    const visiting=new Set(),done=new Set();
    function visit(node) {
      if(visiting.has(node)){errors.push(`${course.code} 先修存在循环`);return;}
      if(done.has(node))return;
      if(!graph.has(node)){errors.push(`${course.code} 先修课节未知：${node}`);return;}
      visiting.add(node);for(const dependency of graph.get(node))visit(dependency);visiting.delete(node);done.add(node);
    }
    for(const node of graph.keys())visit(node);
  }
  return errors;
}
export function validateQuestions(questions, objectives, minimum = 6) {
  const errors=[];
  if (!Array.isArray(questions) || questions.length < minimum) return ["练习不足或格式错误"];
  const ids=new Set();
  for(const q of questions) {
    if(!q || !id(q.id) || !version(q.version) || ids.has(q.id)) errors.push("题目 ID 重复、无效或版本缺失");
    ids.add(q?.id);
    if(!q || ![q.prompt,q.explanation,q.hint,q.objective].every(text) || !objectives?.includes(q.objective)) errors.push("题目缺少讲解或目标映射");
    if(!q || !["基础","核心","挑战"].includes(q.level)) errors.push("题目层次缺失");
    if(q?.type==="choice" && (!Array.isArray(q.options) || q.options.length<2 || q.options.some(o=>!o||!id(o.id)||!text(o.text)) || new Set(q.options.map(o=>o.id)).size!==q.options.length || q.options.filter(o=>o.id===q.answer).length!==1)) errors.push("选择题答案无效");
    if(q?.type==="numeric" && (!Number.isFinite(q.answer)||!Number.isFinite(q.tolerance)||q.tolerance<0)) errors.push("数值题答案或容差无效");
    if(q?.type==="open" && !text(q.answer)) errors.push("开放题缺少参考答案");
    if(!["choice","numeric","open"].includes(q?.type)) errors.push("未知题型");
  }
  return errors;
}
export function validateLesson(lesson) {
  if (!lesson || typeof lesson!=="object") return ["课节格式错误"];
  const errors=[];
  if(!id(lesson.id)||!id(lesson.courseId)||!id(lesson.chapterId)||!text(lesson.title)||!version(lesson.version)) errors.push("课节标识或版本无效");
  if(lesson.status!=="checked") errors.push("课节尚未检查");
  if(!["预备","核心","进阶"].includes(lesson.level)) errors.push("课节层次无效");
  if(!texts(lesson.objectives)||!texts(lesson.summary)||!Array.isArray(lesson.prerequisites)) errors.push("目标、小结或先修缺失");
  if(!Array.isArray(lesson.sources)||!lesson.sources.length||lesson.sources.some(s=>!s || !text(s.title)||!text(s.note)||!/^https?:\/\//.test(s.url))) errors.push("来源缺失或不安全");
  if(!Array.isArray(lesson.sections)||!lesson.sections.length||lesson.sections.some(s=>!s || !text(s.heading)||!texts(s.paragraphs)||(s.formulas!==undefined&&!texts(s.formulas)))) errors.push("正文不完整");
  for(const s of Array.isArray(lesson.sections)?lesson.sections:[])if(s?.table) {
    const t=s.table;
    if(!text(t.caption)||!texts(t.headers)||!Array.isArray(t.rows)||!t.rows.length||t.rows.some(row=>!Array.isArray(row)||row.length!==t.headers.length||!row.every(text))) errors.push('表格格式无效');
  }
  for(const s of Array.isArray(lesson.sections)?lesson.sections:[])if(s?.figure) {
    const f=s.figure;
    if(!text(f.caption)||!text(f.alt)||!/^\/courses\/[A-Z0-9-]+\/[a-z0-9-]+\.svg$/.test(f.src)||!f.src.startsWith(`/courses/${lesson.courseId}/`))errors.push('图形来源或说明无效');
  }
  if(!Array.isArray(lesson.examples)||lesson.examples.length<2||lesson.examples.some(e=>!e || ![e.title,e.problem,e.conclusion].every(text)||!texts(e.steps))) errors.push("完整例题不足");
  errors.push(...validateQuestions(lesson.questions,Array.isArray(lesson.objectives)?lesson.objectives:[]));
  return errors;
}
export async function loadLesson(courseId,lessonId) {
  const course=listCourses().find(c=>c.code===courseId);
  if (!course?.chapters.some(c=>c.lessons.some(l=>l.id===lessonId))) return null;
  try {
    const lesson=JSON.parse(await readFile(path.join(root,courseId,"lessons",lessonId+".json"),"utf8"));
    return lesson.courseId!==courseId || lesson.id!==lessonId || validateLesson(lesson).length ? null : lesson;
  } catch(error) { if(error.code==="ENOENT") return null; throw error; }
}
export async function availableLessonIds(course) {
 return (await Promise.all(course.chapters.flatMap(c=>c.lessons.map(async lesson=>(await loadLesson(course.code,lesson.id))?lesson.id:null)))).filter(id=>id!==null);
}
export async function loadAssessment(courseId,assessmentId) {
  if(!listCourses().some(c=>c.code===courseId) || !/^(midterm|final|chapter-\d+)$/.test(assessmentId)) return null;
  try {
    const all=JSON.parse(await readFile(path.join(root,courseId,"assessments.json"),"utf8"));
    const assessment=all.find(a=>a.id===assessmentId);
    if(!assessment || assessment.status!=="checked" || !texts(assessment.objectives) || validateQuestions(assessment.questions,assessment.objectives,assessmentId.startsWith("chapter-")?8:12).length) return null;
    return assessment;
  }
  catch(error){ if(error.code==="ENOENT")return null;throw error; }
}
