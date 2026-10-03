import type {CourseSummary,Lesson,Question,ContentBlock} from "./course-types";
export function listCourses(): CourseSummary[];
export function validateCatalog(courses:CourseSummary[]):string[];
export function validateLesson(lesson: Partial<Lesson>): string[];
export function validateQuestions(questions:Question[],objectives:string[],minimum?:number):string[];
export function loadLesson(courseId:string,lessonId:string): Promise<Lesson|null>;
export function availableLessonIds(course:CourseSummary):Promise<string[]>;
export function loadAssessment(courseId:string,assessmentId:string): Promise<{id:string;title:string;questions:Question[];context?:ContentBlock[]}|null>;
