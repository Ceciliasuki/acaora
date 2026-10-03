export function studyNavigation(course,availableLessonIds,lessonId) {
 const available=new Set(availableLessonIds);
 const items=course.chapters.flatMap(c=>c.lessons.map(l=>({...l,available:available.has(l.id)})));
 const index=items.findIndex(l=>l.id===lessonId);
 const candidate=index>=0?items.slice(index+1).find(l=>!l.optional):null;
 return {items,index,next:candidate?.available?candidate:null};
}
