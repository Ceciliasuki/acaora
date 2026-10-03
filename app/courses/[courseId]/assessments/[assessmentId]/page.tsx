import {notFound} from 'next/navigation';
import {listCourses,loadAssessment,availableLessonIds} from '../../../course-content.mjs';
import CourseStudy from '../../../course-study';
import {CourseText} from '../../../course-text';
export default async function AssessmentPage({params}:{params:Promise<{courseId:string;assessmentId:string}>}) {
 const {courseId,assessmentId}=await params;const course=listCourses().find(c=>c.code===courseId);const assessment=await loadAssessment(courseId,assessmentId);if(!course||!assessment)notFound();
 return <CourseStudy course={course} available={await availableLessonIds(course)} lessonId={null} title={assessment.title} questions={assessment.questions}>{assessment.context?.map(section=><section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((p,i)=><p key={i}><CourseText text={p}/></p>)}</section>)}</CourseStudy>;
}
