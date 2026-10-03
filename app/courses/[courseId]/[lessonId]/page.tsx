import {notFound} from 'next/navigation';
import {listCourses,loadLesson} from '../../course-content.mjs';
import CourseReader from '../../course-reader';
import CourseStudy from '../../course-study';
export default async function LessonPage({params}:{params:Promise<{courseId:string;lessonId:string}>}) {
 const {courseId,lessonId}=await params;const course=listCourses().find(c=>c.code===courseId);const lesson=await loadLesson(courseId,lessonId);if(!course||!lesson)notFound();
 return <CourseStudy course={course} lessonId={lessonId} title={lesson.title} questions={lesson.questions}><CourseReader lesson={lesson}/></CourseStudy>;
}
