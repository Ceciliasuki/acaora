import {studentTPValue,type DataSet} from '../stats';
import {baseResult,mean,ss,type CompleteRow} from './advanced-math';
import {criticalT95} from './multiple-regression';
import type {AdvancedConfig} from './advanced-config';
export function holmAdjust(probabilities:number[]){
  if(probabilities.some(p=>!Number.isFinite(p)||p<0||p>1))throw new Error('比较族含无效 p 值，未执行 Holm 校正。');
  const order=probabilities.map((p,i)=>({p,i})).sort((a,b)=>a.p-b.p),adjusted=Array(probabilities.length).fill(0) as number[];let previous=0;
  order.forEach(({p,i},rank)=>{previous=Math.min(1,Math.max(previous,p*(order.length-rank)));adjusted[i]=previous;});return adjusted;
}
export function pairwiseWelch(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const result=baseResult(data,c,rows),grouped=new Map<string,number[]>();for(const r of rows){const values=grouped.get(r.group)??[];values.push(r.values[c.outcome]);grouped.set(r.group,values);}
  const names=[...grouped.keys()].sort(),groups=names.map(name=>{const values=grouped.get(name)!,m=mean(values);return {name,n:values.length,mean:m,variance:ss(values,m)/(values.length-1)};});
  if(groups.length<2||groups.length>12||groups.some(g=>g.n<2||!Number.isFinite(g.variance)||g.variance<=0))throw new Error('成对 Welch 需要 2–12 个有效组，每组至少两行且样本方差正且有限。');
  const family=c.posthocFamily??'all';if(!['all','reference'].includes(family))throw new Error('未知的比较范围。');
  if(family==='reference'&&!names.includes(c.posthocReference??''))throw new Error('完整观测中未找到比较参考组，请重新选择。');
  const pairs:Array<[typeof groups[number],typeof groups[number]]>=[];
  if(family==='reference'){const reference=groups.find(g=>g.name===c.posthocReference)!;for(const g of groups)if(g!==reference)pairs.push([g,reference]);}
  else for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++)pairs.push([groups[i],groups[j]]);
  const estimates=pairs.map(([a,b])=>{const v1=a.variance/a.n,v2=b.variance/b.n,se=Math.sqrt(v1+v2),df=(v1+v2)**2/(v1*v1/(a.n-1)+v2*v2/(b.n-1)),difference=a.mean-b.mean,t=difference/se,critical=criticalT95(df);return {a,b,se,df,difference,t,p:studentTPValue(t,df),low:difference-critical*se,high:difference+critical*se};});
  const adjusted=holmAdjust(estimates.map(e=>e.p));result.metrics=[['比较族内检验数',pairs.length],['α',.05],['Holm 校正后拒绝数',adjusted.filter(p=>p<=.05).length]];
  result.context+=`；${family==='all'?`全部 ${names.join('、')} 组间比较`:`各组对参考组 ${c.posthocReference}`}；同一比较族 ${pairs.length} 次双侧 Welch；Holm FWER α=0.05`;
  result.tables=[{title:'各组摘要',headers:['组','N','均值','样本标准差'],rows:groups.map(g=>[g.name,g.n,g.mean,Math.sqrt(g.variance)])},{title:'成对比较与 Holm 校正',headers:['组 A','组 B','N A','N B','均差 A−B','标准误','t','Welch 自由度','原始 p','Holm 校正 p','95% 下限（未调整）','95% 上限（未调整）','Holm α=0.05 拒绝 H0'],rows:estimates.map((e,i)=>[e.a.name,e.b.name,e.a.n,e.b.n,e.difference,e.se,e.t,e.df,e.p,adjusted[i],e.low,e.high,adjusted[i]<=.05?'是':'否'])}];
  result.warnings.push('Holm 校正只覆盖本次指定的比较族；逐对 95% 区间未经多重比较调整。非拒绝不证明两组等价，整体或成对差异均不自动成为因果效应。');return result;
}
