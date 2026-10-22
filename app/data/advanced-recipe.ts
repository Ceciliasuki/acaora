import {numericColumns,type DataSet} from '../stats';
import {ADVANCED_ENGINE,advancedMethods,requiredColumns,usesGroup,type AdvancedConfig} from './advanced-config';
import {validCategories,categoryLevels} from './categorical-design';
export type AdvancedRecipe={format:'acaora-advanced-recipe';version:1;engine:typeof ADVANCED_ENGINE|'acaora-advanced-v3'|'acaora-advanced-v2';missingPolicy:'complete-required-fields';config:AdvancedConfig;dataset:{fingerprint:string;headers:string[];rows:number};createdAt:string};
const field=(v:unknown):v is string=>typeof v==='string'&&v.length<=500&&!Array.from(v).some(c=>c.charCodeAt(0)<32);
export function validAdvancedConfig(v:unknown):v is AdvancedConfig{
  if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as Record<string,unknown>,keys=['method','outcome','predictors','group','second','components','clusters','folds','seed','validation','time','categoricals','posthocFamily','posthocReference','threshold','bootstrapStatistic','bootstrapUnit','bootstrapCluster','bootstrapIterations'];
  if(Object.keys(c).some(k=>!keys.includes(k))||keys.slice(0,9).some(k=>!Object.hasOwn(c,k)))return false;
  if(!advancedMethods.some(m=>m.id===c.method)||!['outcome','group','second'].every(k=>field(c[k]))||!Array.isArray(c.predictors)||c.predictors.length>12||c.predictors.some(h=>!field(h)||!h.trim())||new Set(c.predictors).size!==c.predictors.length)return false;
  if(!Number.isInteger(c.components)||Number(c.components)<1||Number(c.components)>12||!Number.isInteger(c.clusters)||Number(c.clusters)<2||Number(c.clusters)>12||!Number.isInteger(c.folds)||Number(c.folds)<2||Number(c.folds)>10||!Number.isInteger(c.seed)||Number(c.seed)<0||Number(c.seed)>4294967295)return false;
  if(c.validation!==undefined&&!['random','group','time'].includes(String(c.validation)))return false;if(c.time!==undefined&&!field(c.time))return false;
  if(!validCategories(c.categoricals??[])||((c.categoricals as unknown[]|undefined)?.length&&!['cluster','fixed','logistic','cv','classification'].includes(String(c.method))))return false;
  if(c.posthocFamily!==undefined&&!['all','reference'].includes(String(c.posthocFamily)))return false;if(c.posthocReference!==undefined&&!field(c.posthocReference))return false;
  if(c.threshold!==undefined&&(typeof c.threshold!=='number'||!Number.isFinite(c.threshold)||c.threshold<0||c.threshold>1))return false;
  if(c.bootstrapStatistic!==undefined&&!['mean','paired-difference','difference','correlation'].includes(String(c.bootstrapStatistic)))return false;
  if(c.bootstrapUnit!==undefined&&!['row','cluster'].includes(String(c.bootstrapUnit)))return false;
  if(c.bootstrapCluster!==undefined&&!field(c.bootstrapCluster))return false;
  if(c.bootstrapIterations!==undefined&&(!Number.isInteger(c.bootstrapIterations)||Number(c.bootstrapIterations)<100||Number(c.bootstrapIterations)>2000))return false;
  const config=c as AdvancedConfig,required=requiredColumns(config);return required.length>0&&required.every(h=>field(h)&&h.trim().length>0)&&new Set(required).size===required.length&&(!['cluster','fixed','logistic','pca','kmeans','cv','classification'].includes(config.method)||config.predictors.length+(config.categoricals?.length??0)>0)&&(config.method!=='pca'||(config.predictors.length>=2&&config.components<=config.predictors.length))&&(config.method!=='posthoc'||config.posthocFamily!=='reference'||Boolean(config.posthocReference?.trim()));
}
export function parseAdvancedRecipe(text:string):AdvancedRecipe{
  if(new TextEncoder().encode(text).length>256*1024)throw new Error('进阶方案超过 256 KB。');
  let v:unknown;try{v=JSON.parse(text);}catch{throw new Error('方案不是有效 JSON。');}
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('进阶方案格式不正确。');const r=v as AdvancedRecipe;
  const keys=['format','version','engine','missingPolicy','config','dataset','createdAt'];
  if(Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k))||r.format!=='acaora-advanced-recipe'||r.version!==1||![ADVANCED_ENGINE,'acaora-advanced-v3','acaora-advanced-v2'].includes(r.engine)||(r.engine!==ADVANCED_ENGINE&&['classification','bootstrap'].includes(r.config?.method))||r.missingPolicy!=='complete-required-fields'||!validAdvancedConfig(r.config)||(r.engine==='acaora-advanced-v2'&&(r.config.categoricals?.length||r.config.method==='posthoc')))throw new Error('不是受支持的进阶方案；分析记录或不兼容引擎文件不能直接作为本方案载入。');
  const d=r.dataset;if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).length!==3||typeof d.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(d.fingerprint)||!Array.isArray(d.headers)||d.headers.length<2||d.headers.length>2000||d.headers.some(h=>!field(h)||!h.trim())||new Set(d.headers).size!==d.headers.length||!requiredColumns(r.config).every(h=>d.headers.includes(h))||!Number.isSafeInteger(d.rows)||d.rows<1||typeof r.createdAt!=='string'||r.createdAt.length>40||!Number.isFinite(Date.parse(r.createdAt)))throw new Error('方案的数据标识、字段或时间不正确。');
  return r;
}
export function createAdvancedRecipe(data:DataSet,config:AdvancedConfig,fingerprint:string):AdvancedRecipe{
  return parseAdvancedRecipe(JSON.stringify({format:'acaora-advanced-recipe',version:1,engine:ADVANCED_ENGINE,missingPolicy:'complete-required-fields',config:{...config,validation:config.validation??'random',time:config.time??''},dataset:{fingerprint,headers:data.headers,rows:data.rows.length},createdAt:new Date().toISOString()}));
}
export function advancedMappingErrors(data:DataSet,c:AdvancedConfig){
  if(!validAdvancedConfig(c))return ['变量映射或方法参数无效，请核对不同的所需字段与取值范围。'];
  const numeric=new Set(numericColumns(data));return [...requiredColumns(c).flatMap(h=>!data.headers.includes(h)?[`未找到“${h}”，请映射到当前字段。`]:(usesGroup(c)&&h===c.group)||(c.method==='bootstrap'&&c.bootstrapUnit==='cluster'&&h===c.bootstrapCluster)?[]:(c.categoricals??[]).some(v=>v.name===h)?[]:numeric.has(h)?[]:[`“${h}”不是可用数值列，请检查编码或重新映射。`]),...(c.categoricals??[]).flatMap(v=>categoryLevels(data,v.name).includes(v.reference)?[]:[`“${v.name}”缺少参考组“${v.reference}”，请核对。`]),...(c.method==='posthoc'&&c.posthocFamily==='reference'&&!categoryLevels(data,c.group).includes(c.posthocReference??'')?['当前分组列中没有指定的比较参考组。']:[])];
}
export function mapAdvancedConfig(c:AdvancedConfig,mapping:Record<string,string>):AdvancedConfig{
  const map=(h:string)=>Object.hasOwn(mapping,h)?mapping[h]:h;return {...c,outcome:map(c.outcome),second:map(c.second),group:map(c.group),time:map(c.time??''),...(c.bootstrapCluster!==undefined?{bootstrapCluster:map(c.bootstrapCluster)}:{}),predictors:c.predictors.map(map),...(c.categoricals?{categoricals:c.categoricals.map(v=>({...v,name:map(v.name)}))}:{})};
}
