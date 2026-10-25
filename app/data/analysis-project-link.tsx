'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {projectsChangedEvent} from '../lib/research-links';
import {authChangeEvent,authFetch,getCurrentUser} from '../lib/auth-client';
import {Button} from '../components/ui';
import type {ProjectEvidence} from '../lib/project-evidence';
import type {ResearchSnapshot} from './research-history';
import styles from './multiple-regression.module.css';
import {analysisRoles, validateProjectAnalysis, validateProjectAnalyses, type AnalysisRole, type ProjectAnalysisRecord} from '../lib/project-research';
import {serializeProjectAnalysisSettings} from './project-analysis-settings';

type Project={id:string;title:string;kind:string;status:string;updated_at:string;metadata:Record<string,unknown>&{notes?:string;tasks?:{id:string;text:string;done:boolean}[];evidence?:ProjectEvidence[];analysisRecords?:ProjectAnalysisRecord[]}};
export default function AnalysisProjectLink({snapshot,ownerId}:{snapshot:ResearchSnapshot;ownerId:string|null}) {
 const requestedProject = useSearchParams().get('project');
 const [role,setRole]=useState<AnalysisRole>('exploratory');
 const [projects,setProjects]=useState<Project[]>([]),[selected,setSelected]=useState(''),[evidence,setEvidence]=useState(''),[interpretation,setInterpretation]=useState(''),[task,setTask]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[invalid,setInvalid]=useState(false);
 const controller=useRef<AbortController|null>(null),locked=useRef(false);
 useEffect(()=>{const request=new AbortController();controller.current=request;const changed=()=>{request.abort();setInvalid(true);setProjects([]);setSaved('');};window.addEventListener(authChangeEvent,changed);return()=>{request.abort();window.removeEventListener(authChangeEvent,changed);};},[ownerId]);
 async function read(){
   if(!ownerId||ownerId==='guest'||invalid)return;
   const response=await authFetch('/api/projects',{signal:controller.current?.signal});const payload=await response.json() as {projects?:Project[];error?:string};
   if(!response.ok)throw new Error(payload.error??'项目读取失败。');return payload.projects??[];
 }
 async function load(){setError('');try{const list=await read();if(!controller.current?.signal.aborted&&list){setProjects(list);setSelected(current=>current||(requestedProject===null?list[0]?.id??'':list.find(item=>item.id===requestedProject)?.id??''));if(requestedProject!==null&&!list.some(item=>item.id===requestedProject))setError('当前研究项目不可访问，请重新选择项目；未自动改用其他项目。');}}catch(cause){if(!controller.current?.signal.aborted)setError(cause instanceof Error?cause.message:'项目读取失败。');}}
 async function save(){
   if(locked.current||!ownerId||ownerId==='guest'||invalid)return;locked.current=true;setBusy(true);setError('');
   const signal=controller.current?.signal;
   try{
     if((await getCurrentUser())?.id!==ownerId||signal?.aborted)throw new Error('账户已变化，请重新打开快照。');
     const list=await read(),project=list?.find(item=>item.id===selected);
     if(!project)throw new Error('项目不存在或不可访问，请重新读取项目。');
     if(evidence&&!project.metadata.evidence?.some(entry=>entry.id===evidence))throw new Error('所选论文证据已被移除，请重新选择。');
     const existing=project.metadata.analysisRecords??[];
     if(!validateProjectAnalyses(existing))throw new Error('原分析台账格式异常，未覆盖记录。');
     const href=`/data?${new URLSearchParams({snapshot:snapshot.id})}#history`;
     if(existing.some(entry=>entry.snapshotId===snapshot.id)||(project.metadata.notes??'').includes(`](${href})`))throw new Error('此快照已关联到项目，请在项目中补充解释与任务。');
     const record:ProjectAnalysisRecord={id:snapshot.id,snapshotId:snapshot.id,name:snapshot.name,role,sample:snapshot.result.sample,method:snapshot.result.method,context:snapshot.result.context,settings:serializeProjectAnalysisSettings(snapshot.analysis),dataset:{name:snapshot.dataset.name,rows:snapshot.dataset.rows,fingerprint:snapshot.dataset.fingerprint,sourceFingerprint:snapshot.dataset.sourceFingerprint},metrics:snapshot.result.metrics.map(([key,value]):[string,string]=>[key,value]),interpretation:interpretation.trim(),evidenceIds:evidence?[evidence]:[],createdAt:snapshot.createdAt,registeredAt:new Date().toISOString()};
     if(!validateProjectAnalysis(record)||existing.length>=30)throw new Error('分析摘要或设置过长，或台账已达 30 条；请先导出并整理项目。完整快照仍保留在本机。');
     const name=snapshot.name.replace(/[[\]\r\n]/g,' ');
     const note=`[分析快照：${name}](${href})\n数据：${snapshot.dataset.name}；处理表指纹：${snapshot.dataset.fingerprint}\n方法：${snapshot.result.method}${evidence?`\n对应论文证据 ID：${evidence}`:''}\n解释：${interpretation.trim()}\n本机来源：此快照仅在当前浏览器与账户可用，换设备需导入快照备份。`;
     const tasks=project.metadata.tasks??[];
     if((await getCurrentUser())?.id!==ownerId||signal?.aborted)throw new Error('账户已变化，未保存。');
     const response=await authFetch(`/api/projects?id=${encodeURIComponent(project.id)}`,{method:'PATCH',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({...project,metadata:{...project.metadata,notes:[project.metadata.notes,note].filter(Boolean).join('\n\n'),analysisRecords:[...existing,record],tasks:task.trim()?[...tasks,{id:crypto.randomUUID(),text:task.trim(),done:false}]:tasks},expectedOwnerId:ownerId,expectedUpdatedAt:project.updated_at})});
     const body=await response.json() as {error?:string;project?:Project};
     if(signal?.aborted||(await getCurrentUser())?.id!==ownerId)return;
     if(!response.ok||!body.project)throw new Error(body.error??'项目刚有其他修改，未覆盖；请重试读取最新记录。');
     setSaved(project.id);
     window.dispatchEvent(new Event(projectsChangedEvent));
   }catch(cause){if(!signal?.aborted)setError(cause instanceof Error?cause.message:'关联失败，输入已保留。');}finally{locked.current=false;if(!signal?.aborted)setBusy(false);}
 }
 if(!ownerId||ownerId==='guest')return <p>登录后可以将本机快照摘要关联到当前账户的项目。</p>;
 return <details className={styles.recipe} onToggle={event=>{if(event.newState==='open'&&!projects.length&&!invalid)void load();}}><summary>关联快照到项目</summary>
  <p className={styles.help}>将模型设置、摘要、数据指纹与解释登记到项目分析台账，并保留笔记链接，可选添加下一步任务。登记摘要随项目保存；原文件、数据行和完整快照不上传。</p>
  <label className={styles.control}>分析用途<select aria-label="分析用途" disabled={busy||invalid} value={role} onChange={event=>setRole(event.target.value as AnalysisRole)}>{Object.entries(analysisRoles).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
  <label className={styles.control}>关联项目<select disabled={busy||invalid} value={selected} onChange={event=>{setSelected(event.target.value);setEvidence('');}}><option value="">选择项目</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
  <label className={styles.control}>对应论文证据（可选）<select disabled={busy||invalid} value={evidence} onChange={event=>setEvidence(event.target.value)}><option value="">暂不关联论文摘录</option>{projects.find(project=>project.id===selected)?.metadata.evidence?.map(entry=><option key={entry.id} value={entry.id}>{entry.paperTitle} · {entry.quote.slice(0,60)}</option>)}</select></label>
  <label className={styles.control}>分析解释<textarea aria-label="分析解释" disabled={busy||invalid} maxLength={4000} value={interpretation} onChange={event=>setInterpretation(event.target.value)}/></label>
  <label className={styles.control}>下一步任务（可选）<input disabled={busy||invalid} maxLength={500} value={task} onChange={event=>setTask(event.target.value)}/></label>
  <div className={styles.actions}><Button disabled={busy||invalid||!selected||!interpretation.trim()||Boolean(saved)} onClick={()=>void save()}>保存关联与下一步</Button><Button variant="ghost" disabled={busy||invalid} onClick={()=>void load()}>重新读取项目</Button></div>
  {invalid&&<p role="alert">账户已变化，请重新选择快照。</p>}{error&&<p role="alert">{error}</p>}{saved&&<p role="status">已加入项目笔记。<Link href={`/projects?project=${encodeURIComponent(saved)}`}>打开关联项目</Link></p>}
 </details>;
}
