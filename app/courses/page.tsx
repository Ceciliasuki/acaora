import {listCourses} from './course-content.mjs';
import CourseCatalog from './course-catalog';
export default async function CoursesPage() {
 return <CourseCatalog courses={listCourses()}/>;
}
