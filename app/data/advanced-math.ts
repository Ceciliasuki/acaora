import {Matrix,QrDecomposition,SingularValueDecomposition} from 'ml-matrix';
import {isMissing,logGamma,regularizedBeta,studentTPValue,type DataSet} from '../stats';
import {criticalT95} from './multiple-regression';
import {ADVANCED_ENGINE,advancedMethods,requiredColumns,usesGroup,type AdvancedConfig,type AdvancedResult,type AdvancedTable} from './advanced-config';
import {validCategories} from './categorical-design';

export const mean=(x:number[])=>x.reduce((s,v)=>s+v,0)/x.length;
export const ss=(x:number[],m=mean(x))=>x.reduce((s,v)=>s+(v-m)**2,0);
const table=(title:string,headers:string[],rows:AdvancedTable['rows'],observationLevel=false):AdvancedTable=>({title,headers,rows,observationLevel});
// Regularized upper incomplete gamma: convergent series below a+1, continued fraction above.
export function gammaQ(a:number,x:number){
  if(x===0)return 1;if(!Number.isFinite(x))return x===Infinity?0:NaN;
  const front=Math.exp(a*Math.log(x)-x-logGamma(a));
  if(x<a+1){let term=1/a,sum=term;for(let i=1;i<1000;i++){term*=x/(a+i);sum+=term;if(Math.abs(term)<Math.abs(sum)*1e-14)break;}return Math.max(0,Math.min(1,1-front*sum));}
  let b=x+1-a,c=1e300,d=1/b,h=d;
  for(let i=1;i<1000;i++){const an=-i*(i-a);b+=2;d=an*d+b;if(Math.abs(d)<1e-300)d=1e-300;c=b+an/c;if(Math.abs(c)<1e-300)c=1e-300;d=1/d;const delta=d*c;h*=delta;if(Math.abs(delta-1)<1e-14)break;}
  return Math.max(0,Math.min(1,front*h));
}
export const normalP=(z:number)=>gammaQ(.5,z*z/2);
export function rank(values:number[]){
  const order=values.map((v,i)=>({v,i})).sort((a,b)=>a.v-b.v),ranks=Array(values.length).fill(0) as number[];let ties=0;
  for(let i=0;i<order.length;){let j=i+1;while(j<order.length&&order[j].v===order[i].v)j++;const t=j-i;ties+=t**3-t;for(let k=i;k<j;k++)ranks[order[k].i]=(i+1+j)/2;i=j;}
  return {ranks,ties};
}
export function rng(seed:number){let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function shuffledFolds(n:number,k:number,seed:number){
  const random=rng(seed),indices=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
  const folds=Array(n).fill(0) as number[];let offset=0;for(let f=0;f<k;f++){const size=Math.floor(n/k)+(f<n%k?1:0);for(let i=0;i<size;i++)folds[indices[offset++]]=f;}
  return folds;
}
export type CompleteRow={row:number;values:Record<string,number>;group:string;categories?:Record<string,string>};
export function completeRows(data:DataSet,c:AdvancedConfig){
  if(!advancedMethods.some(m=>m.id===c.method))throw new Error('未知的分析方法。');
  if(new Set(data.headers).size!==data.headers.length)throw new Error('数据有重复列名，请重新导入。');
  const required=requiredColumns(c);
  if(required.some(h=>!h||!data.headers.includes(h))||new Set(required).size!==required.length)throw new Error('请选择当前数据中不同且有效的变量。');
  const usesPredictors=['cluster','fixed','logistic','pca','kmeans','cv','classification'].includes(c.method);
  const cats=c.categoricals??[];if(!validCategories(cats))throw new Error('分类变量或参考组无效。');
  if(cats.length&&!['logistic','cluster','fixed','cv','classification'].includes(c.method))throw new Error('此方法不支持分类解释变量。');
  if(usesPredictors&&(c.predictors.length+cats.length<1||c.predictors.length+cats.length>12))throw new Error('请选择 1 至 12 个不同数值/分类解释变量。');
  if(!Number.isInteger(c.seed)||c.seed<0||c.seed>4294967295)throw new Error('随机种子须为 0 至 4294967295 的整数。');
  if(c.validation!==undefined&&!['random','group','time'].includes(c.validation))throw new Error('未知的交叉验证划分方式。');
  const grouped=usesGroup(c);
  const limit=['kmeans','classification'].includes(c.method)?10000:c.method==='bootstrap'?20000:50000,indices=required.map(h=>data.headers.indexOf(h)),rows:CompleteRow[]=[];
  for(let i=0;i<data.rows.length;i++){
    const raw=indices.map(j=>data.rows[i][j]??'');
    const text=(h:string)=>(grouped&&h===c.group)||cats.some(v=>v.name===h)||(c.method==='bootstrap'&&c.bootstrapUnit==='cluster'&&h===c.bootstrapCluster);
    if(raw.some((v,j)=>isMissing(v)||(!text(required[j])&&!Number.isFinite(Number(v)))))continue;
    const values:Record<string,number>=Object.create(null),categories:Record<string,string>=Object.create(null);required.forEach((h,j)=>{if(!text(h))values[h]=Number(raw[j]);else categories[h]=raw[j].trim();});
    rows.push({row:i+1,values,group:grouped?(data.rows[i][data.headers.indexOf(c.group)]??'').trim():'',...((cats.length||c.method==='bootstrap')?{categories}:{})});
    if(rows.length>limit)throw new Error(`本方法最多支持 ${limit.toLocaleString('zh-CN')} 个完整观测，不会自动抽样。`);
  }
  if(rows.length<3)throw new Error('至少需要 3 个完整有效观测。');return rows;
}
export function standardize(rows:number[][]){
  const means=rows[0].map((_,j)=>mean(rows.map(r=>r[j]))),scales=means.map((m,j)=>Math.sqrt(ss(rows.map(r=>r[j]),m)/(rows.length-1)));
  if(means.some(v=>!Number.isFinite(v))||scales.some(s=>!Number.isFinite(s)||s<=0))throw new Error('存在无变动或数值范围过大的变量，请调整所选变量。');
  return {means,scales,z:rows.map(r=>r.map((v,j)=>(v-means[j])/scales[j]))};
}
export function decomposition(x:Matrix){
  const singular=new SingularValueDecomposition(x,{computeLeftSingularVectors:false,computeRightSingularVectors:false}).diagonal;
  if(x.rows<x.columns||!Number.isFinite(singular[0]/singular.at(-1)!)||singular[0]/singular.at(-1)!>=1e10)throw new Error('设计矩阵存在完全或近乎完全共线性。');
  const qr=new QrDecomposition(x),rInverse=new QrDecomposition(qr.upperTriangularMatrix).solve(Matrix.eye(x.columns));
  return {qr,bread:rInverse.mmul(rInverse.transpose())};
}
export function baseResult(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]):AdvancedResult{
  return {method:c.method,source:data.name,n:rows.length,excluded:data.rows.length-rows.length,context:`变量：${requiredColumns(c).join('、')}；完整观测整行排除；引擎 ${ADVANCED_ENGINE}`,metrics:[],tables:[],warnings:[],config:structuredClone(c)};
}
export function testMethods(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const result=baseResult(data,c,rows),n=rows.length;
  if(c.method==='paired'||c.method==='wilcoxon'){
    const d=rows.map(r=>r.values[c.outcome]-r.values[c.second]);if(d.some(v=>!Number.isFinite(v)))throw new Error('配对差值溢出，请调整量级。');
    if(c.method==='paired'){
      const m=mean(d),sd=Math.sqrt(ss(d,m)/(n-1));if(!Number.isFinite(sd)||sd<=0)throw new Error('配对差值没有变动，无法估计 t 检验误差。');
      const se=sd/Math.sqrt(n),t=m/se,critical=criticalT95(n-1);result.metrics=[['平均差（第一列−第二列）',m],['差值标准差',sd],['t',t],['自由度',n-1],['双侧 p',studentTPValue(t,n-1)],['95% 下限',m-critical*se],['95% 上限',m+critical*se],['配对效应量 dz',m/sd]];
    }else{
      const nonzero=d.filter(v=>v!==0),m=nonzero.length;if(m<2)throw new Error('去除零差后至少需要 2 个配对。');const {ranks,ties}=rank(nonzero.map(Math.abs));
      const plus=ranks.reduce((s,r,i)=>s+(nonzero[i]>0?r:0),0),minus=m*(m+1)/2-plus,variance=m*(m+1)*(2*m+1)/24-ties/48;
      if(variance<=0)throw new Error('符号秩方差为零，无法检验。');const delta=plus-m*(m+1)/4,z=(delta-Math.sign(delta)*.5)/Math.sqrt(variance);
      result.metrics=[['非零配对 N',m],['零差排除',n-m],['W（较小秩和）',Math.min(plus,minus)],['正秩和',plus],['负秩和',minus],['z',z],['双侧近似 p',normalP(z)],['秩二列相关（配对）',(plus-minus)/(plus+minus)]];
      result.warnings.push('使用去零差的 Wilcox 规则、并列秩与连续性校正；小样本的正态近似可能不准确，不是精确检验。');
    }
    result.tables=[table('配对差值',['观测行（表头不计）',c.outcome,c.second,'第一列−第二列'],rows.map((r,i)=>[r.row,r.values[c.outcome],r.values[c.second],d[i]]),true)];return result;
  }
  const groups=new Map<string,number[]>();for(const row of rows){const a=groups.get(row.group)??[];a.push(row.values[c.outcome]);groups.set(row.group,a);}
  const samples=[...groups],k=samples.length;if(k<2||k>100||samples.some(([,v])=>v.length<2))throw new Error('需有 2 至 100 个组，且每组至少 2 个完整观测。');
  result.tables=[table('各组摘要',['组','N','均值','样本标准差'],samples.map(([g,v])=>[g,v.length,mean(v),Math.sqrt(ss(v)/(v.length-1))]))];
  if(c.method==='anova'){
    const grand=mean(rows.map(r=>r.values[c.outcome])),between=samples.reduce((s,[,v])=>s+v.length*(mean(v)-grand)**2,0),within=samples.reduce((s,[,v])=>s+ss(v),0);
    if(!Number.isFinite(within)||within<=0||!Number.isFinite(between))throw new Error('组内变动为零或平方和溢出，无法计算 ANOVA。');const f=(between/(k-1))/(within/(n-k));
    result.metrics=[['F',f],['组间自由度',k-1],['组内自由度',n-k],['p',regularizedBeta((n-k)/(n-k+(k-1)*f),(n-k)/2,(k-1)/2)],['η²',between/(between+within)]];
    result.tables.push(table('方差分解',['来源','平方和','自由度','均方'],[['组间',between,k-1,between/(k-1)],['组内',within,n-k,within/(n-k)]]));
  }else if(c.method==='welchanova'){
    const variances=samples.map(([,v])=>ss(v)/(v.length-1));
    if(variances.some(v=>!Number.isFinite(v)||v<=0))throw new Error('Welch ANOVA 要求每组有正且有限的样本方差；请检查常量组与数值量级。');
    const weights=samples.map(([,v],i)=>v.length/variances[i]),sum=weights.reduce((s,v)=>s+v,0),weightedMean=weights.reduce((s,w,i)=>s+w*mean(samples[i][1]),0)/sum;
    const correction=samples.reduce((s,[,v],i)=>s+(1-weights[i]/sum)**2/(v.length-1),0),f=weights.reduce((s,w,i)=>s+w*(mean(samples[i][1])-weightedMean)**2,0)/(k-1)/(1+2*(k-2)/(k*k-1)*correction),df=(k*k-1)/(3*correction);
    result.metrics=[['Welch F',f],['分子自由度',k-1],['分母自由度',df],['p',regularizedBeta(df/(df+(k-1)*f),df/2,(k-1)/2)]];
    result.context+='；Welch–Satterthwaite 自由度；允许组间方差不同';
  }else{
    if(k!==2)throw new Error('Mann–Whitney U 检验需要恰好两个有效组。');const [a,b]=samples.map(([,v])=>v),{ranks,ties}=rank([...a,...b]);
    const u=ranks.slice(0,a.length).reduce((s,v)=>s+v,0)-a.length*(a.length+1)/2,variance=a.length*b.length/12*((n+1)-ties/(n*(n-1)));
    if(variance<=0)throw new Error('全部观测同值，无法计算秩检验。');const delta=u-a.length*b.length/2,z=Math.max(0,Math.abs(delta)-.5)/Math.sqrt(variance);
    result.context+=`；第一组 ${samples[0][0]}；第二组 ${samples[1][0]}`;
    result.metrics=[['第一组 U',u],['第二组 U',a.length*b.length-u],['|z|',z],['双侧近似 p',normalP(z)],['秩二列相关（第一组较大为正）',2*u/(a.length*b.length)-1]];
    result.warnings.push('采用并列秩与连续性校正的正态近似；小样本应另外使用精确或置换方法复核。');
  }
  return result;
}
