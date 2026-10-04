import {notFound} from 'next/navigation';
import {listCourses,loadAssessment,availableLessonIds} from '../../../course-content.mjs';
import CourseStudy from '../../../course-study';
import {CourseText} from '../../../course-text';
import styles from '../../../courses.module.css';
export default async function AssessmentPage({params}:{params:Promise<{courseId:string;assessmentId:string}>}) {
 const {courseId,assessmentId}=await params;const course=listCourses().find(c=>c.code===courseId);const assessment=await loadAssessment(courseId,assessmentId);if(!course||!assessment)notFound();
 return <CourseStudy course={course} available={await availableLessonIds(course)} lessonId={null} title={assessment.title} questions={assessment.questions}>{assessment.context?.map(section=>{const content=<section><h2>{section.heading}</h2>{section.paragraphs.map((p,i)=><p key={i}><CourseText text={p}/></p>)}</section>;return section.optional?<details className={styles.references} key={section.heading}><summary>参考：{section.heading}</summary>{content}</details>:<div key={section.heading}>{content}</div>;})}</CourseStudy>;
}
