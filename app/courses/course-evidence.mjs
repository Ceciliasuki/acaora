import {renderCourseMath} from './course-math.mjs';
export function auditNumericalEvidence(lessons,assessments,calculations) {
 const failures=[],records=new Map();
 for(const record of calculations?.checks??[]) {
  if(records.has(record.id))failures.push(`重复计算记录 ${record.id}`);
  records.set(record.id,record);
 }
 const questions=[...lessons,...assessments].flatMap(item=>item.questions??[]);
 const required=[...questions.filter(q=>q.type==='numeric').map(q=>({id:q.id,answer:q.answer,tolerance:q.tolerance})),...lessons.flatMap(l=>(l.examples??[]).map(e=>({id:e.calculationId})))];
 for(const item of required) {
  if(!item.id){failures.push('数值例题未关联计算记录');continue;}
  const r=records.get(item.id);
  if(!r){failures.push(`缺少独立计算 ${item.id}`);continue;}
  if(r.status!=='passed'||![r.computed,r.declared,r.tolerance].every(Number.isFinite)||r.tolerance<0||!r.method?.trim()||!r.inputs||!Object.keys(r.inputs).length||Math.abs(r.computed-r.declared)>r.tolerance)failures.push(`计算记录无效 ${item.id}`);
  if(item.answer!==undefined&&(r.declared!==item.answer||r.tolerance>item.tolerance||Math.abs(r.computed-item.answer)>item.tolerance))failures.push(`数值答案已变更或复算容差不符 ${item.id}`);
 }
 return failures;
}
export function auditMathMarkup(content) {
 const failures=[];
 function check(source) {
  if(/\\(?:href|url|htmlClass|htmlId|htmlStyle|htmlData|includegraphics)\b/.test(source)||renderCourseMath(source).error) failures.push(`公式无法排版或包含交互命令：${source}`);
 }
 function walk(value) {
  if(typeof value==='string') {
   const starts=value.match(/\\\(/g)?.length??0,ends=value.match(/\\\)/g)?.length??0;
   if(starts!==ends)failures.push(`行内公式分隔符不匹配：${value}`);
   for(const match of value.matchAll(/\\\((.*?)\\\)/gs))check(match[1]);
  } else if(Array.isArray(value))value.forEach(walk);
  else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(key==='formulas'&&Array.isArray(item))item.forEach(check);else walk(item);}
 }
 walk(content);return failures;
}
