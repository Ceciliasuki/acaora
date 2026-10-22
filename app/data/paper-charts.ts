import type {RegressionFit} from './multiple-regression';
import {advancedMethods,type AdvancedResult} from './advanced-config';
import type {PaperChartSpec} from './paper-chart-svg';
export function regressionPaperChart(fit:RegressionFit):PaperChartSpec{
  return {kind:'forest',title:'回归系数与 95% 置信区间',xLabel:'系数（各变量原始单位）',yLabel:'解释变量',source:fit.source,n:fit.n,method:`OLS · ${fit.config.standardErrors} 标准误`,note:'圆点为估计系数，横线为 95% 区间，虚线为零。缺少有效区间时只绘制圆点。',points:fit.coefficients.slice(1).map(c=>({label:c.name,value:c.estimate,low:c.low,high:c.high})),metadata:{config:fit.config,df:fit.dfResidual,encoding:fit.encoding}};
}
export function advancedPaperChart(fit:AdvancedResult):PaperChartSpec|null{
  const method=advancedMethods.find(m=>m.id===fit.method)?.name??fit.method,base={source:fit.source,n:fit.n,method,metadata:{config:fit.config,context:fit.context}};
  if(['logistic','cluster','fixed'].includes(fit.method)){
    const t=fit.tables[0],rows=fit.method==='fixed'?t.rows:t.rows.slice(1);return {...base,kind:'forest',title:'回归系数与 95% 置信区间',xLabel:fit.method==='logistic'?'系数（log odds）':'系数（各变量原始单位）',yLabel:'解释变量',note:`${fit.method==='logistic'?'常规 Wald 正态区间；log odds 不是概率差。':'CR1 聚类标准误，t 参考分布。'}圆点为估计，横线为 95% 区间，虚线为零。`,points:rows.map(r=>({label:String(r[0]),value:Number(r[1]),low:r[5]===null?null:Number(r[5]),high:r[6]===null?null:Number(r[6])}))};
  }
  if(fit.method==='pca')return {...base,kind:'scree',title:'主成分碎石图',xLabel:'主成分',yLabel:'特征值',note:'变量按样本标准差标准化；特征值与解释率见完整结果表。',points:fit.tables[0].rows.map(r=>({label:String(r[0]),value:Number(r[1]),secondary:Number(r[2])}))};
  if(fit.method==='cv'){const n=fit.metrics.find(([k])=>k==='折外评估 N')?.[1]??fit.n;return {...base,n,kind:'error',title:'各验证折的预测误差',xLabel:'验证折',yLabel:'误差（因变量单位）',note:`${fit.config.validation==='time'?'时间前向':fit.config.validation==='group'?'主体分组':'随机分折'}；实线圆点为 RMSE，虚线方点为 MAE；每折只使用训练样本拟合预处理与模型。`,points:fit.tables[0].rows.map(r=>({label:String(r[0]),value:Number(r[3]),secondary:Number(r[4])}))};}
  return null;
}

export function advancedPaperCharts(fit:AdvancedResult):PaperChartSpec[]{
  if(fit.method!=='classification'){const spec=advancedPaperChart(fit);return spec?[spec]:[];}
  const base={source:fit.source,n:fit.metrics.find(([k])=>k==='折外评估 N')?.[1]??fit.n,method:'Logistic 折外预测验证',metadata:{config:fit.config,context:fit.context}};
  return (['roc','pr','calibration'] as const).map(kind=>{
    const t=fit.tables.find(t=>t.title===(kind==='roc'?'ROC 曲线':kind==='pr'?'PR 曲线':'校准分箱'))!;
    return {...base,kind,title:kind==='roc'?'折外 ROC 曲线':kind==='pr'?'折外 PR 曲线':'折外概率校准图',xLabel:kind==='roc'?'假阳性率':kind==='pr'?'召回率':'平均预测概率',yLabel:kind==='roc'?'真阳性率':kind==='pr'?'精确率':'实际事件比例',note:kind==='pr'?'所有折外概率阈值；AP 按召回增量加权，阶梯曲线不使用梯形面积。':kind==='roc'?'所有折外概率阈值；虚线为随机排序参考。':'等宽 10 箱，空箱不绘制；虚线为理想校准参考，连线仅辅助阅读。',points:t.rows.filter(r=>kind!=='calibration'||Number(r[2])>0).map(r=>({label:kind==='calibration'?`N=${r[2]}`:String(r[0]),x:Number(r[kind==='calibration'?3:1]),value:Number(r[kind==='calibration'?4:2])}))};
  });
}
