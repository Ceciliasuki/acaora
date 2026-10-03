import {notFound} from 'next/navigation';
import {listCourses,loadLesson,loadAssessment} from '../../course-content.mjs';
import CourseReview from '../../course-review';
import CourseShell from '../../course-shell';
export default async function ReviewPage({params}:{params:Promise<{courseId:string}>}) {
 const {courseId}=await params;const course=listCourses().find(c=>c.code===courseId);if(!course)notFound();
 const lessons=await Promise.all(course.chapters.flatMap(c=>c.lessons.map(l=>loadLesson(courseId,l.id))));
 const assessments=await Promise.all([...course.chapters.map(c=>c.id),'midterm','final'].map(id=>loadAssessment(courseId,id)));
 const items=[...lessons.flatMap(lesson=>lesson?lesson.questions.map(question=>({question,href:`/courses/${courseId}/${lesson.id}`})):[]),...assessments.flatMap(a=>a?a.questions.map(question=>({question,href:`/courses/${courseId}/assessments/${a.id}`})):[])];
 return <CourseShell title={course.name}><CourseReview course={course} items={items}/></CourseShell>;
}
