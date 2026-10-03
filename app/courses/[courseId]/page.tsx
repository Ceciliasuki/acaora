import {notFound} from 'next/navigation';
import {listCourses,loadLesson,loadAssessment} from '../course-content.mjs';
import CourseShell from '../course-shell';
import CourseOverview from '../course-overview';
export default async function CoursePage({params}:{params:Promise<{courseId:string}>}) {
 const {courseId}=await params;const course=listCourses().find(c=>c.code===courseId);if(!course)notFound();
 const available=(await Promise.all(course.chapters.flatMap(c=>c.lessons.map(async l=>(await loadLesson(courseId,l.id))?l.id:null)))).filter((id):id is string=>id!==null);
 const assessments=(await Promise.all(['case-study'].map(async id=>(await loadAssessment(courseId,id))?id:null))).filter((id):id is string=>id!==null);
 return <CourseShell title="课程目录"><CourseOverview course={course} available={available} assessments={assessments}/></CourseShell>;
}
