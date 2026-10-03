import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = path.join(process.cwd(), "content", "courses");
export function listCourses() { return JSON.parse(readFileSync(path.join(root,"catalog.json"),"utf8")); }
const text = value => typeof value === "string" && value.trim().length > 0;
const texts = value => Array.isArray(value) && value.length > 0 && value.every(text);
const id = value => typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value);
const version = value => Number.isSafeInteger(value) && value > 0;
export function validateQuestions(questions, objectives, minimum = 6) {
  const errors=[];
  if (!Array.isArray(questions) || questions.length < minimum) return ["练习不足或格式错误"];
  const ids=new Set();
  for(const q of questions) {
    if(!q || !id(q.id) || !version(q.version) || ids.has(q.id)) errors.push("题目 ID 重复、无效或版本缺失");
    ids.add(q?.id);
    if(!q || ![q.prompt,q.explanation,q.hint,q.objective].every(text) || !objectives?.includes(q.objective)) errors.push("题目缺少讲解或目标映射");
    if(!q || !["基础","核心","挑战"].includes(q.level)) errors.push("题目层次缺失");
    if(q?.type==="choice" && (!Array.isArray(q.options) || q.options.length<2 || q.options.some(o=>!id(o.id)||!text(o.text)) || new Set(q.options.map(o=>o.id)).size!==q.options.length || q.options.filter(o=>o.id===q.answer).length!==1)) errors.push("选择题答案无效");
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
