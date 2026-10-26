import {numericColumns,type DataSet} from '../stats';
import {validCategories,categoryLevels,type CategorySpec} from './categorical-design';
export type RegressionConfig={outcome:string;predictors:string[];standardErrors:'classical'|'HC3';categoricals?:CategorySpec[]};
export const REGRESSION_ENGINE='acaora-ols-v2';
export const MAX_PREDICTORS=12;
export const MAX_REGRESSION_ROWS=50000;
export type RegressionRecipe={format:'acaora-regression-recipe';version:1;engine:typeof REGRESSION_ENGINE|'acaora-ols-v1';confidence:.95;missingPolicy:'listwise-complete-cases';intercept:true;config:RegressionConfig;dataset:{fingerprint:string;headers:string[];rows:number};createdAt:string};
export function validRegressionConfig(value:unknown):value is RegressionConfig{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const c=value as Record<string,unknown>;
  const field=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=500&&!Array.from(v).some(character=>character.charCodeAt(0)<32);
  const cats=c.categoricals??[];return Object.keys(c).every(k=>['outcome','predictors','standardErrors','categoricals'].includes(k))&&validCategories(cats)&&field(c.outcome)&&Array.isArray(c.predictors)&&c.predictors.length+cats.length>=1&&c.predictors.length+cats.length<=MAX_PREDICTORS&&c.predictors.every(field)&&new Set([c.outcome,...c.predictors,...cats.map(v=>v.name)]).size===1+c.predictors.length+cats.length&&(c.standardErrors==='classical'||c.standardErrors==='HC3');
}
export function regressionConfigErrors(data:DataSet,config:RegressionConfig):string[]{
  if(!validRegressionConfig(config))return ['请选择一个因变量、1 至 12 个不同的解释变量，以及有效的标准误方式。'];
  const numeric=new Set(numericColumns(data));
  return [...[config.outcome,...config.predictors].filter(header=>!numeric.has(header)).map(header=>`“${header}”不是当前数据中可用的数值变量，请重新映射。`),...(config.categoricals??[]).flatMap(c=>{const levels=categoryLevels(data,c.name);return levels.length<2||levels.length>12||!levels.includes(c.reference)?[`“${c.name}”需有 2–12 类且包含所选参考组，请重新映射。`]:[];})];
}
export function parseRegressionRecipe(text:string):RegressionRecipe{
  if(new TextEncoder().encode(text).length>256*1024)throw new Error('回归方案超过 256 KB。');
  const data=JSON.parse(text) as Partial<RegressionRecipe>;
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length!==9||data.format!=='acaora-regression-recipe'||data.version!==1||![REGRESSION_ENGINE,'acaora-ols-v1'].includes(data.engine??'')||data.confidence!==.95||data.missingPolicy!=='listwise-complete-cases'||data.intercept!==true||!validRegressionConfig(data.config)||(data.engine==='acaora-ols-v1'&&data.config.categoricals?.length))throw new Error('不是受支持的回归方案，未修改当前模型。');
  const ds=data.dataset;
  if(!ds||typeof ds!=='object'||Object.keys(ds).length!==3||typeof ds.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(ds.fingerprint)||!Array.isArray(ds.headers)||ds.headers.length<2||ds.headers.length>2000||ds.headers.some(h=>typeof h!=='string'||!h.trim()||h.length>500)||new Set(ds.headers).size!==ds.headers.length||!Number.isSafeInteger(ds.rows)||ds.rows<1||typeof data.createdAt!=='string'||data.createdAt.length>40||!Number.isFinite(Date.parse(data.createdAt)))throw new Error('回归方案的数据标识或时间不正确。');
  return data as RegressionRecipe;
}
export function createRegressionRecipe(data:DataSet,config:RegressionConfig,fingerprint:string):RegressionRecipe{
  return parseRegressionRecipe(JSON.stringify({format:'acaora-regression-recipe',version:1,engine:REGRESSION_ENGINE,confidence:.95,missingPolicy:'listwise-complete-cases',intercept:true,config,dataset:{fingerprint,headers:data.headers,rows:data.rows.length},createdAt:new Date().toISOString()}));
}

/** Identifier-like columns remain selectable but are never silently modelled. */
export function defaultRegressionConfig(data:DataSet):RegressionConfig {
  const fields=numericColumns(data).filter(name=>!/(^|[_\s-])(id|uuid|index|row|key)([_\s-]|$)|^(编号|序号|学号|样本编号|观测编号|记录号)$/i.test(name.trim()));
  const outcome=fields.includes('统计学成绩')?'统计学成绩':fields.at(-1)??'';
  return {outcome,predictors:fields.filter(name=>name!==outcome).slice(0,2),standardErrors:'HC3'};
}
