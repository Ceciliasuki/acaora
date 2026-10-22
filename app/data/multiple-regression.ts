import {Matrix,QrDecomposition,SingularValueDecomposition} from 'ml-matrix';
import {isMissing,studentTPValue,type DataSet} from '../stats';
import {MAX_REGRESSION_ROWS,regressionConfigErrors,type RegressionConfig} from './regression-config';
import {expandCategoricalData,encodingDescription,type CategoryEncoding} from './categorical-design';
export type RegressionCoefficient={name:string;estimate:number;se:number|null;t:number|null;p:number|null;low:number|null;high:number|null;vif:number|null};
export type RegressionObservation={row:number;fitted:number;residual:number;standardizedResidual:number|null;leverage:number;cook:number|null};
export type RegressionFit={config:RegressionConfig;source:string;totalRows:number;n:number;excluded:number;parameters:number;dfResidual:number;r2:number;adjustedR2:number;rmse:number;condition:number;coefficients:RegressionCoefficient[];observations:RegressionObservation[];warnings:string[];encoding?:CategoryEncoding};
const finite=(value:number)=>Number.isFinite(value)?value:null;
function moments(values:number[]){
  let mean=0,m2=0,n=0;for(const value of values){n++;const delta=value-mean;mean+=delta/n;m2+=delta*(value-mean);}
  return {mean,sd:Math.sqrt(m2/(n-1)),m2};
}
export function criticalT95(df:number){
  if(!Number.isFinite(df)||df<=0)throw new Error('残差自由度必须为正数。');
  let low=0,high=1;while(studentTPValue(high,df)>.05&&high<1e8)high*=2;
  for(let i=0;i<90;i++){const mid=(low+high)/2;if(studentTPValue(mid,df)>.05)low=mid;else high=mid;}
  return (low+high)/2;
}
export function fitMultipleRegression(data:DataSet,config:RegressionConfig):RegressionFit{
  const errors=regressionConfigErrors(data,config);if(errors.length)throw new Error(errors.join(''));
  if(config.categoricals?.length){
    const numeric=[config.outcome,...config.predictors].map(h=>data.headers.indexOf(h)),cats=config.categoricals;
    const eligible=data.rows.flatMap((r,i)=>{
      if(numeric.some(j=>isMissing(r[j]??'')||!Number.isFinite(Number(r[j]))))return [];
      const categories:Record<string,string>=Object.create(null);for(const c of cats){const v=(r[data.headers.indexOf(c.name)]??'').trim();if(isMissing(v))return [];categories[c.name]=v;}return [{row:i+1,categories}];
    });
    const expanded=expandCategoricalData(data,cats,config.predictors.length,eligible),encoded={...config,predictors:[...config.predictors,...expanded.encoding.columns.map(c=>c.key)]};delete encoded.categoricals;
    const fit=fitMultipleRegression(expanded.data,encoded),labels=new Map(expanded.encoding.columns.map(c=>[c.key,c.label]));
    fit.config=structuredClone(config);fit.encoding=expanded.encoding;fit.coefficients=fit.coefficients.map(c=>({...c,name:labels.get(c.name)??c.name}));fit.warnings.push(`分类变量采用哑变量编码，参考组：${encodingDescription(cats)}。`);return fit;
  }
  if(new Set(data.headers).size!==data.headers.length)throw new Error('存在重复列名，请重新导入数据。');
  const names=[config.outcome,...config.predictors],indices=names.map(name=>data.headers.indexOf(name));
  const rows:Array<{row:number;values:number[]}>=[];
  for(let i=0;i<data.rows.length;i++){
    const raw=indices.map(index=>data.rows[i][index]??'');
    if(raw.some(value=>isMissing(value)||!Number.isFinite(Number(value))))continue;
    rows.push({row:i+1,values:raw.map(Number)});
    if(rows.length>MAX_REGRESSION_ROWS)throw new Error(`有效观测超过 ${MAX_REGRESSION_ROWS.toLocaleString('zh-CN')} 行，请使用较小的数据。本工具不会自动抽样拟合。`);
  }
  const n=rows.length,p=config.predictors.length+1,df=n-p;
  if(df<1)throw new Error(`完整有效观测为 ${n} 行，模型有 ${p} 个参数；需要更多观测或更少解释变量。`);
  const stats=names.map((name,j)=>({name,...moments(rows.map(row=>row.values[j]))}));
  for(const stat of stats)if(!Number.isFinite(stat.sd)||stat.sd<=0||!Number.isFinite(stat.mean))throw new Error(`“${stat.name}”在完整观测中没有变动，或数值范围无法稳定计算。`);
  const [response,...predictorStats]=stats;
  const design=new Matrix(rows.map(row=>[1,...predictorStats.map((stat,j)=>(row.values[j+1]-stat.mean)/stat.sd)]));
  const y=Matrix.columnVector(rows.map(row=>(row.values[0]-response.mean)/response.sd));
  const svd=new SingularValueDecomposition(design,{computeLeftSingularVectors:false,computeRightSingularVectors:false});
  const singular=svd.diagonal,condition=singular[0]/singular[singular.length-1];
  if(!Number.isFinite(condition)||condition>=1e10)throw new Error('解释变量存在完全或近乎完全共线性，无法唯一、稳定地估计模型。请检查重复列或线性组合。');
  const qr=new QrDecomposition(design),gamma=qr.solve(y),q=qr.orthogonalMatrix;
  const rInverse=new QrDecomposition(qr.upperTriangularMatrix).solve(Matrix.eye(p));
  const bread=rInverse.mmul(rInverse.transpose());
  const fittedZ=design.mmul(gamma).to1DArray();
  const residualZ=rows.map((row,i)=>y.get(i,0)-fittedZ[i]);
  const sse=residualZ.reduce((sum,e)=>sum+e*e,0),mse=sse/df;
  if(!Number.isFinite(sse))throw new Error('残差数值溢出，无法报告可靠结果。请检查变量量级。');
  const leverages=rows.map((_,i)=>{let h=0;for(let j=0;j<p;j++)h+=q.get(i,j)**2;return Math.max(0,Math.min(1,h));});
  const perfect=sse<=(n-1)*1e-24;
  const highLeverage=leverages.some(h=>1-h<=1e-10);
  const warnings:string[]=[];
  if(perfect)warnings.push('模型几乎完全拟合，无法可靠估计误差变动；暂不报告标准误、t、p 与置信区间。');
  if(highLeverage&&config.standardErrors==='HC3')warnings.push('存在杠杆值接近 1 的观测，HC3 无法稳定计算；暂不报告标准误与区间。');
  if(n<10*p)warnings.push('完整观测数相对模型参数较少，区间与诊断可能不稳定；请结合研究设计判断。');
  if(condition>1000)warnings.push('标准化设计矩阵的条件数较大，请检查近似共线性。');
  let covariance:Matrix|null=null;
  if(!perfect&&!(highLeverage&&config.standardErrors==='HC3')){
    if(config.standardErrors==='classical')covariance=bread.clone().mul(mse);
    else{
      const meat=Matrix.zeros(p,p);
      for(let i=0;i<n;i++){
        const weight=(residualZ[i]/(1-leverages[i]))**2;
        for(let j=0;j<p;j++)for(let k=0;k<p;k++)meat.set(j,k,meat.get(j,k)+weight*design.get(i,j)*design.get(i,k));
      }
      covariance=bread.mmul(meat).mmul(bread);
    }
  }
  // Restore original units after fitting a centered/scaled design; no normal-equation inversion.
  const transform=Matrix.zeros(p,p);transform.set(0,0,response.sd);
  for(let j=1;j<p;j++){transform.set(0,j,-predictorStats[j-1].mean*response.sd/predictorStats[j-1].sd);transform.set(j,j,response.sd/predictorStats[j-1].sd);}
  const coefficients=transform.mmul(gamma).to1DArray();coefficients[0]+=response.mean;
  if(coefficients.some(value=>!Number.isFinite(value)))throw new Error('原始单位下的系数无法稳定计算，请检查变量量级。');
  const originalCovariance=covariance?transform.mmul(covariance).mmul(transform.transpose()):null;
  const critical=criticalT95(df);
  const coefficientRows:RegressionCoefficient[]=coefficients.map((estimate,j)=>{
    const variance=originalCovariance?.get(j,j),se=variance!==undefined&&variance>0?finite(Math.sqrt(variance)):null;
    const t=se===null?null:finite(estimate/se),probability=t===null?null:finite(studentTPValue(t,df));
    return {name:j===0?'截距':config.predictors[j-1],estimate,se,t,p:probability,low:se===null?null:finite(estimate-critical*se),high:se===null?null:finite(estimate+critical*se),vif:j===0?null:finite((n-1)*bread.get(j,j))};
  });
  if(coefficientRows.some(row=>row.vif!==null&&row.vif>=10))warnings.push('有解释变量的 VIF ≥ 10。这是共线性经验提示，不应据此自动删除变量。');
  const observations=rows.map((row,i)=>({row:row.row,fitted:response.mean+response.sd*fittedZ[i],residual:response.sd*residualZ[i],leverage:leverages[i],standardizedResidual:perfect||1-leverages[i]<=1e-10?null:finite(residualZ[i]/Math.sqrt(mse*(1-leverages[i]))),cook:perfect||1-leverages[i]<=1e-10?null:finite(residualZ[i]**2/(p*mse)*leverages[i]/(1-leverages[i])**2)}));
  if(observations.some(row=>!Number.isFinite(row.fitted)||!Number.isFinite(row.residual)))throw new Error('拟合值或残差溢出，未返回模型。');
  const r2=Math.max(0,Math.min(1,1-sse/(n-1)));
  return {config:{...config,predictors:[...config.predictors]},source:data.name,totalRows:data.rows.length,n,excluded:data.rows.length-n,parameters:p,dfResidual:df,r2,adjustedR2:1-(1-r2)*(n-1)/df,rmse:Math.sqrt(mse)*response.sd,condition,coefficients:coefficientRows,observations,warnings};
}
