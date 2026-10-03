export function gradeQuestion(question, rawAnswer) {
  const answer = String(rawAnswer ?? "").trim();
  if (!answer) return { status: "unanswered", feedback: "请先作答。" };
  if (question.type === "open") return { status: "self-check", feedback: "这道题需要对照评分要点自查，系统不自动评分。" };
  let correct = false;
  if (question.type === "choice") correct = answer === String(question.answer);
  if (question.type === "numeric") {
    const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
    const value = decimal.test(answer) ? Number(answer) : NaN;
    correct = Number.isFinite(value) && Number.isFinite(Number(question.answer)) && Math.abs(value - Number(question.answer)) <= (question.tolerance ?? 1e-8);
  }
  return { status: correct ? "correct" : "incorrect", feedback: correct ? "回答正确。请继续检查解题条件。" : "答案还不一致，可以先看提示再试一次。" };
}
let lastCreatedAt=0;
export function createQuestionAttempt(question, answer, viewedSolution) {
  const value=String(answer??'').trim();
  if(!value&&!viewedSolution) return null;
  lastCreatedAt=Math.max(Date.now(),lastCreatedAt+1);
  return {id:globalThis.crypto.randomUUID(),questionId:question.id,questionVersion:question.version,answer:value,viewedSolution:Boolean(viewedSolution),createdAt:lastCreatedAt};
}
export function latestQuestionAttempt(question, attempts) {
  return attempts.filter(a=>a.questionId===question.id&&a.questionVersion===question.version).sort((a,b)=>b.createdAt-a.createdAt)[0]??null;
}
