const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
export const referenceKinds=['protocol','dataset','dictionary','specification','run','analysis','evidence','finding','writing','verification','design','power','family','join','execution'] as const;
export type ReferenceKind=typeof referenceKinds[number];
export type ResearchReference={kind:ReferenceKind;id:string;label:string;revision:number;fingerprint:string};
export type DependencyRecord={name:string;target:{kind:ReferenceKind;id:string};sources:ResearchReference[];note:string;confirmedAt:string};
export type AssetReference={kind:'figure'|'table';analysisId:string;snapshotId:string;index:number;label:string;fingerprint:string};
export type ResultBlock={title:string;lead:string;conclusion:string;runId:string;metrics:Array<{key:string;label:string;decimals:number;unit:string;value:string}>;references:ResearchReference[];citations:string[];assets?:AssetReference[];confirmedAt:string};
export type ConnectionState={key:string;status:'current'|'stale'|'missing'|'untracked';reasons:string[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:unknown,max=4000)=>typeof v==='string'&&v.length<=max;
const required=(v:unknown,max=4000)=>str(v,max)&&Boolean((v as string).trim());
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
export function validReference(v:unknown):v is ResearchReference{return object(v)&&exact(v,['kind','id','label','revision','fingerprint'])&&referenceKinds.includes(v.kind as ReferenceKind)&&required(v.id,200)&&str(v.label,500)&&Number.isSafeInteger(v.revision)&&Number(v.revision)>=0&&hash(v.fingerprint);}
export function validateConnectionPayload(kind:string,p:unknown):boolean{
 if(!object(p))return false;
 if(kind==='dependency')return exact(p,['name','target','sources','note','confirmedAt'])&&required(p.name,200)&&object(p.target)&&exact(p.target,['kind','id'])&&referenceKinds.includes(p.target.kind as ReferenceKind)&&required(p.target.id,200)&&Array.isArray(p.sources)&&p.sources.length>0&&p.sources.length<=100&&p.sources.every(validReference)&&new Set(p.sources.map(ref=>`${ref.kind}:${ref.id}`)).size===p.sources.length&&!p.sources.some(ref=>ref.kind===(p.target as Record<string,unknown>).kind&&ref.id===(p.target as Record<string,unknown>).id)&&str(p.note)&&str(p.confirmedAt,40)&&Number.isFinite(Date.parse(p.confirmedAt as string));
 if(kind==='writing')return (exact(p,['title','lead','conclusion','runId','metrics','references','citations','confirmedAt'])||exact(p,['title','lead','conclusion','runId','metrics','references','citations','assets','confirmedAt'])&&Array.isArray(p.assets)&&p.assets.length<=30&&p.assets.every(a=>object(a)&&exact(a,['kind','analysisId','snapshotId','index','label','fingerprint'])&&(a.kind==='figure'||a.kind==='table')&&required(a.analysisId,200)&&required(a.snapshotId,200)&&Number.isSafeInteger(a.index)&&Number(a.index)>=0&&Number(a.index)<=100&&str(a.label,300)&&hash(a.fingerprint)))&&required(p.title,300)&&str(p.lead)&&str(p.conclusion)&&uuid(p.runId)&&Array.isArray(p.metrics)&&p.metrics.length>0&&p.metrics.length<=40&&p.metrics.every(m=>object(m)&&exact(m,['key','label','decimals','unit','value'])&&required(m.key,300)&&required(m.label,300)&&Number.isSafeInteger(m.decimals)&&Number(m.decimals)>=0&&Number(m.decimals)<=12&&str(m.unit,100)&&str(m.value,1000))&&Array.isArray(p.references)&&p.references.length>0&&p.references.length<=100&&p.references.every(validReference)&&p.references.some(ref=>ref.kind==='run'&&ref.id===p.runId)&&Array.isArray(p.citations)&&p.citations.length<=30&&p.citations.every(id=>required(id,200))&&str(p.confirmedAt,40)&&Number.isFinite(Date.parse(p.confirmedAt as string));
 return false;
}
