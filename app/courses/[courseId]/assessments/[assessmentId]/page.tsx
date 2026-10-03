import {notFound} from 'next/navigation';
import {listCourses,loadAssessment} from '../../../course-content.mjs';
import CourseStudy from '../../../course-study';
export default async function AssessmentPage({params}:{params:Promise<{courseId:string;assessmentId:string}>}) {
 const {courseId,assessmentId}=await params;const course=listCourses().find(c=>c.code===courseId);const assessment=await loadAssessment(courseId,assessmentId);if(!course||!assessment)notFound();
 return <CourseStudy course={course} lessonId={null} title={assessment.title} questions={assessment.questions}/>;
}
