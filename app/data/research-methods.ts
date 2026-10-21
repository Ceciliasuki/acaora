import type {DataSet} from '../stats';
import type {AdvancedConfig,AdvancedTable} from './advanced-config';
import {baseResult,mean,ss,rng,type CompleteRow} from './advanced-math';
import {validationSplits} from './advanced-learning';
import {logisticRegression} from './advanced-models';
import {fitCategoryEncoding,encodeCategoryRow} from './categorical-design';
import {quantile} from './data-exploration';
const table=(title:string,headers:string[],rows:AdvancedTable['rows'],observationLevel=false):AdvancedTable=>({title,headers,rows,observationLevel});
const sigmoid=(z:number)=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
export function binaryMetrics(y:number[],p:number[],threshold:number){
  if(y.length!==p.length||!y.length||y.some(v=>v!==0&&v!==1)||!y.includes(0)||!y.includes(1)||p.some(v=>!Number.isFinite(v)||v<0||v>1)||!Number.isFinite(threshold)||threshold<0||threshold>1)throw new Error('评估需要两种真实类别、有限概率和 0–1 阈值。');
  const positive=y.reduce((s,v)=>s+v,0),negative=y.length-positive,order=p.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v);
  const roc:AdvancedTable['rows']=[[null,0,0]],pr:AdvancedTable['rows']=[[null,0,1]];let tp=0,fp=0,auc=0,ap=0,lastFpr=0,lastRecall=0;
  for(let i=0;i<order.length;){let j=i;while(j<order.length&&order[j].v===order[i].v){if(y[order[j].i])tp++;else fp++;j++;}const recall=tp/positive,fpr=fp/negative,precision=tp/(tp+fp);auc+=(fpr-lastFpr)*(recall+lastRecall)/2;ap+=(recall-lastRecall)*precision;roc.push([order[i].v,fpr,recall]);pr.push([order[i].v,recall,precision]);lastFpr=fpr;lastRecall=recall;i=j;}
  tp=0;fp=0;let tn=0,fn=0;for(let i=0;i<y.length;i++){if(p[i]>=threshold){if(y[i])tp++;else fp++;}else if(y[i])fn++;else tn++;}
  const precision=tp+fp?tp/(tp+fp):null,recall=tp/(tp+fn),specificity=tn/(tn+fp),f1=2*tp+fp+fn?2*tp/(2*tp+fp+fn):null;
  const calibration:AdvancedTable['rows']=[];for(let b=0;b<10;b++){const indices=p.map((v,i)=>({v,i})).filter(({v})=>Math.min(9,Math.floor(v*10))===b).map(v=>v.i);calibration.push([b/10,(b+1)/10,indices.length,indices.length?mean(indices.map(i=>p[i])):null,indices.length?mean(indices.map(i=>y[i])):null]);}
  return {auc,ap,brier:mean(p.map((v,i)=>(v-y[i])**2)),logloss:-mean(p.map((v,i)=>{const clipped=Math.min(1-1e-15,Math.max(1e-15,v));return y[i]*Math.log(clipped)+(1-y[i])*Math.log1p(-clipped);})),tp,fp,tn,fn,precision,recall,specificity,f1,roc,pr,calibration};
}
export function classificationValidation(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const threshold=c.threshold??.5,result=baseResult(data,c,rows),n=rows.length;
  if(!Number.isFinite(threshold)||threshold<0||threshold>1)throw new Error('分类阈值应为 0 至 1。');
  if(rows.some(r=>r.values[c.outcome]!==0&&r.values[c.outcome]!==1))throw new Error('分类结果必须严格编码为 0/1。');
  const {folds,splits}=validationSplits(rows,c),predictions:Array<number|null>=Array(n).fill(null),foldRows:AdvancedTable['rows']=[],encodingRows:AdvancedTable['rows']=[],isolation:AdvancedTable['rows']=[];
  for(let f=0;f<splits.length;f++){
    const {train:indices,held}=splits[f],train=indices.map(i=>rows[i]);
    try{
      const encoding=fitCategoryEncoding(train,c.categoricals??[],data.headers,c.predictors.length),names=[...c.predictors,...encoding.columns.map(v=>v.key)],vector=(r:CompleteRow)=>[...c.predictors.map(h=>r.values[h]),...encodeCategoryRow(r,encoding)];
      const encoded=train.map(r=>({...r,values:Object.assign(Object.create(null),r.values,...encoding.columns.map((v,j)=>({[v.key]:encodeCategoryRow(r,encoding)[j]})))}));
      const fit=logisticRegression(data,{...c,method:'logistic',predictors:names,categoricals:[]},encoded),beta=fit.tables[0].rows.map(r=>Number(r[1]));
      for(const i of held)predictions[i]=sigmoid(beta[0]+vector(rows[i]).reduce((s,v,j)=>s+v*beta[j+1],0));
      foldRows.push([f+1,train.length,train.filter(r=>r.values[c.outcome]===1).length,held.length,held.filter(i=>rows[i].values[c.outcome]===1).length]);
      encodingRows.push(...encoding.columns.map(v=>[f+1,v.source,v.level,v.reference,v.label]));
      if(c.validation==='group')isolation.push([f+1,new Set(train.map(r=>r.group)).size,new Set(held.map(i=>rows[i].group)).size,0]);
      if(c.validation==='time')isolation.push([f+1,Math.max(...train.map(r=>r.values[c.time!])),Math.min(...held.map(i=>rows[i].values[c.time!]))]);
    }catch(e){throw new Error(`第 ${f+1} 折失败：${e instanceof Error?e.message:'无法拟合'}；未跳过失败折。`);}
  }
  const evaluated=rows.map((_,i)=>i).filter(i=>predictions[i]!==null),y=evaluated.map(i=>rows[i].values[c.outcome]),p=evaluated.map(i=>predictions[i]!),m=binaryMetrics(y,p,threshold);
  result.metrics=[['折外评估 N',y.length],['仅用于初始训练 N',n-y.length],['ROC-AUC',m.auc],['平均精确率 AP',m.ap],['Brier',m.brier],['对数损失',m.logloss],['预设阈值',threshold],['精确率',m.precision],['召回率 / 敏感度',m.recall],['特异度',m.specificity],['F1',m.f1]];
  result.tables=[table('各折类别检查',['折','训练 N','训练 Y=1','验证 N','验证 Y=1'],foldRows),table('混淆矩阵',['实际类别','预测 0','预测 1'],[[0,m.tn,m.fp],[1,m.fn,m.tp]]),table('ROC 曲线',['阈值（空为正无穷）','假阳性率','真阳性率'],m.roc),table('PR 曲线',['阈值（空为正无穷）','召回率','精确率'],m.pr),table('校准分箱',['概率下界（含）','上界（末箱含 1）','N','平均预测概率','实际事件比例'],m.calibration),table('逐行折外概率',['观测行（表头不计）','验证折','实际类别','折外概率','预设阈值下预测'],rows.map((r,i)=>[r.row,folds[i]<0?null:folds[i]+1,r.values[c.outcome],predictions[i],predictions[i]===null?null:Number(predictions[i]!>=threshold)]),true)];
  if(isolation.length)result.tables.push(table(c.validation==='time'?'时间顺序检查':'主体隔离检查',c.validation==='time'?['折','训练最晚时间','验证最早时间']:['折','训练主体数','验证主体数','交叉主体数'],isolation));
  if(encodingRows.length)result.tables.push(table('逐折分类编码',['折','字段','类别','参考组','解释列'],encodingRows));
  result.context+=`；${c.folds} 折 Logistic；${c.validation??'random'}；种子 ${c.seed}；阈值 ${threshold}；训练折单独编码，汇总折外概率评估`;
  result.warnings.push('AP 是按召回增量加权的平均精确率，不是 PR 梯形面积。校准图是描述性等宽分箱，不是重新拟合校准模型；未报告评估指标的置信区间。','阈值或变量按本次验证表现反复调整，会使评估偏乐观；保留独立测试集。随机分折未做类别分层，稀少类别可能导致训练失败。');
  if(c.validation==='time')result.warnings.push('最早时间块只参与初始训练，不进入折外评估；未设置时间间隔或清除标签重叠。');
  return result;
}
export function bootstrapInference(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const statistic=c.bootstrapStatistic??'mean',unit=c.bootstrapUnit??'row',iterations=c.bootstrapIterations??500,result=baseResult(data,c,rows),random=rng(c.seed);
  if(!['mean','paired-difference','difference','correlation'].includes(statistic)||!['row','cluster'].includes(unit)||!Number.isInteger(iterations)||iterations<100||iterations>2000)throw new Error('Bootstrap 统计量/单位无效，重复次数须为 100 至 2000。');
  if(rows.length*iterations>20000000)throw new Error('Bootstrap 超过 2,000 万次观测处理预算，请减少重复次数或样本量。');
  const groups=[...new Set(rows.map(r=>r.group))].sort();if(statistic==='difference'&&groups.length!==2)throw new Error('两组均值差需恰好两个完整观测组。');
  const estimate=(sample:CompleteRow[])=>{
    const x=sample.map(r=>r.values[c.outcome]);
    if(statistic==='mean')return mean(x);
    if(statistic==='paired-difference')return mean(sample.map(r=>r.values[c.outcome]-r.values[c.second]));
    if(statistic==='difference'){const a=sample.filter(r=>r.group===groups[0]),b=sample.filter(r=>r.group===groups[1]);return a.length&&b.length?mean(a.map(r=>r.values[c.outcome]))-mean(b.map(r=>r.values[c.outcome])):NaN;}
    const y=sample.map(r=>r.values[c.second]),mx=mean(x),my=mean(y),denom=Math.sqrt(ss(x,mx)*ss(y,my));return denom>0?x.reduce((s,v,i)=>s+(v-mx)*(y[i]-my),0)/denom:NaN;
  };
  const observed=estimate(rows);if(!Number.isFinite(observed))throw new Error('原样本统计量无定义或溢出，请检查常量列及分组。');
  const clusters=new Map<string,CompleteRow[]>();if(unit==='cluster')for(const r of rows){const key=r.categories?.[c.bootstrapCluster??''];if(!key)throw new Error('请选择完整主体字段。');const a=clusters.get(key)??[];a.push(r);clusters.set(key,a);}
  if(unit==='cluster'&&clusters.size<2)throw new Error('主体重抽样至少需要两个主体。');
  const units=unit==='cluster'?[...clusters.values()]:statistic==='difference'?groups.map(g=>rows.filter(r=>r.group===g)):[rows];
  const draws:number[]=[],replicates:AdvancedTable['rows']=[];let visits=0;
  for(let b=0;b<iterations;b++){
    const sample:CompleteRow[]=[];
    if(unit==='cluster'){for(let j=0;j<units.length;j++){const picked=units[Math.floor(random()*units.length)];visits+=picked.length;if(visits>25000000)throw new Error('不平衡主体导致实际处理超过 2,500 万行预算，请减少重复次数。');for(const r of picked)sample.push(r);}}
    else for(const group of units)for(let j=0;j<group.length;j++)sample.push(group[Math.floor(random()*group.length)]);
    const value=estimate(sample);if(Number.isFinite(value))draws.push(value);replicates.push([b+1,Number.isFinite(value)?value:null,sample.length]);
  }
  if(draws.length<iterations*.95)throw new Error(`有效重抽样 ${draws.length}/${iterations}，不足 95%，未报告区间。请检查主体数、稀少组或常量列。`);
  const sorted=draws.slice().sort((a,b)=>a-b),low=quantile(sorted,.025),high=quantile(sorted,.975);
  result.metrics=[['原样本估计',observed],['Bootstrap 标准误',Math.sqrt(ss(draws)/(draws.length-1))],['百分位 95% 下限',low],['百分位 95% 上限',high],['计划重复次数',iterations],['有效重复次数',draws.length],['无定义重复次数',iterations-draws.length],['重抽样主体数',unit==='cluster'?clusters.size:null]];
  result.tables=[table('重抽样统计量',['重复编号','统计量（无定义为空）','抽样行数'],replicates,true)];
  result.context+=`；统计量 ${statistic}${statistic==='difference'?`（${groups[0]} − ${groups[1]}）`:statistic==='paired-difference'?'（第一列 − 第二列）':''}；${unit==='cluster'?`主体 ${c.bootstrapCluster}`:statistic==='difference'?'组内独立行':'独立行'}有放回抽样；LCG 种子 ${c.seed}；百分位 type-7 区间`;
  result.warnings.push('百分位 Bootstrap 不是 BCa，也不提供假设检验 p 值；小样本、少主体、极端值或非独立记录可能使区间不可靠。','主体抽样估计仍按行加权，不自动改为各主体等权；时间序列相关需专门的区块重抽样。');return result;
}
