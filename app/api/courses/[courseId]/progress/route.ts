import {NextResponse} from 'next/server';
import {authError,privateNoStore,readRequestSession,supabaseRest} from '../../../auth/_shared';
import {listCourses,loadLesson,loadAssessment} from '../../../../courses/course-content.mjs';
import {validateCourseOperation} from '../../../../courses/course-request.mjs';
import {gradeQuestion} from '../../../../courses/course-grading.mjs';
import type {CourseOperation,CourseSnapshot,CourseSummary,Question} from '../../../../courses/course-types';
type Context={params:Promise<{courseId:string}>};
const json=(payload:unknown,status=200)=>privateNoStore(NextResponse.json(payload,{status}));
const maxBytes=128*1024;
async function readBody(request:Request) {
  const reader=request.body?.getReader();if(!reader)throw Error('INVALID_BODY');
  const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw Error('INVALID_BODY');}chunks.push(value);}}
  finally {reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(data));}catch{throw Error('INVALID_BODY');}
}
async function rpc(name:string,token:string,body:unknown) {
 const response=await supabaseRest(`rpc/${name}`,token,{method:'POST',body:JSON.stringify(body)});
 const payload=await response.json();
 if(!response.ok) {
   if(payload.message==='COURSE_GENERATION_CONFLICT')throw Error('GENERATION_CONFLICT');
   if(payload.message==='COURSE_ATTEMPT_CONFLICT')throw Error('ATTEMPT_CONFLICT');
   throw Error('COURSE_STORE_UNAVAILABLE');
 }
 return payload as CourseSnapshot;
}
async function questionMap(course:CourseSummary) {
 const lessons=await Promise.all(course.chapters.flatMap(c=>c.lessons.map(l=>loadLesson(course.code,l.id))));
 const assessments=await Promise.all([...course.chapters.map(c=>c.id),'midterm','final','case-study'].map(id=>loadAssessment(course.code,id)));
 return new Map<string,Question>([...lessons,...assessments].flatMap(item=>item?.questions??[]).map(q=>[q.id,q]));
}
async function handle(request:Request,context:Context,action:'read'|'sync'|'reset') {
 try {
  const {courseId}=await context.params;
  const course=listCourses().find(c=>c.code===courseId);if(!course)return json({error:'课程不存在。'},404);
  const session=await readRequestSession();if(!session)return json({error:'请登录后保存课程记录。'},401);
  if(action==='read')return json({ownerId:session.user.id,snapshot:await rpc('read_course_progress',session.accessToken,{p_course:courseId})});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'请发送 JSON 格式课程记录。'},400);
  const body=await readBody(request);
  try {
   if(action==='reset') {
    if(!body||body.ownerId!==session.user.id||!Number.isSafeInteger(body.generation)||body.generation<1||body.generation>2147483647)return json({error:'账号或进度代次无效。'},400);
    return json({ownerId:session.user.id,snapshot:await rpc('reset_course_progress',session.accessToken,{p_course:courseId,p_generation:body.generation})});
   }
   const questions=await questionMap(course);
   const errors=validateCourseOperation(body,session.user.id,course,questions);if(errors.length)return json({error:errors.join('；')},400);
   const op=body as CourseOperation;
   const snapshot=await rpc('sync_course_progress',session.accessToken,{p_course:courseId,p_generation:op.generation,p_completed:op.completedLessonIds,p_last:op.lastLessonId,p_attempts:op.attempts});
   // Scores are derived from the published question, never accepted from a client.
   const results=op.attempts.map(a=>({id:a.id,...gradeQuestion(questions.get(a.questionId)!,a.answer)}));
   return json({ownerId:session.user.id,snapshot,results});
  } catch(error) {
   if(error instanceof Error&&error.message==='GENERATION_CONFLICT')return json({ownerId:session.user.id,error:'该课程已在其他设备重置，采用云端新进度。',snapshot:await rpc('read_course_progress',session.accessToken,{p_course:courseId})},409);
   throw error;
  }
 } catch(error) {
   if(error instanceof Error&&['INVALID_BODY','ATTEMPT_CONFLICT'].includes(error.message))return json({error:'课程记录格式无效，未写入云端。'},400);
   if(error instanceof Error&&error.message==='COURSE_STORE_UNAVAILABLE')return json({error:'课程云端记录暂不可用，本机待同步记录会保留。'},503);
   return authError(error);
 }
}
export async function GET(request:Request,context:Context){return handle(request,context,'read');}
export async function PUT(request:Request,context:Context){return handle(request,context,'sync');}
export async function POST(request:Request,context:Context){return handle(request,context,'reset');}
