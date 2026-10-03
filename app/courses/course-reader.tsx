import type {Lesson} from "./course-types";
import Image from 'next/image';
import {CourseText,Formula} from "./course-text";
import styles from "./courses.module.css";
export default function CourseReader({lesson}:{lesson:Lesson}) {
  return <article className={styles.reader}>
    <section aria-labelledby="objectives"><h2 id="objectives">学习目标</h2><ul>{lesson.objectives.map(x=><li key={x}><CourseText text={x}/></li>)}</ul>
      {lesson.prerequisites.length>0&&<p className={styles.muted}>先修：{lesson.prerequisites.join("；")}</p>}
    </section>
    {lesson.sections.map((section,i)=>{const content=<section aria-labelledby={`section-${i}`}>
      <h2 id={`section-${i}`}>{section.heading}</h2>
      {section.paragraphs.map((text,j)=><p key={j}><CourseText text={text}/></p>)}
      {section.formulas?.map((formula,j)=><Formula key={j} source={formula} block/>)}
      {section.figure&&<figure className={styles.figure}>
        {/* The full-size labelled plot scrolls with keyboard on a narrow screen. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className={styles.tableScroll} role="region" aria-label={section.figure.caption} tabIndex={0}><Image className={styles.figureImage} src={section.figure.src} width={720} height={420} alt={section.figure.alt} unoptimized/></div>
        <figcaption><CourseText text={section.figure.caption}/> · <a href={section.figure.src} target="_blank" rel="noreferrer">查看原尺寸图</a></figcaption>
      </figure>}
      {/* A labelled scroll region needs keyboard focus to scroll wide tables. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      {section.table&&<div className={styles.tableScroll} tabIndex={0} role="region" aria-label={section.table.caption}><table><caption>{section.table.caption}</caption><thead><tr>{section.table.headers.map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{section.table.rows.map((row,j)=><tr key={j}>{row.map((x,k)=><td key={k}><CourseText text={x}/></td>)}</tr>)}</tbody></table></div>}
    </section>;return section.optional?<details className={styles.references} key={section.heading}><summary>选学：{section.heading}</summary>{content}</details>:<div key={section.heading}>{content}</div>;})}
    <section aria-labelledby="examples"><h2 id="examples">完整例题</h2>{lesson.examples.map((example,i)=>{const content=<div className={styles.example}>
      <h3>例 {i+1} · {example.title}</h3><p><CourseText text={example.problem}/></p>
      <ol>{example.steps.map((step,j)=><li key={j}><CourseText text={step}/></li>)}</ol><p><strong>结论：</strong><CourseText text={example.conclusion}/></p>
    </div>;return i>0&&lesson.format==='guided'?<details key={example.title} className={styles.references}><summary>{i===1?'更多例题（选学）':`例 ${i+1}（选学）`}</summary>{content}</details>:<div key={example.title}>{content}</div>;})}</section>
    <section aria-labelledby="summary"><h2 id="summary">本节小结</h2><ul>{lesson.summary.map(x=><li key={x}><CourseText text={x}/></li>)}</ul></section>
    <details className={styles.references}><summary>参考资料与内容范围</summary><p>讲义、例题与练习由本站编写。所列公开资料用于核对知识范围，不代表院校认证或学分等效。</p><ul>{lesson.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> — {source.note}</li>)}</ul></details>
  </article>;
}
