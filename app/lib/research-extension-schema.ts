import {validateCausalGraph,twoGroupPower,requiredSampleSize,minimumDetectableEffect,adjustPValues} from './research-methods';
import {validateJoinPlan} from '../data/research-joins';
export type DesignRecord={title:string;estimand:string;population:string;timeOrder:string;assumptions:string;threats:string;protocolId:string;graph:Parameters<typeof validateCausalGraph>[0]};
export type PowerRecord={name:string;method:'two-independent-normal';alpha:number;effect:number;nPerGroup:number;targetPower:number;result:{power:number;nRequired:number;mde:number};protocolId:string;notes:string};
export type HypothesisFamily={name:string;method:'holm'|'bh'|'bonferroni';phase:'planned'|'evaluated';protocolId:string;hypotheses:Array<{id:string;label:string;runId:string;metric:string;p:number|null;adjusted:number|null}>;notes:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=4000)=>typeof v==='string'&&v.length<=max;
const req=(v:unknown,max=4000)=>text(v,max)&&Boolean((v as string).trim());
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
export function validateExtensionPayload(kind:string,p:unknown):boolean{
 if(!object(p))return false;
 try{
 if(kind==='design')return exact(p,['title','estimand','population','timeOrder','assumptions','threats','protocolId','graph'])&&req(p.title,200)&&['estimand','population','timeOrder','assumptions','threats'].every(k=>text(p[k]))&&text(p.protocolId,200)&&validateCausalGraph(p.graph);
 if(kind==='power'){
  if(!exact(p,['name','method','alpha','effect','nPerGroup','targetPower','result','protocolId','notes'])||!req(p.name,200)||p.method!=='two-independent-normal'||!['alpha','effect','nPerGroup','targetPower'].every(k=>finite(p[k]))||!text(p.protocolId,200)||!text(p.notes)||!object(p.result)||!exact(p.result,['power','nRequired','mde']))return false;
  const value=p as unknown as PowerRecord;return Math.abs(value.result.power-twoGroupPower(value.effect,value.alpha,value.nPerGroup))<1e-10&&value.result.nRequired===requiredSampleSize(value.effect,value.alpha,value.targetPower)&&Math.abs(value.result.mde-minimumDetectableEffect(value.nPerGroup,value.alpha,value.targetPower))<1e-10;
 }
 if(kind==='family'){
  if(!exact(p,['name','method','phase','protocolId','hypotheses','notes'])||!req(p.name,200)||typeof p.method!=='string'||!['holm','bh','bonferroni'].includes(p.method)||(typeof p.phase!=='string'||!['planned','evaluated'].includes(p.phase))||!text(p.protocolId,200)||!text(p.notes)||!Array.isArray(p.hypotheses)||p.hypotheses.length<1||p.hypotheses.length>100||!p.hypotheses.every(h=>object(h)&&exact(h,['id','label','runId','metric','p','adjusted'])&&req(h.id,200)&&req(h.label,300)&&text(h.runId,200)&&text(h.metric,300)&&(h.p===null||finite(h.p)&&Number(h.p)>=0&&Number(h.p)<=1)&&(h.adjusted===null||finite(h.adjusted)&&Number(h.adjusted)>=0&&Number(h.adjusted)<=1)))return false;
  const family=p as unknown as HypothesisFamily;if(new Set(family.hypotheses.map(h=>h.id)).size!==family.hypotheses.length)return false;
  if(family.phase==='planned')return family.hypotheses.every(h=>h.p===null&&h.adjusted===null);
  if(family.hypotheses.some(h=>h.p===null||h.adjusted===null))return false;const expected=adjustPValues(family.hypotheses.map(h=>({id:h.id,p:h.p!})),family.method);return expected.every((h,index)=>Math.abs(h.adjusted-family.hypotheses[index].adjusted!)<1e-12);
 }
 if(kind==='join')return exact(p,['format','version','name','createdAt','plan','left','right','output','audit'])&&p.format==='acaora-join-receipt'&&p.version===1&&req(p.name,500)&&text(p.createdAt,40)&&Number.isFinite(Date.parse(p.createdAt as string))&&validateJoinPlan(p.plan)&&['left','right','output'].every(k=>object(p[k])&&exact(p[k],['name','fingerprint','rows','columns'])&&req(p[k].name,500)&&hash(p[k].fingerprint)&&Number.isSafeInteger(p[k].rows)&&Number(p[k].rows)>=0&&Number(p[k].rows)<=100000&&Number.isSafeInteger(p[k].columns)&&Number(p[k].columns)>0&&Number(p[k].columns)<=2000)&&object(p.audit)&&exact(p.audit,['leftRows','rightRows','leftDuplicateKeys','rightDuplicateKeys','leftMissingKeys','rightMissingKeys','matchedLeft','unmatchedLeft','unmatchedRight','outputRows','issues'])&&Object.entries(p.audit).every(([k,v])=>k==='issues'?Array.isArray(v)&&v.every(item=>text(item)):Number.isSafeInteger(v)&&Number(v)>=0);
 if(kind==='execution')return exact(p,['name','runtime','scriptHash','requirementsHash','environmentHash','requestId','startedAt','elapsedMs','versions','dataFingerprint','settingsHash','snapshotId'])&&req(p.name,200)&&typeof p.runtime==='string'&&['python','r'].includes(p.runtime)&&hash(p.scriptHash)&&hash(p.environmentHash)&&hash(p.requirementsHash)&&text(p.requestId,200)&&text(p.startedAt,40)&&Number.isFinite(Date.parse(p.startedAt as string))&&finite(p.elapsedMs)&&Number(p.elapsedMs)>=0&&object(p.versions)&&Object.entries(p.versions).length<=30&&Object.entries(p.versions).every(([key,value])=>req(key,100)&&text(value,500))&&hash(p.dataFingerprint)&&hash(p.settingsHash)&&text(p.snapshotId,200);
 }catch{return false;}
 return false;
}
