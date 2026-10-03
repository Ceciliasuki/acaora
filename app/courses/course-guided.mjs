export function guidedQuestions(questions,coreQuestionIds) {
 if(!coreQuestionIds)return {core:questions,optional:[]};
 const ids=new Set(coreQuestionIds);
 return {core:coreQuestionIds.map(id=>questions.find(q=>q.id===id)).filter(Boolean),optional:questions.filter(q=>!ids.has(q.id))};
}
