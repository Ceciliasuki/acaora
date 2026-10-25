import {canonicalJson,currentLedger,researchHash,type LedgerEvent} from './research-ledger';
import type {ResearchExportProject} from './project-research';

import {referenceKinds,type ResearchReference,type ReferenceKind,type DependencyRecord,type ResultBlock,type ConnectionState} from './research-connection-schema';
export * from './research-connection-schema';
const projection=(kind:string,p:Record<string,unknown>):unknown=>kind==='dataset'?{sourceFingerprint:p.sourceFingerprint,versions:p.versions,dictionary:p.dictionary??[]}:kind==='dictionary'?p.dictionary??[]:p;
/** Hash only meaningful research content. Names and access times do not invalidate data calculations. */
export async function projectReferences(project:ResearchExportProject,events:LedgerEvent[]):Promise<ResearchReference[]>{
 const refs:ResearchReference[]=[];
 const add=async(kind:ReferenceKind,id:string,label:string,revision:number,value:unknown)=>refs.push({kind,id,label,revision,fingerprint:await researchHash(value)});
 if(project.metadata.research){await add('protocol','current','当前已保存设计',0,project.metadata.research.protocol);for(const finding of project.metadata.research.findings)if(!finding.withdrawn)await add('finding',finding.id,finding.statement.slice(0,100),0,finding);}
 for(const analysis of project.metadata.analysisRecords??[])await add('analysis',analysis.id,analysis.name,0,analysis);
 for(const evidence of project.metadata.evidence??[])await add('evidence',evidence.id,evidence.paperTitle,0,evidence);
 for(const event of currentLedger(events))if(!event.archived&&referenceKinds.includes(event.collection as ReferenceKind)){
  await add(event.collection as ReferenceKind,event.entity_id,String(event.payload.name??event.payload.title??event.collection),event.revision,projection(event.collection,event.payload));
  if(event.collection==='dataset')await add('dictionary',event.entity_id,`${String(event.payload.name)} · 变量定义`,event.revision,projection('dictionary',event.payload));
 }
 return refs;
}
export const referenceKey=(ref:Pick<ResearchReference,'kind'|'id'>)=>`${ref.kind}:${ref.id}`;
/** Historical baselines are inferred only from recorded versions that existed when the run was saved. */
export async function automaticDependencies(project:ResearchExportProject,events:LedgerEvent[]):Promise<DependencyRecord[]>{
 const dependencies:DependencyRecord[]=[];
 for(const event of currentLedger(events).filter(e=>e.collection==='run'&&!e.archived)){
  let settings:Record<string,unknown>={};try{settings=JSON.parse(String(event.payload.settings));}catch{/* Legacy runs may not contain a recoverable configuration. */}
  let sources:ResearchReference[]=[];
  if(Array.isArray(settings.references)&&settings.references.every(ref=>!!ref&&typeof ref==='object'&&typeof ref.fingerprint==='string'))sources=settings.references as ResearchReference[];
  else{
   const historical=events.filter(e=>Date.parse(e.created_at)<=Date.parse(event.created_at)&&((e.collection==='specification'&&e.entity_id===event.payload.specificationId&&(settings.specRevision===undefined||e.revision===settings.specRevision))||(e.collection==='dataset'&&(e.payload.sourceFingerprint===event.payload.sourceFingerprint||(e.payload.versions as {fingerprint:string}[]).some(v=>v.fingerprint===event.payload.dataFingerprint)))||(e.collection==='protocol'&&e.entity_id===event.payload.protocolId)));
   sources=await projectReferences({...project,metadata:{}},historical);
  }
  if(sources.length)dependencies.push({name:String(event.payload.name),target:{kind:'run',id:event.entity_id},sources,note:'来源于运行时保存的版本与配置',confirmedAt:event.created_at});
 }
 return dependencies;
}
export function assessConnections(dependencies:DependencyRecord[],references:ResearchReference[],writing:Array<ResultBlock&{id?:string}>=[]):ConnectionState[]{
 const current=new Map(references.map(ref=>[referenceKey(ref),ref]));
 const graph=new Map<string,ResearchReference[]>();for(const dependency of dependencies){const key=referenceKey(dependency.target);graph.set(key,[...(graph.get(key)??[]),...dependency.sources]);}for(const block of writing)graph.set(`writing:${block.id??`${block.runId}:${block.title}`}`,block.references);
 const states=new Map<string,ConnectionState>(),visiting=new Set<string>();
 function visit(key:string):ConnectionState{const saved=states.get(key);if(saved)return saved;if(visiting.has(key))return {key,status:'stale',reasons:['依赖关系存在循环，请先修正关联。']};visiting.add(key);const sources=graph.get(key),state:ConnectionState={key,status:sources?'current':'untracked',reasons:[]};
  for(const source of sources??[]){const sourceKey=referenceKey(source),now=current.get(sourceKey);if(!now){state.status='missing';state.reasons.push(`${source.label} 已移除或归档。`);}else if(now.fingerprint!==source.fingerprint){if(state.status!=='missing')state.status='stale';state.reasons.push(`${source.label} 内容已更新（绑定 v${source.revision}，当前 v${now.revision}）。`);}if(graph.has(sourceKey)){const upstream=visit(sourceKey);if(['stale','missing'].includes(upstream.status)){if(state.status!=='missing')state.status='stale';state.reasons.push(`${source.label} 的上游材料需要核验。`);}}}
  visiting.delete(key);states.set(key,state);return state;
 }
 for(const key of graph.keys())visit(key);return [...states.values()];
}
export function renderResultBlock(block:ResultBlock){return [block.lead,...block.metrics.map(metric=>{const numeric=metric.value.trim()!==''&&metric.value!=='null'?Number(metric.value):NaN;const threshold=10**-metric.decimals,pValue=/(^|[:_ ])p(?:value)?$/i.test(metric.key);const value=Number.isFinite(numeric)?pValue&&numeric>0&&numeric<threshold?`<${threshold.toFixed(metric.decimals)}`:numeric.toFixed(metric.decimals):metric.value==='null'?'无法估计':metric.value;return `${metric.label}${value.startsWith('<')?' ':' = '}${value}${metric.unit?` ${metric.unit}`:''}`;}),block.conclusion].filter(Boolean).join('；');}
export function connectionFingerprint(value:unknown){return canonicalJson(value);}
