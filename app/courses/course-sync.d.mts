import type {CourseSnapshot,CourseOperation} from './course-types';
export function courseStorageKey(ownerId:string,courseId:string):string;
export function orderCourseQueue(operations:CourseOperation[]):CourseOperation[];
export function mergeCourseSnapshot(local:CourseSnapshot,remote:CourseSnapshot):CourseSnapshot;
export function flushCourseQueue(deps:{ownerId:string;operations:CourseOperation[];send:(op:CourseOperation)=>Promise<{status:number;snapshot?:CourseSnapshot}>;remove:(id:string)=>Promise<void>;onSnapshot:(snapshot:CourseSnapshot)=>Promise<void>;isCurrent?:()=>boolean}):Promise<'synced'|'signed-out'|'pending'|'reset'>;
