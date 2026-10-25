import {researchHash,type VerificationRecord} from './research-ledger';
export type ExecutionIdentity={engine:string;settingsHash:string;dataFingerprint:string;sourceFingerprint:string};
export type ResearchBaseline={format:'acaora-execution-baseline';version:1;identity:ExecutionIdentity;metrics:Array<[string,number|null]>;environment:Record<string,string>;capturedAt:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateResearchBaseline(v:unknown):v is ResearchBaseline {
 if(!object(v)||v.format!=='acaora-execution-baseline'||v.version!==1||!object(v.identity)||!['engine','settingsHash','dataFingerprint','sourceFingerprint'].every(k=>typeof v.identity==='object'&&v.identity!==null&&typeof (v.identity as Record<string,unknown>)[k]==='string'))return false;
 const i=v.identity as Record<string,string>;return /^acaora-(stats|ols|advanced)-v\d+$/.test(i.engine)&&[i.settingsHash,i.dataFingerprint,i.sourceFingerprint].every(x=>/^[a-f0-9]{64}$/.test(x))&&Array.isArray(v.metrics)&&v.metrics.length<=2000&&v.metrics.every(m=>Array.isArray(m)&&m.length===2&&typeof m[0]==='string'&&(m[1]===null||typeof m[1]==='number'&&Number.isFinite(m[1])))&&new Set(v.metrics.map(m=>m[0])).size===v.metrics.length&&object(v.environment)&&Object.values(v.environment).every(x=>typeof x==='string')&&typeof v.capturedAt==='string'&&Number.isFinite(Date.parse(v.capturedAt));
}
export async function makeExecutionIdentity(analysis:{kind:string;config:unknown},engine:string,dataFingerprint:string,sourceFingerprint:string):Promise<ExecutionIdentity>{return {engine,settingsHash:await researchHash({kind:analysis.kind,config:analysis.config}),dataFingerprint,sourceFingerprint};}
export function verifyExecution(baseline:ResearchBaseline|undefined,current:{identity:ExecutionIdentity;metrics:Array<[string,number|null]>;environment:Record<string,string>},snapshotId:string,runtime:VerificationRecord['runtime'],relativeTolerance=1e-7,absoluteTolerance=1e-9):VerificationRecord{
 const base:VerificationRecord={name:`${runtime==='browser'?'浏览器重跑':runtime==='python'?'Python 结果':'R 结果'}核验`,snapshotId,runtime,status:'not-verifiable',...current.identity,environment:current.environment,comparisons:[],notes:'',createdAt:new Date().toISOString()};
 if(!baseline||!validateResearchBaseline(baseline)){base.notes='历史快照没有完整精度基线，不能据舍入的显示值判定通过。请重新运行并保存带核验基线的快照。';return base;}
 if(!Number.isFinite(relativeTolerance)||!Number.isFinite(absoluteTolerance)||relativeTolerance<0||relativeTolerance>0.01||absoluteTolerance<0||absoluteTolerance>0.01){base.notes='容差无效；未作数值判定。';return base;}
 const mismatches=(Object.keys(baseline.identity) as Array<keyof ExecutionIdentity>).filter(k=>baseline.identity[k]!==current.identity[k]);
 if(mismatches.length){base.status='fail';base.notes=`身份不一致：${mismatches.join('、')}。没有将其他数据或模型的结果视为复现。`;return base;}
 const metrics=new Map(current.metrics);if(metrics.size!==current.metrics.length){base.notes='结果指标名重复，无法可靠匹配。';return base;}
 if(baseline.metrics.some(([name])=>!metrics.has(name))){base.notes='运行结果未覆盖基线全部指标；保留原始结果，不判定部分通过为完整通过。';return base;}
 if(!baseline.metrics.length){base.notes='基线没有可比较指标。';return base;}
 base.comparisons=baseline.metrics.map(([name,expected])=>{const actual=metrics.get(name)??null,tolerance=expected===null?absoluteTolerance:absoluteTolerance+relativeTolerance*Math.abs(expected);return {name,expected,actual,tolerance,pass:expected===null?actual===null:actual!==null&&Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance};});
 base.status=base.comparisons.every(c=>c.pass)?'pass':'fail';base.notes=`比较完整精度指标，绝对容差 ${absoluteTolerance}、相对容差 ${relativeTolerance}。${runtime==='browser'?'使用同一浏览器计算引擎重跑。':'文件由研究者提供；核验数据与设置标识及数值，不证明外部运行环境可信。原表指纹为清单声明，外部脚本校验的是实际处理表。'}`;return base;
}
export function externalExecutionMetrics(value:unknown,analysis:{kind:string;config:unknown}):Array<[string,number|null]>|null{
 if(!object(value)||!object(analysis.config))return null;
 if(Object.hasOwn(value,'verificationMetrics')&&(!Array.isArray(value.verificationMetrics)||!value.verificationMetrics.every(m=>Array.isArray(m)&&m.length===2&&typeof m[0]==='string'&&(m[1]===null||typeof m[1]==='number'&&Number.isFinite(m[1])))))return null;
 if(Array.isArray(value.verificationMetrics)&&value.verificationMetrics.length<=2000&&value.verificationMetrics.every(m=>Array.isArray(m)&&m.length===2&&typeof m[0]==='string'&&(m[1]===null||typeof m[1]==='number'&&Number.isFinite(m[1]))))return value.verificationMetrics as Array<[string,number|null]>;
 const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
 if(analysis.kind==='advanced'&&analysis.config.method==='paired'){
  if(['n','excluded','estimate','se','t','p','df','low','high'].some(key=>typeof value[key]!=='number'||!Number.isFinite(value[key]))||Number(value.n)<3||Number(value.se)<=0)return null;
  const n=Number(value.n),sd=Number(value.se)*Math.sqrt(n);
  return [['n',n],['excluded',Number(value.excluded)],['平均差（第一列−第二列）',Number(value.estimate)],['差值标准差',sd],['t',Number(value.t)],['自由度',Number(value.df)],['双侧 p',Number(value.p)],['95% 下限',Number(value.low)],['95% 上限',Number(value.high)],['配对效应量 dz',Number(value.estimate)/sd]];
 }
 if(analysis.kind==='basic'){
  const method=analysis.config.method;
  const keys=method==='describe'?['n','mean','sd','min','median','max']:method==='relation'?['n','r','p','slope','intercept','r2','t']:null;
  if(!keys||keys.some(k=>!Object.hasOwn(value,k)))return null;return keys.map(k=>[k,number(value[k])]);
 }
 if(analysis.kind==='ols'&&Array.isArray(value.coefficients)){
  const keys=['n','r2','adjustedR2','rmse'];if(keys.some(k=>!Object.hasOwn(value,k)))return null;
  const metrics:Array<[string,number|null]>=keys.map(k=>[k,number(value[k])]);
  for(const row of value.coefficients){if(!object(row)||typeof row.name!=='string')return null;for(const key of ['estimate','se','t','p','low','high','vif']){if(!Object.hasOwn(row,key))return null;metrics.push([`coef:${row.name}:${key}`,number(row[key])]);}}
  return metrics;
 }
 return null;
}
