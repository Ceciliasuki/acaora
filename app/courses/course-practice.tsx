"use client";
import {useEffect,useState} from "react";
import type {Attempt,Question} from "./course-types";
import {gradeQuestion,createQuestionAttempt,latestQuestionAttempt} from "./course-grading.mjs";
import {CourseText} from "./course-text";
import styles from "./courses.module.css";
import {guidedQuestions} from './course-guided.mjs';
function PracticeQuestion({question,index,onAttempt,attempts}:{question:Question;index:number;onAttempt:(attempt:Attempt)=>void;attempts:Attempt[]}) {
  const prior=latestQuestionAttempt(question,attempts);
  const [answer,setAnswer]=useState(prior?.answer??"");
  const [feedback,setFeedback]=useState<ReturnType<typeof gradeQuestion>|null>(null);
  const [hint,setHint]=useState(false);
  const [solution,setSolution]=useState(prior?.viewedSolution??false);
  function submit(event:React.FormEvent) {
    event.preventDefault();
    const result=gradeQuestion(question,answer);setFeedback(result);
    if(result.status==="unanswered")return;
    const attempt=createQuestionAttempt(question,answer,solution);if(attempt)onAttempt(attempt);
  }
  function reveal() {
    setSolution(true);
    const attempt=createQuestionAttempt(question,answer,true);if(attempt)onAttempt(attempt);
  }
  const answerId=`answer-${question.id}`;
  return <section className={styles.question} aria-labelledby={`title-${question.id}`}>
    <h3 id={`title-${question.id}`}>第 {index+1} 题 <span className={styles.level}>{question.level} · {question.type==="open"?"自查":question.type==="numeric"?"计算":"选择"}</span></h3>
    <p><CourseText text={question.prompt}/></p>
    <form onSubmit={submit}>
      {question.type==="choice"?<fieldset><legend className={styles.srOnly}>第 {index+1} 题选项</legend>{question.options?.map(option=><label className={styles.option} key={option.id}><input type="radio" name={answerId} value={option.id} checked={answer===option.id} onChange={()=>{setAnswer(option.id);setFeedback(null);}}/><CourseText text={option.text}/></label>)}</fieldset>:<><label htmlFor={answerId}>{question.type==="open"?"写下你的推导或判断":"输入数值答案"}</label>{question.type==="open"?<textarea id={answerId} rows={4} maxLength={8000} value={answer} onChange={e=>{setAnswer(e.target.value);setFeedback(null);}}/>:<input id={answerId} type="text" inputMode="decimal" autoComplete="off" maxLength={100} value={answer} onChange={e=>{setAnswer(e.target.value);setFeedback(null);}}/>}{question.type==="numeric"&&<p className={styles.muted}>可输入小数或科学计数法；允许绝对误差 {question.tolerance}。</p>}</>}
      <div className={styles.actions}><button type="submit">{question.type==="open"?"记录作答":"检查答案"}</button><button type="button" onClick={()=>setHint(!hint)} aria-expanded={hint}>{hint?"收起提示":"查看提示"}</button><button type="button" onClick={reveal} disabled={solution}>查看解析</button></div>
    </form>
    <div aria-live="polite" aria-atomic="true">{feedback&&<p className={feedback.status==="incorrect"?styles.incorrect:styles.feedback}>{feedback.feedback}{solution&&feedback.status==="correct"&&"（已查看解析后的作答）"}</p>}</div>
    {hint&&<p className={styles.hint}><strong>提示：</strong><CourseText text={question.hint}/></p>}
    {solution&&<div className={styles.solution}><h4>{question.type==="open"?"参考答案与评分要点":"答案与解析"}</h4><p><CourseText text={question.type==="choice"?(question.options?.find(o=>o.id===question.answer)?.text??""):String(question.answer)}/></p><p><CourseText text={question.explanation}/></p>{question.type==="open"&&<p className={styles.muted}>请逐项核对条件、推导和解释；本站不对开放题自动评分。</p>}</div>}
  </section>;
}
export default function CoursePractice({questions,coreQuestionIds,onAttempt,attempts=[]}:{questions:Question[];coreQuestionIds?:string[];onAttempt:(attempt:Attempt)=>void;attempts?:Attempt[]}) {
  const {core,optional}=guidedQuestions(questions,coreQuestionIds);
  useEffect(()=>{function revealTarget(){let id;try{id=decodeURIComponent(window.location.hash.slice(1));}catch{return;}const target=document.getElementById(id);const details=target?.closest('details');if(details){details.open=true;target?.scrollIntoView({block:'center'});}}revealTarget();window.addEventListener('hashchange',revealTarget);return()=>window.removeEventListener('hashchange',revealTarget);},[]);
  const render=(question:Question,i:number)=><PracticeQuestion key={`${question.id}-${question.version}`} question={question} index={i} onAttempt={onAttempt} attempts={attempts}/>;
  return <section aria-labelledby="practice"><h2 id="practice">练习</h2><p className={styles.muted}>先独立作答，再查看提示与解析。</p>{core.map(render)}{optional.length>0&&<details className={styles.references}><summary>更多练习（选学）</summary>{optional.map((q,i)=>render(q,core.length+i))}</details>}</section>;
}
