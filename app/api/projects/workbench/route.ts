import {NextRequest,NextResponse} from 'next/server';
import {authError,privateNoStore,readRequestSession,supabaseRest} from '../../auth/_shared';
import {createProjectBackup,ledgerKinds,parseProjectBackup,uuid,validateLedgerEvent,validateLedgerPayload,type BackupProject,type LedgerEvent,type LedgerKind} from '../../../lib/research-ledger';
import {validateProjectAnalyses,validateResearchDossier} from '../../../lib/project-research';
import {validateProjectEvidence} from '../../../lib/project-evidence';
import {projectReferences,referenceKey,type ResearchReference} from '../../../lib/research-connections';
import type {ResearchExportProject} from '../../../lib/project-research';

const json=(value:unknown,status=200)=>privateNoStore(NextResponse.json(value,{status}));
async function failed(response:Response){const body=await response.json().catch(()=>({})) as {message?:string;code?:string};const message=body.message??'';
 if(message.includes('PHASE_CONFLICT'))return json({error:'项目已有分析记录，不能将这次冻结标为首次分析前计划。请选择分析后或方案修订。'},409);
 if(message.includes('IMPORT_OPERATION_CONFLICT'))return json({error:'此恢复操作已用于另一份内容或名称。输入保留；若确需另建副本，请明确选择新的恢复操作。'},409);
 if(message.includes('REVISION_CONFLICT')||message.includes('PROJECT_VERSION_CONFLICT')||body.code==='40001')return json({error:'研究记录已有更新。输入保留，请重新读取并比较后再保存。'},409);
 if(message.includes('CAPACITY'))return json({error:'研究记录已达项目容量限制，请先导出归档，未删除历史。'},413);
 if(message.includes('IMPORT_TARGET_DELETED'))return json({error:'此备份的恢复副本已被删除，重试不会重新创建。要另建副本请明确选择新的恢复操作。'},409);
 if(message.includes('SAVE_RESEARCH_FIRST'))return json({error:'请先保存当前研究设计，再冻结为方案版本。'},409);
 if(body.code==='42501'||message.includes('UNAVAILABLE'))return json({error:'项目不存在或当前账户不可访问。'},404);
 if(body.code==='PGRST202'||body.code==='42P01')return json({error:'研究记录服务尚未就绪；原项目和笔记仍保留。'},503);
 return json({error:'研究记录暂时无法保存或读取。输入保留，请稍后重试。'},503);
}
export async function GET(request:NextRequest){try{
 const session=await readRequestSession();if(!session)return json({error:'请登录后读取研究记录。'},401);
 const projectId=request.nextUrl.searchParams.get('project');if(!uuid(projectId))return json({error:'项目标识不正确。'},400);
 const response=await supabaseRest('rpc/export_research_project',session.accessToken,{method:'POST',body:JSON.stringify({p_project_id:projectId})});
 if(!response.ok)return failed(response);
 const data=await response.json() as {project:BackupProject;events:LedgerEvent[]};
 if(!data||!data.project||!Array.isArray(data.events)||!data.events.every(validateLedgerEvent))return json({error:'研究记录含不受支持的格式。原件未改写，请保留项目并排查版本。'},422);
 if(request.nextUrl.searchParams.get('mode')==='backup')return json(await createProjectBackup(data.project,data.events));
 return json(data);
}catch(error){return authError(error);}}
export async function PATCH(request:NextRequest){try{
 const session=await readRequestSession();if(!session)return json({error:'请登录后恢复方案。'},401);
 const raw=await request.text();if(raw.length>12000)return json({error:'恢复说明过长。'},413);
 let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return json({error:'恢复请求不是有效 JSON。'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['projectId','entityId','operationId','projectUpdatedAt','reason','expectedOwnerId'].includes(k)))return json({error:'恢复请求格式无效。'},400);
 if(body.expectedOwnerId!==session.user.id)return json({error:'账户已变化，未恢复方案。'},409);
 if(!uuid(body.projectId)||!uuid(body.entityId)||!uuid(body.operationId)||typeof body.projectUpdatedAt!=='string'||!Number.isFinite(Date.parse(body.projectUpdatedAt))||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>2000)return json({error:'恢复目标、版本或说明不完整。'},400);
 const response=await supabaseRest('rpc/restore_research_protocol',session.accessToken,{method:'POST',body:JSON.stringify({p_project_id:body.projectId,p_entity_id:body.entityId,p_operation_id:body.operationId,p_expected_updated_at:body.projectUpdatedAt,p_reason:body.reason.trim()})});if(!response.ok)return failed(response);return json(await response.json());
}catch(error){return authError(error);}}
export async function POST(request:NextRequest){try{
 const session=await readRequestSession();if(!session)return json({error:'请登录后保存研究记录。'},401);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>300000)return json({error:'单条研究记录过长。'},413);
 let body:Record<string,unknown>;try{body=JSON.parse(raw);}catch{return json({error:'不是有效的记录 JSON。'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['projectId','kind','entityId','expectedRevision','payload','archived','expectedOwnerId','projectUpdatedAt'].includes(k)))return json({error:'记录包含未知字段。'},400);
 if(body.expectedOwnerId!==session.user.id)return json({error:'账户已变化，未保存。'},409);
 if(!uuid(body.projectId)||!uuid(body.entityId)||typeof body.kind!=='string'||!Object.hasOwn(ledgerKinds,body.kind)||!Number.isSafeInteger(body.expectedRevision)||Number(body.expectedRevision)<0||typeof body.archived!=='boolean'||!validateLedgerPayload(body.kind as LedgerKind,body.payload))return json({error:'研究记录格式或支撑信息不完整，未写入。'},400);
 if(body.kind==='protocol'&&(typeof body.projectUpdatedAt!=='string'||!Number.isFinite(Date.parse(body.projectUpdatedAt))))return json({error:'方案冻结需要当前项目版本。'},400);
 let resource='rpc/save_research_record',args:Record<string,unknown>={p_project_id:body.projectId,p_collection:body.kind,p_entity_id:body.entityId,p_expected_revision:body.expectedRevision,p_payload:body.payload,p_archived:body.archived,p_project_updated_at:body.kind==='protocol'?body.projectUpdatedAt:null};
 if(['dependency','writing','family'].includes(body.kind)){
  const exportResponse=await supabaseRest('rpc/export_research_project',session.accessToken,{method:'POST',body:JSON.stringify({p_project_id:body.projectId})});if(!exportResponse.ok)return failed(exportResponse);
  const bundle=await exportResponse.json() as {project:ResearchExportProject;events:LedgerEvent[]};if(!bundle.project||!Array.isArray(bundle.events)||!bundle.events.every(validateLedgerEvent))return json({error:'来源记录无法核对，未保存不完整引用。'},422);
  const payload=body.payload as Record<string,unknown>,refs=await projectReferences(bundle.project,bundle.events),current=new Map(refs.map(ref=>[referenceKey(ref),ref]));
  const binding=(body.kind==='dependency'?payload.sources:body.kind==='writing'?payload.references:[]) as ResearchReference[];
  if(body.kind==='writing'){
   if((payload.citations as string[]).some(id=>!bundle.events.some(event=>event.collection==='literature'&&event.entity_id===id&&!event.archived&&event.revision===Math.max(...bundle.events.filter(item=>item.entity_id===id).map(item=>item.revision))&&event.payload.decision==='include'&&(event.payload.bibliography as {confirmed?:boolean}).confirmed)))return json({error:'引用文献尚未确认或已移除，请重新核对。'},409);
   if(((payload.assets??[]) as {analysisId:string;snapshotId:string}[]).some(asset=>!bundle.project.metadata.analysisRecords?.some(record=>record.id===asset.analysisId&&record.snapshotId===asset.snapshotId)||!binding.some(ref=>ref.kind==='analysis'&&ref.id===asset.analysisId)))return json({error:'图表必须绑定本项目已登记的分析与快照。'},400);
  }
  if(body.kind==='dependency'&&!current.has(referenceKey(payload.target as {kind:ResearchReference['kind'];id:string})))return json({error:'依赖目标已不存在，请刷新后重新选择。'},409);
  for(const ref of binding){if(current.get(referenceKey(ref))?.fingerprint===ref.fingerprint)continue;const historical=bundle.events.find(event=>event.entity_id===ref.id&&event.collection===(ref.kind==='dictionary'?'dataset':ref.kind)&&event.revision===ref.revision);if(!historical)return json({error:'引用来源已有变化或不可用，请刷新并比较后重新确认。'},409);const historicalRefs=await projectReferences({id:bundle.project.id,title:bundle.project.title,updated_at:bundle.project.updated_at,metadata:{}},[historical]);const resolved=historicalRefs.find(item=>referenceKey(item)===referenceKey(ref));if(resolved?.fingerprint!==ref.fingerprint)return json({error:'引用的来源指纹不符，请核对原记录。'},409);}
  if(body.kind==='writing'){const run=bundle.events.find(event=>event.entity_id===payload.runId&&event.collection==='run');if(!run||run.payload.status!=='success')return json({error:'正文只能引用已成功登记的运行。'},400);const saved=run.payload.metrics as [string,string][];if((payload.metrics as {key:string;value:string}[]).some(metric=>!saved.some(([key,value])=>key===metric.key&&value===metric.value)))return json({error:'正文引用值与原始运行不符；请刷新指标后再确认。'},400);}
  if(body.kind==='family'&&payload.phase==='evaluated')for(const hypothesis of payload.hypotheses as {runId:string;metric:string;p:number}[]){const run=bundle.events.find(event=>event.collection==='run'&&event.entity_id===hypothesis.runId);if(hypothesis.runId&&(!run||run.payload.status!=='success'||!(run.payload.metrics as [string,string][]).some(([key,value])=>key===hypothesis.metric&&value.trim()!==''&&Number(value)===hypothesis.p)))return json({error:'假设族的 p 值与所引用运行不符，未保存。'},400);}
  resource='rpc/save_research_connected_record';args={p_project_id:body.projectId,p_collection:body.kind,p_entity_id:body.entityId,p_expected_revision:body.expectedRevision,p_payload:body.payload,p_archived:body.archived,p_expected_sequence:Math.max(0,...bundle.events.map(event=>event.sequence)),p_expected_updated_at:bundle.project.updated_at};
 }
 const response=await supabaseRest(resource,session.accessToken,{method:'POST',body:JSON.stringify(args)});
 if(!response.ok)return failed(response);const event=await response.json();if(!validateLedgerEvent(event))return json({error:'保存响应无法确认，请重新读取；不要重复建立新条目。'},502);return json({event});
}catch(error){return authError(error);}}
export async function PUT(request:NextRequest){try{
 const session=await readRequestSession();if(!session)return json({error:'请登录后恢复项目。'},401);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>21*1024*1024)return json({error:'备份超过恢复大小限制。'},413);
 let body:{backup?:unknown;importId?:unknown;title?:unknown;expectedOwnerId?:unknown};try{body=JSON.parse(raw);}catch{return json({error:'备份请求不是有效 JSON。'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['backup','importId','title','expectedOwnerId'].includes(k)))return json({error:'备份请求格式无效。'},400);
 if(body.expectedOwnerId!==session.user.id)return json({error:'账户已变化，请重新选择备份。'},409);
 if(!uuid(body.importId)||typeof body.title!=='string'||!body.title.trim()||body.title.length>120)return json({error:'恢复名称或操作标识无效。'},400);
 let backup;try{backup=await parseProjectBackup(JSON.stringify(body.backup));}catch(error){return json({error:error instanceof Error?error.message:'备份校验失败。'},400);}
 const metadata=backup.project.metadata;
 if(JSON.stringify(metadata).length>120000||metadata.research!==undefined&&!validateResearchDossier(metadata.research)||metadata.analysisRecords!==undefined&&!validateProjectAnalyses(metadata.analysisRecords)||metadata.evidence!==undefined&&(!Array.isArray(metadata.evidence)||metadata.evidence.length>200||!metadata.evidence.every(validateProjectEvidence)))return json({error:'备份中的项目主体格式不受支持，未创建不完整副本。'},400);
 const response=await supabaseRest('rpc/restore_research_project',session.accessToken,{method:'POST',body:JSON.stringify({p_import_id:body.importId,p_title:body.title.trim(),p_kind:backup.project.kind,p_status:backup.project.status,p_metadata:metadata,p_events:backup.events})});
 if(!response.ok)return failed(response);return json(await response.json());
}catch(error){return authError(error);}}
