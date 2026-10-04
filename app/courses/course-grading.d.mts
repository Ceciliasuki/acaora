import type { Question, Attempt } from "./course-types";
export function gradeQuestion(question: Pick<Question,"type"|"answer"|"tolerance">, answer: string): {status:"unanswered"|"correct"|"incorrect"|"self-check";feedback:string};
export function createQuestionAttempt(question:Pick<Question,"id"|"version">,answer:string,viewedSolution:boolean):Attempt|null;
export function latestQuestionAttempt(question:Pick<Question,"id"|"version">,attempts:Attempt[]):Attempt|null;
export function gradeStoredAttempt(question:Question,attempt:Attempt):{status:"unanswered"|"correct"|"incorrect"|"self-check"|"stale";feedback:string};
