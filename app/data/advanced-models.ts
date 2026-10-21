import {Matrix} from 'ml-matrix';
import {studentTPValue,type DataSet} from '../stats';
import {criticalT95} from './multiple-regression';
import {baseResult,decomposition,mean,normalP,ss,standardize,type CompleteRow} from './advanced-math';
import type {AdvancedConfig,AdvancedTable} from './advanced-config';

const table=(title:string,headers:string[],rows:AdvancedTable['rows'],observationLevel=false):AdvancedTable=>({title,headers,rows,observationLevel});
export function clusteredRegression(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const result=baseResult(data,c,rows),n=rows.length,k=c.predictors.length,fixed=c.method==='fixed';
  const groups=new Map<string,number[]>();rows.forEach((r,i)=>{const a=groups.get(r.group)??[];a.push(i);groups.set(r.group,a);});
  const g=groups.size,p=fixed?k:k+1,df=n-(fixed?g+k:p);
  if(g<2||df<1)throw new Error('至少需要 2 个有效聚类，且扣除解释变量与固定效应后须有正残差自由度。');
  const xScale=standardize(rows.map(r=>c.predictors.map(h=>r.values[h]))),ys=standardize(rows.map(r=>[r.values[c.outcome]]));
  const y=ys.z.map(r=>r[0]),x=xScale.z.map(r=>fixed?[...r]:[1,...r]);
  const groupMeanY=new Map<string,number>(),groupMeanX=new Map<string,number[]>();
  if(fixed)for(const [key,indices] of groups){
    const my=mean(indices.map(i=>y[i])),mx=Array.from({length:k},(_,j)=>mean(indices.map(i=>x[i][j])));groupMeanY.set(key,my);groupMeanX.set(key,mx);
    for(const i of indices){y[i]-=my;for(let j=0;j<k;j++)x[i][j]-=mx[j];}
  }
  if(fixed&&c.predictors.some((_,j)=>ss(x.map(r=>r[j]),0)<1e-20))throw new Error('有解释变量在主体内部没有变动，固定效应不能识别它。');
  const design=new Matrix(x),{qr,bread}=decomposition(design),beta=qr.solve(Matrix.columnVector(y));
  const fitted=design.mmul(beta).to1DArray(),e=y.map((v,i)=>v-fitted[i]),sse=ss(e,0);
  if(sse<=ss(y,0)*1e-24||!Number.isFinite(sse))throw new Error('模型几乎完全拟合或数值溢出，无法可靠估计聚类误差。');
  const meat=Matrix.zeros(p,p);
  for(const indices of groups.values()){
    const score=Array(p).fill(0) as number[];for(const i of indices)for(let j=0;j<p;j++)score[j]+=x[i][j]*e[i];
    for(let j=0;j<p;j++)for(let h=0;h<p;h++)meat.set(j,h,meat.get(j,h)+score[j]*score[h]);
  }
  // CR1 finite sample correction counts absorbed entity parameters as well as slopes.
  const covariance=bread.mmul(meat).mmul(bread).mul(g/(g-1)*(n-1)/df),transform=Matrix.zeros(p,p);
  if(fixed){for(let j=0;j<k;j++)transform.set(j,j,ys.scales[0]/xScale.scales[j]);}
  else{
    transform.set(0,0,ys.scales[0]);for(let j=1;j<p;j++){transform.set(0,j,-xScale.means[j-1]*ys.scales[0]/xScale.scales[j-1]);transform.set(j,j,ys.scales[0]/xScale.scales[j-1]);}
  }
  const estimates=transform.mmul(beta).to1DArray();if(!fixed)estimates[0]+=ys.means[0];
  const cov=transform.mmul(covariance).mmul(transform.transpose()),critical=criticalT95(g-1);
  result.tables=[table('回归系数',['变量','系数','CR1 标准误','t','双侧 p','95% 下限','95% 上限'],estimates.map((b,j)=>{
    const se=cov.get(j,j)>0?Math.sqrt(cov.get(j,j)):null,t=se?b/se:null;
    return [fixed?c.predictors[j]:j===0?'截距':c.predictors[j-1],b,se,t,t===null?null:studentTPValue(t,g-1),se===null?null:b-critical*se,se===null?null:b+critical*se];
  }))];
  const denom=fixed?ss(y,0):ss(y),r2=denom>0?1-sse/denom:null;
  result.metrics=[['聚类数',g],['残差自由度',df],['t 参考自由度',g-1],[fixed?'个体内 R²':'R²',r2],['残差标准误',Math.sqrt(sse/df)*ys.scales[0]]];
  result.context+=`；单向 CR1；修正 G/(G−1)×(N−1)/残差自由度；t(${g-1})`;
  if(g<30)result.warnings.push('聚类少于 30，常规聚类渐近推断可能不可靠；30 仅为经验提醒，不保证超过后即可靠。');
  if(g<=p)result.warnings.push('聚类数不超过报告系数数，聚类协方差可能秩亏；不提供联合 Wald 检验。');
  const singleton=[...groups.values()].filter(a=>a.length===1).length;if(fixed&&singleton)result.warnings.push(`有 ${singleton} 个单次观测主体，不提供个体内斜率信息；保留并计入自由度与 CR1 修正。`);
  result.tables.push(table('逐行拟合',['观测行（表头不计）','主体','观测值','拟合值','残差'],rows.map((r,i)=>{
    const f=ys.means[0]+ys.scales[0]*(fitted[i]+(fixed?groupMeanY.get(r.group)!:0));return [r.row,r.group,r.values[c.outcome],f,ys.scales[0]*e[i]];
  }),true));
  if(fixed)result.tables.push(table('主体截距',['主体','观测数','估计截距'],[...groups].map(([key,indices])=>[key,indices.length,ys.means[0]+ys.scales[0]*groupMeanY.get(key)!-c.predictors.reduce((s,_,j)=>s+estimates[j]*(xScale.means[j]+xScale.scales[j]*groupMeanX.get(key)![j]),0)])));
  return result;
}

