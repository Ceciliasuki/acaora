import type {CourseSummary} from './course-types';
type Entry=CourseSummary['chapters'][number]['lessons'][number]&{available:boolean};
export function studyNavigation(course:CourseSummary,availableLessonIds:string[],lessonId:string|null):{items:Entry[];index:number;next:Entry|null};
