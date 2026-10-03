export type Question = { id: string; version: number; type: "choice" | "numeric" | "open"; prompt: string; options?: { id: string; text: string }[]; answer: string | number; tolerance?: number; explanation: string; hint: string; level: "基础" | "核心" | "挑战"; objective: string };
export type ContentBlock = { heading: string; paragraphs: string[]; formulas?: string[]; table?: {caption:string;headers:string[];rows:string[][]} };
export type Example = { title: string; problem: string; steps: string[]; conclusion: string; calculationId?: string };
export type Lesson = { id: string; courseId: string; title: string; chapterId: string; version: number; status: "draft" | "checked"; level: "预备" | "核心" | "进阶"; objectives: string[]; prerequisites: string[]; sections: ContentBlock[]; examples: Example[]; questions: Question[]; summary: string[]; sources: { title: string; url: string; note: string }[] };
export type CourseSummary = { code: string; name: string; track: "统计学" | "经济学"; description: string; prerequisites: string[]; chapters: { id: string; title: string; lessons: { id: string; title: string; level: string }[] }[] };
export type Attempt = { id: string; questionId: string; questionVersion: number; answer: string; viewedSolution: boolean; createdAt: number };
export type CourseSnapshot = { courseId: string; generation: number; completedLessonIds: string[]; lastLessonId: string | null; attempts: Attempt[] };
export type CourseOperation = CourseSnapshot & { ownerId: string; operationId: string };
