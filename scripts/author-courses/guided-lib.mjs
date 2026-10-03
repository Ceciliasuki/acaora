import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {writeLesson,choice,numeric,open} from './lib.mjs';
export {choice,numeric,open};
export const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
export function configure(code,topics,source){
 const catalog=JSON.parse(readFileSync('content/courses/catalog.json','utf8')),course=catalog.find(c=>c.code===code);
 course.format='guided';course.chapters=topics.map((topic,i)=>({id:`chapter-${i+1}`,title:topic.title,lessons:[{id:`lesson-${i+1}`,title:topic.title,level:i===0?'预备':topic.optional?'进阶':'核心',optional:!!topic.optional,prerequisites:i?[`lesson-${i}`]:[]}]}));
 save('content/courses/catalog.json',catalog);mkdirSync(`content/courses/${code}`,{recursive:true});
 save(`content/courses/${code}/coverage.json`,{courseId:code,status:'draft',scope:'按用户批准的核心课程与选学结构编写；公开大纲仅为主题范围参考，不声称全大纲等效。',targets:topics.map((t,i)=>({topic:t.title,source:source.url,basis:t.basis??t.title,lessonIds:[`lesson-${i+1}`],status:'draft'}))});
 return {lesson(i,{objectives,sections,example,questions,summary,prerequisites=[]}){writeLesson(code,`lesson-${i}`,{format:'guided',coreQuestionIds:questions.map(q=>q.id),objectives,prerequisites,sections,examples:[example],questions,summary,sources:[source]});},scenario({title,context,questions}){save(`content/courses/${code}/assessments.json`,[{id:'case-study',title,status:'draft',version:1,objectives:[...new Set(questions.map(q=>q.objective))],context,questions}]);}};
}
