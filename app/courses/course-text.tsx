import { Fragment } from "react";
import { renderCourseMath } from "./course-math.mjs";
import styles from "./courses.module.css";
export function Formula({source,block=false}:{source:string;block?:boolean}) {
  const result=renderCourseMath(source,block);
  if(result.error) return <span className={styles.mathError} role="note">{result.error} <code>{source}</code></span>;
  // Only KaTeX output reaches this sink; trust:false disables links and HTML commands.
  return <span className={block?styles.formula:undefined} dangerouslySetInnerHTML={{__html:result.html}} />;
}
export function CourseText({text}:{text:string}) {
  const parts=text.split(/(\\\([\s\S]*?\\\))/g);
  return <>{parts.map((part,i)=><Fragment key={i}>{part.startsWith("\\(")&&part.endsWith("\\)")?<Formula source={part.slice(2,-2)} />:part}</Fragment>)}</>;
}
