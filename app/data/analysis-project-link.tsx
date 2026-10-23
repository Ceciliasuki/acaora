'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {authChangeEvent,authFetch,getCurrentUser} from '../lib/auth-client';
import {Button} from '../components/ui';
import type {ProjectEvidence} from '../lib/project-evidence';
import type {ResearchSnapshot} from './research-history';
import styles from './multiple-regression.module.css';

type Project={id:string;title:string;kind:string;status:string;updated_at:string;metadata:Record<string,unknown>&{notes?:string;tasks?:{id:string;text:string;done:boolean}[];evidence?:ProjectEvidence[]}};
export default function AnalysisProjectLink({snapshot,ownerId}:{snapshot:ResearchSnapshot;ownerId:string|null}) {
 const [projects,setProjects]=useState<Project[]>([]),[selected,setSelected]=useState(''),[evidence,setEvidence]=useState(''),[interpretation,setInterpretation]=useState(''),[task,setTask]=useState(''),[error,setError]=useState(''),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[invalid,setInvalid]=useState(false);
 const controller=useRef<AbortController|null>(null),locked=useRef(false);
 useEffect(()=>{const request=new AbortController();controller.current=request;const changed=()=>{request.abort();setInvalid(true);setProjects([]);setSaved('');};window.addEventListener(authChangeEvent,changed);return()=>{request.abort();window.removeEventListener(authChangeEvent,changed);};},[ownerId]);
 async function read(){
   if(!ownerId||ownerId==='guest'||invalid)return;
   const response=await authFetch('/api/projects',{signal:controller.current?.signal});const payload=await response.json() as {projects?:Project[];error?:string};
   if(!response.ok)throw new Error(payload.error??'项目读取失败。');return payload.projects??[];
 }
 async function load(){setError('');try{const list=await read();if(!controller.current?.signal.aborted&&list){setProjects(list);setSelected(current=>current||list[0]?.id||'');}}catch(cause){if(!controller.current?.signal.aborted)setError(cause instanceof Error?cause.message:'项目读取失败。');}}
 async function save(){
   if(locked.current||!ownerId||ownerId==='guest'||invalid)return;locked.current=true;setBusy(true);setError('');
   const signal=controller.current?.signal;
   try{
     if((await getCurrentUser())?.id!==ownerId||signal?.aborted)throw new Error('账户已变化，请重新打开快照。');
     const list=await read(),project=list?.find(item=>item.id===selected);
     if(!project)throw new Error('项目不存在或不可访问，请重新读取项目。');
     if(evidence&&!project.metadata.evidence?.some(entry=>entry.id===evidence))throw new Error('所选论文证据已被移除，请重新选择。');
     const href=`/data?${new URLSearchParams({snapshot:snapshot.id})}#history`;
     if((project.metadata.notes??'').includes(`](${href})`))throw new Error('此快照已关联到项目，请在项目中补充解释与任务。');
     const name=snapshot.name.replace(/[[\]\r\n]/g,' ');
     const note=`[分析快照：${name}](${href})\n数据：${snapshot.dataset.name}；处理表指纹：${snapshot.dataset.fingerprint}\n方法：${snapshot.result.method}${evidence?`\n对应论文证据 ID：${evidence}`:''}\n解释：${interpretation.trim()}\n本机来源：此快照仅在当前浏览器与账户可用，换设备需导入快照备份。`;
     const tasks=project.metadata.tasks??[];
     if((await getCurrentUser())?.id!==ownerId||signal?.aborted)throw new Error('账户已变化，未保存。');
     const response=await authFetch(`/api/projects?id=${encodeURIComponent(project.id)}`,{method:'PATCH',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({...project,metadata:{...project.metadata,notes:[project.metadata.notes,note].filter(Boolean).join('\n\n'),tasks:task.trim()?[...tasks,{id:crypto.randomUUID(),text:task.trim(),done:false}]:tasks},expectedOwnerId:ownerId,expectedUpdatedAt:project.updated_at})});
     const body=await response.json() as {error?:string;project?:Project};
     if(signal?.aborted||(await getCurrentUser())?.id!==ownerId)return;
     if(!response.ok||!body.project)throw new Error(body.error??'项目刚有其他修改，未覆盖；请重试读取最新记录。');
     setSaved(project.id);
   }catch(cause){if(!signal?.aborted)setError(cause instanceof Error?cause.message:'关联失败，输入已保留。');}finally{locked.current=false;if(!signal?.aborted)setBusy(false);}
 }
 if(!ownerId||ownerId==='guest')return <p>登录后可以将本机快照摘要关联到当前账户的项目。</p>;
 return <details className={styles.recipe} onToggle={event=>{if(event.newState==='open'&&!projects.length&&!invalid)void load();}}><summary>关联快照到项目</summary>
  <p className={styles.help}>将快照名称、数据指纹、解释与本机链接写入项目笔记，可选添加下一步任务。数据行和原文件不上传；快照不会因此云同步。</p>
  <label className={styles.control}>关联项目<select disabled={busy||invalid} value={selected} onChange={event=>{setSelected(event.target.value);setEvidence('');}}><option value="">选择项目</option>{projects.map(project=><option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
  <label className={styles.control}>对应论文证据（可选）<select disabled={busy||invalid} value={evidence} onChange={event=>setEvidence(event.target.value)}><option value="">暂不关联论文摘录</option>{projects.find(project=>project.id===selected)?.metadata.evidence?.map(entry=><option key={entry.id} value={entry.id}>{entry.paperTitle} · {entry.quote.slice(0,60)}</option>)}</select></label>
  <label className={styles.control}>分析解释<textarea aria-label="分析解释" disabled={busy||invalid} maxLength={4000} value={interpretation} onChange={event=>setInterpretation(event.target.value)}/></label>
  <label className={styles.control}>下一步任务（可选）<input disabled={busy||invalid} maxLength={500} value={task} onChange={event=>setTask(event.target.value)}/></label>
  <div className={styles.actions}><Button disabled={busy||invalid||!selected||!interpretation.trim()||Boolean(saved)} onClick={()=>void save()}>保存关联与下一步</Button><Button variant="ghost" disabled={busy||invalid} onClick={()=>void load()}>重新读取项目</Button></div>
  {invalid&&<p role="alert">账户已变化，请重新选择快照。</p>}{error&&<p role="alert">{error}</p>}{saved&&<p role="status">已加入项目笔记。<Link href={`/projects?project=${encodeURIComponent(saved)}`}>打开关联项目</Link></p>}
 </details>;
}