const sigmoid=(z:number)=>z>=0?1/(1+Math.exp(-z)):Math.exp(z)/(1+Math.exp(z));
const log1pexp=(z:number)=>Math.max(0,z)+Math.log1p(Math.exp(-Math.abs(z)));
export function logisticRegression(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const result=baseResult(data,c,rows),n=rows.length,p=c.predictors.length+1,y=rows.map(r=>r.values[c.outcome]);
  if(y.some(v=>v!==0&&v!==1)||!y.includes(0)||!y.includes(1))throw new Error('Logistic 因变量必须只含 0 与 1，且两类均存在；请先明确编码。');
  if(n<=p)throw new Error('有效观测数必须大于含截距的参数数。');
  const scale=standardize(rows.map(r=>c.predictors.map(h=>r.values[h]))),x=scale.z.map(r=>[1,...r]),design=new Matrix(x);decomposition(design);
  const prevalence=mean(y);let beta=[Math.log(prevalence/(1-prevalence)),...Array(p-1).fill(0)] as number[],iterations=0,converged=false;
  const loss=(b:number[])=>x.reduce((s,r,i)=>{const eta=r.reduce((v,a,j)=>v+a*b[j],0);return s+log1pexp(eta)-y[i]*eta;},0);
  for(let iteration=0;iteration<100;iteration++){
    const eta=x.map(r=>r.reduce((s,v,j)=>s+v*beta[j],0)),mu=eta.map(sigmoid),w=mu.map(v=>v*(1-v));
    if(w.some(v=>v<1e-12))throw new Error('出现极端拟合概率，可能存在完全/准完全分离或数值不稳定；未报告推断，请检查编码与模型。');
    const weighted=new Matrix(x.map((r,i)=>r.map(v=>v*Math.sqrt(w[i])))),{qr}=decomposition(weighted);
    const delta=qr.solve(Matrix.columnVector(y.map((v,i)=>(v-mu[i])/Math.sqrt(w[i])))).to1DArray(),old=loss(beta);
    let step=1,next=beta.map((v,j)=>v+delta[j]);while(loss(next)>old+1e-10&&step>1e-8){step/=2;next=beta.map((v,j)=>v+step*delta[j]);}
    if(step<=1e-8)throw new Error('Logistic 迭代无法稳定下降；请检查分离、共线性和量级。');
    beta=next;iterations=iteration+1;
    if(delta.every(v=>Math.abs(v*step)<1e-9)){converged=true;break;}
  }
  if(!converged)throw new Error('Logistic 在 100 次迭代内未收敛，未输出不可靠系数。');
  const probabilities=x.map(r=>sigmoid(r.reduce((s,v,j)=>s+v*beta[j],0)));
  if(probabilities.some(v=>v*(1-v)<1e-12))throw new Error('拟合处于分离或极端概率边界，无法稳定推断。');
  const weighted=new Matrix(x.map((r,i)=>r.map(v=>v*Math.sqrt(probabilities[i]*(1-probabilities[i]))))),{bread}=decomposition(weighted),transform=Matrix.zeros(p,p);transform.set(0,0,1);
  for(let j=1;j<p;j++){transform.set(j,j,1/scale.scales[j-1]);transform.set(0,j,-scale.means[j-1]/scale.scales[j-1]);}
  const estimates=transform.mmul(Matrix.columnVector(beta)).to1DArray(),cov=transform.mmul(bread).mmul(transform.transpose()),critical=1.959963984540054;
  result.tables=[table('Logistic 系数与优势比',['变量','系数（log odds）','标准误','z','双侧 p','系数 95% 下限','系数 95% 上限','OR','OR 95% 下限','OR 95% 上限'],estimates.map((b,j)=>{
    const se=Math.sqrt(cov.get(j,j)),low=b-critical*se,high=b+critical*se;return [j===0?'截距':c.predictors[j-1],b,se,b/se,normalP(b/se),low,high,Number.isFinite(Math.exp(b))?Math.exp(b):null,Number.isFinite(Math.exp(low))?Math.exp(low):null,Number.isFinite(Math.exp(high))?Math.exp(high):null];
  })),table('逐行预测',['观测行（表头不计）','实际 0/1','预测 P(Y=1)'],rows.map((r,i)=>[r.row,y[i],probabilities[i]]),true)];
  const ll=-loss(beta),nullLL=n*(prevalence*Math.log(prevalence)+(1-prevalence)*Math.log1p(-prevalence));
  result.metrics=[['Y=1 数量',y.reduce((s,v)=>s+v,0)],['迭代次数',iterations],['对数似然',ll],['McFadden 伪 R²',1-ll/nullLL],['AIC',2*p-2*ll]];
  result.context+='；无惩罚最大似然；常规模型协方差；正态 Wald 95% 区间';
  result.warnings.push('OR 是优势之比，不是概率之比。伪 R² 不能与 OLS R² 直接比较；这里的逐行概率来自样本内拟合，不代表预测验证。');
  if(Math.min(y.reduce((s,v)=>s+v,0),n-y.reduce((s,v)=>s+v,0))<10*p)result.warnings.push('较少类别的观测数相对参数较少，最大似然和 Wald 区间可能不稳定；请考虑专业的小样本或惩罚方法。');
  return result;
}
