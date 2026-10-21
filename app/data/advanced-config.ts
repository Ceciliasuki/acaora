import type {CategorySpec} from './categorical-design';
export const advancedMethods = [
  {group:'回归与面板',id:'logistic',name:'二元 Logistic 回归',note:'因变量必须严格编码为 0/1。报告最大似然系数、优势比 OR 与 Wald 95% 区间；分类解释变量需明确参考组；分离或数值不稳定时拒绝推断。'},
  {group:'回归与面板',id:'cluster',name:'聚类稳健线性回归',note:'按一个主体字段计算 CR1 聚类标准误，允许组内相关；组间需独立。t 推断自由度为聚类数减一。'},
  {group:'回归与面板',id:'fixed',name:'单向个体固定效应',note:'按主体去均值，估计个体内关联；标准误按主体聚类 CR1。不能识别主体内不变变量，不包含时间固定效应，不自动建立因果关系。'},
  {group:'统计检验',id:'paired',name:'配对样本 t 检验',note:'同一行的两列必须来自同一受试者或匹配单位。方向为第一列减第二列；差值近似正态，配对之间独立。'},
  {group:'统计检验',id:'anova',name:'单因素方差分析（ANOVA）',note:'比较两个或多个独立组的均值，假设组内误差近似正态且同方差。整体显著不代表每对组都不同；不提供事后多重比较。'},
  {group:'统计检验',id:'welchanova',name:'Welch 单因素方差分析',note:'比较两个或多个独立组的均值，允许方差和样本量不同；仍需独立观测与组内近似正态。不是根据 p 值在两种 ANOVA 中挑选结果，不提供事后比较。'},
  {group:'统计检验',id:'posthoc',name:'成对 Welch 检验（Holm 校正）',note:'预先选择全部组间比较或各组对参考组比较，在同一比较族内做 Holm 校正。报告原始与校正 p；各对的 95% 区间是未调整的单独区间，不是同时置信区间。'},
  {group:'统计检验',id:'mannwhitney',name:'Mann–Whitney U 检验',note:'需要恰好两个独立组。双侧正态近似，校正并列秩与连续性；检验分布关系，只有额外形状假设下才能解释为中位数差异。'},
  {group:'统计检验',id:'wilcoxon',name:'Wilcoxon 配对符号秩检验',note:'同一行两列配对；第一列减第二列。去除零差，校正并列秩与连续性，使用双侧正态近似；差值分布应对称。'},
  {group:'降维与聚类',id:'pca',name:'主成分分析（PCA）',note:'完整观测按样本标准差标准化后做 SVD。输出解释率、主轴权重与得分；权重不是因果贡献，同特征值的方向可能不唯一。'},
  {group:'降维与聚类',id:'kmeans',name:'K-means 聚类',note:'在标准化数值空间做 Lloyd 迭代；固定种子、5 次初始化取最小组内平方和。聚类是探索分组，不代表真实类别或统计显著性。'},
  {group:'预测验证',id:'cv',name:'线性回归交叉验证',note:'按数据结构选择随机、主体分组或时间前向验证；预处理仅在各折训练集拟合。输出折外预测、RMSE、MAE、R² 及训练均值基线。反复据验证结果调参仍可能过拟合。'},
  {group:'预测验证',id:'classification',name:'Logistic 分类预测验证',note:'使用折外概率评估 ROC-AUC、平均精确率 AP、Brier、对数损失与校准分箱。阈值须预先指定；分类编码只在训练折拟合。分离、未知类别或失败折会停止计算。'},
  {group:'重抽样推断',id:'bootstrap',name:'Bootstrap 置信区间',note:'支持均值、配对均值差、两组均值差与 Pearson 相关。按独立行或完整主体重抽样，报告百分位 95% 区间。主体抽样保留组内所有记录；时间相关数据需另用区块 Bootstrap。'},
] as const;
export type AdvancedMethod=typeof advancedMethods[number]['id'];
export type AdvancedConfig={method:AdvancedMethod;outcome:string;predictors:string[];group:string;second:string;components:number;clusters:number;folds:number;seed:number;validation?:'random'|'group'|'time';time?:string;categoricals?:CategorySpec[];posthocFamily?:'all'|'reference';posthocReference?:string;threshold?:number;bootstrapStatistic?:'mean'|'paired-difference'|'difference'|'correlation';bootstrapUnit?:'row'|'cluster';bootstrapCluster?:string;bootstrapIterations?:number};
export type Cell=string|number|null;
export type AdvancedTable={title:string;headers:string[];rows:Cell[][];observationLevel?:boolean};
export type AdvancedResult={method:AdvancedMethod;source:string;n:number;excluded:number;context:string;metrics:Array<[string,number|null]>;tables:AdvancedTable[];warnings:string[];config:AdvancedConfig};
export const ADVANCED_ENGINE='acaora-advanced-v4';
export const predictionMethod=(c:AdvancedConfig)=>c.method==='cv'||c.method==='classification';
export function usesGroup(c:AdvancedConfig){return ['cluster','fixed','anova','welchanova','posthoc','mannwhitney'].includes(c.method)||(predictionMethod(c)&&c.validation==='group')||(c.method==='bootstrap'&&c.bootstrapStatistic==='difference');}
export function requiredColumns(c:AdvancedConfig){
  if(c.method==='bootstrap')return [c.outcome,...(['paired-difference','correlation'].includes(c.bootstrapStatistic??'mean')?[c.second]:[]),...(c.bootstrapStatistic==='difference'?[c.group]:[]),...(c.bootstrapUnit==='cluster'?[c.bootstrapCluster??'']:[])];
  if(c.method==='pca'||c.method==='kmeans')return c.predictors;
  if(c.method==='paired'||c.method==='wilcoxon')return [c.outcome,c.second];
  if(c.method==='anova'||c.method==='welchanova'||c.method==='posthoc'||c.method==='mannwhitney')return [c.outcome,c.group];
  return [c.outcome,...c.predictors,...(c.categoricals??[]).map(v=>v.name),...(usesGroup(c)?[c.group]:[]),...(predictionMethod(c)&&c.validation==='time'?[c.time??'']:[])];
}
