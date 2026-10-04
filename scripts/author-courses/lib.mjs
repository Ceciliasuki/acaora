import {mkdirSync,writeFileSync} from 'node:fs';
import {listCourses,validateLesson} from '../../app/courses/course-content.mjs';
export const tex=String.raw;
export function choice(id,objective,prompt,options,answer,explanation,hint,level='基础') {
 return {id,version:1,type:'choice',objective,prompt,options:options.map((text,i)=>({id:String.fromCharCode(97+i),text})),answer,explanation,hint,level};
}
export function numeric(id,objective,prompt,answer,explanation,hint,tolerance=1e-6,level='核心') {
 return {id,version:1,type:'numeric',objective,prompt,answer,tolerance,explanation,hint,level};
}
export function open(id,objective,prompt,answer,explanation,hint,level='挑战') {
 return {id,version:1,type:'open',objective,prompt,answer,explanation,hint,level};
}
export function writeLesson(courseId,id,body) {
 const course=listCourses().find(c=>c.code===courseId);const chapter=course.chapters.find(c=>c.lessons.some(l=>l.id===id));
 if(!chapter)throw new Error('课节不在正式清单：'+id);
 const entry=chapter.lessons.find(l=>l.id===id);
 const lesson={id,courseId,chapterId:chapter.id,title:entry.title,level:entry.level,version:1,status:'draft',...body};
 const errors=validateLesson({...lesson,status:'checked'});if(errors.length)throw new Error(id+': '+errors.join('；'));
 const directory=`content/courses/${courseId}/lessons`;mkdirSync(directory,{recursive:true});writeFileSync(`${directory}/${id}.json`,JSON.stringify(lesson,null,2)+'\n');
}
