import {isMissing,type DataSet} from '../stats';
import {completeRows,type CompleteRow} from './advanced-math';
import {requiredColumns,usesGroup,type AdvancedConfig} from './advanced-config';
import {validationSplits} from './advanced-learning';
import {fitCategoryEncoding} from './categorical-design';
export type AdvancedCheck={config:AdvancedConfig;total:number;complete:number|null;excluded:number|null;columns:Array<{name:string;missing:number;invalid:number}>;facts:Array<[string,string]>;errors:string[];warnings:string[];scope:string};
export function inspectAdvancedData(data:DataSet,c:AdvancedConfig,knownRows?:CompleteRow[]):AdvancedCheck{
  const scope=c.method==='pca'||c.method==='kmeans'?'检查覆盖字段、样本量和基本参数；变量尺度、异常值影响与分析解释需结合研究问题判断。':['cv','classification'].includes(c.method)?'检查覆盖样本与分折条件；预测时变量是否可获得、调参偏差和验证方式是否符合使用场景仍需判断。':c.method==='logistic'||c.method==='cluster'||c.method==='fixed'?'检查覆盖字段编码、基本样本与分组条件；独立性和研究识别需自行判断，共线性、分离或收敛问题在实际拟合时进一步检查。':'检查覆盖字段、有效组与配对数量；匹配是否正确、独立性及分布条件仍需结合方法说明和研究设计判断。';
  const report:AdvancedCheck={config:structuredClone(c),total:data.rows.length,complete:null,excluded:null,columns:[],facts:[],errors:[],warnings:[],scope},columns=requiredColumns(c),grouped=usesGroup(c);
  if(columns.some(h=>!h||!data.headers.includes(h))||new Set(columns).size!==columns.length){report.errors.push('请选择当前数据中不同且有效的变量。');return report;}
  report.columns=columns.map(name=>({name,missing:0,invalid:0}));const indices=columns.map(h=>data.headers.indexOf(h));let complete=0;
  for(const row of data.rows){let valid=true;for(let j=0;j<columns.length;j++){
    const raw=row[indices[j]]??'';
    if(isMissing(raw)){report.columns[j].missing++;valid=false;}else if(!(grouped&&columns[j]===c.group)&&!(c.categoricals??[]).some(v=>v.name===columns[j])&&!(c.method==='bootstrap'&&c.bootstrapUnit==='cluster'&&columns[j]===c.bootstrapCluster)&&!Number.isFinite(Number(raw))){report.columns[j].invalid++;valid=false;}
  }if(valid)complete++;}
  report.complete=complete;report.excluded=data.rows.length-complete;
  if(report.excluded>data.rows.length*.2)report.warnings.push('超过 20% 的记录因所选字段不完整而排除；这是排查提示，不代表其余样本无偏。请核对缺失机制与研究样本。');
  let rows:CompleteRow[];try{rows=knownRows??completeRows(data,c);}catch(cause){report.errors.push(cause instanceof Error?cause.message:'数据检查失败。');return report;}
  let expandedCount=c.predictors.length;
  if(c.categoricals?.length)try{const encoding=fitCategoryEncoding(rows,c.categoricals,data.headers,c.predictors.length);expandedCount+=encoding.columns.length;report.facts.push(['编码后解释列',String(expandedCount)]);}catch(cause){report.errors.push(cause instanceof Error?cause.message:'无法编码分类变量。');}
  if(c.method==='kmeans'&&(!Number.isInteger(c.clusters)||c.clusters<2||c.clusters>12||c.clusters>=rows.length))report.errors.push('聚类数须为 2 至 12，且小于有效观测数。');
  if(c.method==='pca'&&(!Number.isInteger(c.components)||c.components<1||c.components>c.predictors.length))report.errors.push('主成分数须为 1 至所选变量数的整数。');
  const groups=new Map<string,CompleteRow[]>();if(grouped)for(const r of rows){const group=groups.get(r.group)??[];group.push(r);groups.set(r.group,group);}
  if(grouped){const counts=[...groups.values()].map(g=>g.length);report.facts.push(['有效组 / 主体',String(groups.size)],['每组 N 范围',`${Math.min(...counts)}–${Math.max(...counts)}`]);
    if(['anova','welchanova','posthoc','mannwhitney'].includes(c.method)&&(groups.size<2||groups.size>100||counts.some(n=>n<2)))report.errors.push('需要 2 至 100 个有效组，每组至少 2 个完整观测。');
    if(c.method==='mannwhitney'&&groups.size!==2)report.errors.push('Mann–Whitney 需要恰好两个有效组。');
    if(c.method==='posthoc'&&(groups.size>12||[...groups.values()].some(g=>g.every(r=>r.values[c.outcome]===g[0].values[c.outcome]))))report.errors.push('成对 Welch 限 12 组且每组方差须为正。');
    if(c.method==='posthoc'&&c.posthocFamily==='reference'&&!groups.has(c.posthocReference??''))report.errors.push('完整观测中未找到比较参考组。');
    if((c.method==='cluster'||c.method==='fixed')&&groups.size<2)report.errors.push('聚类推断至少需要 2 个主体。');
    if((c.method==='cluster'||c.method==='fixed')&&groups.size<30)report.warnings.push('聚类数少于 30，聚类渐近推断可能不稳定；30 是经验提醒，不是可靠性保证。');
    if(c.method==='cluster'||c.method==='fixed'){const df=rows.length-expandedCount-(c.method==='fixed'?groups.size:1);report.facts.push(['残差自由度',String(df)]);if(df<1)report.errors.push('扣除模型参数与固定效应后没有正残差自由度，请增加观测或减少变量。');}
    if(c.method==='welchanova'&&[...groups.values()].some(g=>g.every(r=>r.values[c.outcome]===g[0].values[c.outcome])))report.errors.push('Welch ANOVA 有组内方差为零的组，请检查数据或选择适合研究设计的方法。');
    if(c.method==='fixed')for(const h of c.predictors)if([...groups.values()].every(g=>g.every(r=>r.values[h]===g[0].values[h])))report.errors.push(`“${h}”在主体内部没有变动，固定效应不能识别。`);
  }
  if(['logistic','classification'].includes(c.method)){
    const counts=[rows.filter(r=>r.values[c.outcome]===0).length,rows.filter(r=>r.values[c.outcome]===1).length];report.facts.push(['Y=0 / Y=1',`${counts[0]} / ${counts[1]}`]);
    if(counts.some(n=>n===0)||counts[0]+counts[1]!==rows.length)report.errors.push('Logistic 因变量必须只含 0 与 1，且两类均存在；请先明确编码。');
  }
  if(c.method==='paired'||c.method==='wilcoxon'){
    const zero=rows.filter(r=>r.values[c.outcome]===r.values[c.second]).length;report.facts.push(['零配对差数量',String(zero)]);
    if(c.method==='wilcoxon'&&rows.length-zero<2)report.errors.push('去除零差后至少需要 2 个配对。');
    if(c.method==='paired'&&rows.every(r=>r.values[c.outcome]-r.values[c.second]===rows[0].values[c.outcome]-rows[0].values[c.second]))report.errors.push('配对差值没有变动，无法估计 t 检验误差。');
  }
  for(const h of columns.filter(h=>!(grouped&&h===c.group)&&!(c.categoricals??[]).some(v=>v.name===h)&&!(c.method==='bootstrap'&&c.bootstrapUnit==='cluster'&&h===c.bootstrapCluster))){
    const values=rows.map(r=>r.values[h]);
    if(!['paired','wilcoxon','bootstrap'].includes(c.method)&&values.every(v=>v===values[0])&&h!==c.time)report.errors.push(`“${h}”在完整观测中没有变动，请调整所选变量。`);
    if(c.predictors.includes(h)&&/(^id$|编号|序号|index|row_number)/i.test(h)&&new Set(values).size===values.length)report.warnings.push(`“${h}”可能是唯一标识或序号，请确认是否适合作为解释/分析变量。不会自动删除。`);
  }
  if(c.method==='pca'&&(c.predictors.length<2||c.components>c.predictors.length))report.errors.push('PCA 至少选择两个变量，保留成分数不能超过变量数。');
  if(c.method==='pca'&&rows.length<=c.predictors.length)report.errors.push('PCA 完整观测数须大于所选变量数。');
  if(c.method==='bootstrap'){const b=c.bootstrapIterations??500;if(!Number.isInteger(b)||b<100||b>2000)report.errors.push('重抽样次数须为 100 至 2000。');if(b*rows.length>20000000)report.errors.push('超过 2,000 万次观测处理预算，请减少次数或样本量。');if(c.bootstrapStatistic==='difference'&&groups.size!==2)report.errors.push('两组均值差需要恰好两个完整观测组。');if(c.bootstrapUnit==='cluster'){const subjects=new Set(rows.map(r=>r.categories?.[c.bootstrapCluster??'']));report.facts.push(['重抽样主体数',String(subjects.size)]);if(subjects.size<2)report.errors.push('主体重抽样至少需要两个主体。');}}
  if(c.method==='classification'&&(!Number.isFinite(c.threshold??.5)||(c.threshold??.5)<0||(c.threshold??.5)>1))report.errors.push('分类阈值应为 0 至 1。');
  if(['cv','classification'].includes(c.method))try{
    const {splits}=validationSplits(rows,c),sizes=splits.map(s=>s.train.length);report.facts.push(['各折训练 N 范围',`${Math.min(...sizes)}–${Math.max(...sizes)}`],['划分方式',c.validation==='group'?'主体完全隔离':c.validation==='time'?'严格时间前向':'随机 K 折']);
  }catch(cause){report.errors.push(cause instanceof Error?cause.message:'无法划分验证集。');}
  return report;
}
