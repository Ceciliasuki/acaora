import type {CourseSummary,Question} from './course-types';
export function validateCourseOperation(value:unknown,ownerId:string,course:CourseSummary,questions:Map<string,Pick<Question,'version'>>):string[];
