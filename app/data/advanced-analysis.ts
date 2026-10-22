import type {DataSet} from '../stats';
import {completeRows,testMethods} from './advanced-math';
import {clusteredRegression,logisticRegression} from './advanced-models';
import {pca,kmeans,crossValidation} from './advanced-learning';
import {requiredColumns,type AdvancedConfig,type AdvancedResult} from './advanced-config';
import {inspectAdvancedData} from './advanced-check';
import {expandCategoricalData,encodingDescription} from './categorical-design';
import {classificationValidation,bootstrapInference} from './research-methods';
import {pairwiseWelch} from './posthoc';
export function runAdvancedAnalysis(data:DataSet,config:AdvancedConfig):AdvancedResult{
  const rows=completeRows(data,config);
  if(config.categoricals?.length&&!['cv','classification'].includes(config.method)){
    const expanded=expandCategoricalData(data,config.categoricals,config.predictors.length,rows),encoded={...config,predictors:[...config.predictors,...expanded.encoding.columns.map(c=>c.key)]};delete encoded.categoricals;
    const result=runAdvancedAnalysis(expanded.data,encoded),labels=new Map(expanded.encoding.columns.map(c=>[c.key,c.label]));
    result.tables=result.tables.map(t=>({...t,rows:t.rows.map(r=>r.map(v=>typeof v==='string'?(labels.get(v)??v):v))}));
    result.config=structuredClone(config);result.context=`变量：${requiredColumns(config).join('、')}${result.context.slice(result.context.indexOf('；'))}；哑变量编码：${encodingDescription(config.categoricals)}`;
    result.tables.push({title:'分类编码与参考组',headers:['字段','类别','参考组','解释列'],rows:expanded.encoding.columns.map(c=>[c.source,c.level,c.reference,c.label])});return result;
  }
  const result=config.method==='classification'?classificationValidation(data,config,rows):config.method==='bootstrap'?bootstrapInference(data,config,rows):config.method==='logistic'?logisticRegression(data,config,rows):config.method==='cluster'||config.method==='fixed'?clusteredRegression(data,config,rows):config.method==='pca'?pca(data,config,rows):config.method==='kmeans'?kmeans(data,config,rows):config.method==='cv'?crossValidation(data,config,rows):config.method==='posthoc'?pairwiseWelch(data,config,rows):testMethods(data,config,rows);
  const check=inspectAdvancedData(data,config,rows);result.warnings=[...new Set([...result.warnings,...check.warnings])];
  for(const [,v] of result.metrics)if(v!==null&&!Number.isFinite(v))throw new Error('指标数值溢出，未输出结果。请检查变量量级。');
  for(const t of result.tables)for(const row of t.rows)if(row.some(v=>typeof v==='number'&&!Number.isFinite(v)))throw new Error('计算结果溢出，未输出结果。请检查变量量级。');
  return result;
}
