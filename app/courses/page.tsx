import {listCourses,loadLesson} from './course-content.mjs';
import CourseCatalog from './course-catalog';
export default async function CoursesPage() {
 const courses=listCourses();
 const availability=Object.fromEntries(await Promise.all(courses.map(async course=>[course.code,(await Promise.all(course.chapters.flatMap(c=>c.lessons.map(async l=>(await loadLesson(course.code,l.id))?l.id:null)))).filter((id):id is string=>id!==null)])));
 return <CourseCatalog courses={courses} availability={availability}/>;
}
