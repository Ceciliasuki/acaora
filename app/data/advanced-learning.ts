import {Matrix,SingularValueDecomposition} from 'ml-matrix';
import type {DataSet} from '../stats';
import {baseResult,decomposition,mean,rng,shuffledFolds,ss,standardize,type CompleteRow} from './advanced-math';
import type {AdvancedConfig,AdvancedTable} from './advanced-config';
import {fitCategoryEncoding,encodeCategoryRow} from './categorical-design';
const table=(title:string,headers:string[],rows:AdvancedTable['rows'],observationLevel=false):AdvancedTable=>({title,headers,rows,observationLevel});
export function pca(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const result=baseResult(data,c,rows),p=c.predictors.length,n=rows.length;
  if(p<2||n<=p)throw new Error('PCA 需要至少 2 个变量，完整观测数须大于变量数。');
  if(!Number.isInteger(c.components)||c.components<1||c.components>p)throw new Error('主成分数应为 1 至所选变量数的整数。');
  const scale=standardize(rows.map(r=>c.predictors.map(h=>r.values[h]))),x=new Matrix(scale.z),svd=new SingularValueDecomposition(x),v=svd.rightSingularVectors;
  // Fix arbitrary SVD signs by making the largest absolute weight positive.
  for(let j=0;j<p;j++){let pivot=0;for(let i=1;i<p;i++)if(Math.abs(v.get(i,j))>Math.abs(v.get(pivot,j)))pivot=i;if(v.get(pivot,j)<0)for(let i=0;i<p;i++)v.set(i,j,-v.get(i,j));}
  const eigen=svd.diagonal.map(s=>s*s/(n-1)),total=eigen.reduce((s,a)=>s+a,0),scores=x.mmul(v),names=Array.from({length:c.components},(_,i)=>`PC${i+1}`);let cumulative=0;
  result.metrics=[['变量数',p],['保留主成分数',c.components],['累计解释率',eigen.slice(0,c.components).reduce((s,a)=>s+a,0)/total]];
  result.tables=[table('解释方差',['主成分','特征值','解释率','累计解释率'],eigen.map((e,j)=>{cumulative+=e/total;return [`PC${j+1}`,e,e/total,cumulative];})),table('标准化主轴权重',['变量',...names],c.predictors.map((h,i)=>[h,...names.map((_,j)=>v.get(i,j))])),table('预处理参数',['变量','均值','样本标准差'],c.predictors.map((h,j)=>[h,scale.means[j],scale.scales[j]])),table('主成分得分',['观测行（表头不计）',...names],rows.map((r,i)=>[r.row,...names.map((_,j)=>scores.get(i,j))]),true)];
  if(eigen.some((e,i)=>i>0&&Math.abs(e-eigen[i-1])<1e-10*total))result.warnings.push('存在相近特征值，单个主轴方向可能不稳定，应解释对应的子空间。');return result;
}
const distance=(a:number[],b:number[])=>a.reduce((s,v,j)=>s+(v-b[j])**2,0);
export function kmeans(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const result=baseResult(data,c,rows),n=rows.length,k=c.clusters;
  if(!Number.isInteger(k)||k<2||k>12||k>=n)throw new Error('聚类数须为 2 至 12，且小于有效观测数。');
  const scale=standardize(rows.map(r=>c.predictors.map(h=>r.values[h]))),x=scale.z,random=rng(c.seed);let best:{centers:number[][];labels:number[];inertia:number;iterations:number}|null=null;
  for(let attempt=0;attempt<5;attempt++){
    let centers=[x[Math.floor(random()*n)].slice()];
    // Farthest point initialization, randomized first point; bounded and reproducible.
    while(centers.length<k){let index=0,max=-1;for(let i=0;i<n;i++){const d=Math.min(...centers.map(a=>distance(a,x[i])));if(d>max){max=d;index=i;}}if(max<=1e-20)throw new Error('不同观测模式少于聚类数，请减少 K。');centers.push(x[index].slice());}
    let labels=Array(n).fill(-1) as number[],valid=true,converged=false,iterations=0;
    for(let it=0;it<200;it++){
      const next=x.map(r=>{let closest=0;for(let j=1;j<k;j++)if(distance(r,centers[j])<distance(r,centers[closest]))closest=j;return closest;});
      const counts=Array(k).fill(0) as number[],sums=Array.from({length:k},()=>Array(c.predictors.length).fill(0) as number[]);next.forEach((label,i)=>{counts[label]++;x[i].forEach((v,j)=>{sums[label][j]+=v;});});
      if(counts.some(v=>v===0)){valid=false;break;}centers=sums.map((r,j)=>r.map(v=>v/counts[j]));iterations=it+1;
      if(next.every((v,i)=>v===labels[i])){labels=next;converged=true;break;}labels=next;
    }
    if(!valid||!converged)continue;const inertia=x.reduce((s,r,i)=>s+distance(r,centers[labels[i]]),0);if(best===null||inertia<best.inertia)best={centers,labels,inertia,iterations};
  }
  if(!best)throw new Error('5 次初始化均出现空组或未在 200 次内收敛；请减少 K 或调整变量。');
  const fit=best;result.metrics=[['聚类数',k],['组内平方和（标准化空间）',fit.inertia],['最佳运行迭代数',fit.iterations],['初始化次数',5]];
  result.context+=`；样本标准差标准化；种子 ${c.seed}；随机首点+最远点初始化 ×5；最多 200 次 Lloyd 迭代`;
  result.tables=[table('聚类中心（原始单位）',['聚类','N',...c.predictors],fit.centers.map((r,j)=>[j+1,fit.labels.filter(a=>a===j).length,...r.map((v,i)=>v*scale.scales[i]+scale.means[i])])),table('预处理参数',['变量','均值','样本标准差'],c.predictors.map((h,j)=>[h,scale.means[j],scale.scales[j]])),table('逐行聚类',['观测行（表头不计）','聚类','到中心的平方距离（标准化）'],rows.map((r,i)=>[r.row,fit.labels[i]+1,distance(x[i],fit.centers[fit.labels[i]])]),true)];
  result.warnings.push('5 次初始化仍不保证全局最优；组内平方和不能单独用于选 K，变量尺度、异常值与初始化会改变分组。');return result;
}
export function validationSplits(rows:CompleteRow[],c:AdvancedConfig){
  const n=rows.length,k=c.folds,p=c.predictors.length+1,mode=c.validation??'random';
  if(!Number.isInteger(k)||k<2||k>10||k>n)throw new Error('折数须为 2 至 10，且不超过有效观测数。');
  let folds:number[];
  if(mode==='group'){
    const groups=[...new Set(rows.map(r=>r.group))].sort();if(groups.length<k)throw new Error('有效主体数少于折数，请减少折数或核对主体字段。');
    const assignments=shuffledFolds(groups.length,k,c.seed),mapping=new Map(groups.map((g,i)=>[g,assignments[i]]));folds=rows.map(r=>mapping.get(r.group)!);
  }else if(mode==='time'){
    const times=[...new Set(rows.map(r=>r.values[c.time??'']))].sort((a,b)=>a-b);if(times.some(t=>!Number.isFinite(t))||times.length<k+1)throw new Error('时间前向验证至少需要折数 + 1 个不同数值时间点（年份或时间戳），请核对时间字段。');
    const mapping=new Map<number,number>();let offset=0;
    for(let chunk=0;chunk<k+1;chunk++){const size=Math.floor(times.length/(k+1))+(chunk<times.length%(k+1)?1:0);for(let i=0;i<size;i++)mapping.set(times[offset++],chunk-1);}
    folds=rows.map(r=>mapping.get(r.values[c.time??''])!);
  }else if(mode==='random')folds=shuffledFolds(n,k,c.seed);
  else throw new Error('未知的交叉验证划分方式。');
  const splits=Array.from({length:k},(_,f)=>{
    const train:number[]=[],held:number[]=[];for(let i=0;i<n;i++){if(folds[i]===f)held.push(i);else if(mode!=='time'||folds[i]<f)train.push(i);}
    if(train.length<=p||!held.length)throw new Error(`第 ${f+1} 折训练集仅 ${train.length} 行，必须大于 ${p} 个模型参数；请减少解释变量或调整折数。`);
    return {train,held};
  });return {folds,splits};
}
export function crossValidation(data:DataSet,c:AdvancedConfig,rows:CompleteRow[]){
  const result=baseResult(data,c,rows),n=rows.length,k=c.folds,mode=c.validation??'random',{folds,splits}=validationSplits(rows,c);
  const predictions:Array<number|null>=Array(n).fill(null),baselines:Array<number|null>=Array(n).fill(null),foldRows:AdvancedTable['rows']=[],splitRows:AdvancedTable['rows']=[],encodingRows:AdvancedTable['rows']=[];
  for(let f=0;f<k;f++){
    const {train:indices,held}=splits[f],train=indices.map(i=>rows[i]);
    const encoding=fitCategoryEncoding(train,c.categoricals??[],data.headers,c.predictors.length),vector=(r:CompleteRow)=>[...c.predictors.map(h=>r.values[h]),...encodeCategoryRow(r,encoding)];
    if(train.length<=c.predictors.length+encoding.columns.length+1)throw new Error(`第 ${f+1} 折在分类编码后没有足够训练观测，请减少解释列。`);
    encodingRows.push(...encoding.columns.map(column=>[f+1,column.source,column.level,column.reference,column.label]));
    const scale=standardize(train.map(vector)),yTrain=train.map(r=>r.values[c.outcome]),my=mean(yTrain),design=new Matrix(scale.z.map(r=>[1,...r]));
    const {qr}=decomposition(design),beta=qr.solve(Matrix.columnVector(yTrain.map(v=>v-my))).to1DArray();
    for(const i of held){predictions[i]=my+beta[0]+vector(rows[i]).reduce((s,v,j)=>s+(v-scale.means[j])/scale.scales[j]*beta[j+1],0);baselines[i]=my;}
    const errors=held.map(i=>rows[i].values[c.outcome]-predictions[i]!),ys=held.map(i=>rows[i].values[c.outcome]),sse=ss(errors,0),denom=ss(ys);
    foldRows.push([f+1,train.length,held.length,Math.sqrt(sse/held.length),mean(errors.map(Math.abs)),denom>0?1-sse/denom:null]);
    if(mode==='group')splitRows.push([f+1,new Set(train.map(r=>r.group)).size,new Set(held.map(i=>rows[i].group)).size,0]);
    if(mode==='time'){
      const trainTimes=train.map(r=>r.values[c.time!]),heldTimes=held.map(i=>rows[i].values[c.time!]);
      splitRows.push([f+1,trainTimes.reduce((a,b)=>Math.min(a,b),Infinity),trainTimes.reduce((a,b)=>Math.max(a,b),-Infinity),heldTimes.reduce((a,b)=>Math.min(a,b),Infinity),heldTimes.reduce((a,b)=>Math.max(a,b),-Infinity)]);
    }
  }
  const evaluated=rows.map((_,i)=>i).filter(i=>predictions[i]!==null),y=evaluated.map(i=>rows[i].values[c.outcome]),errors=evaluated.map(i=>rows[i].values[c.outcome]-predictions[i]!),sse=ss(errors,0),denom=ss(y),baselineSSE=ss(evaluated.map(i=>rows[i].values[c.outcome]-baselines[i]!),0),m=evaluated.length;
  result.metrics=[['折外评估 N',m],['仅用于初始训练 N',n-m],['折外 RMSE',Math.sqrt(sse/m)],['折外 MAE',mean(errors.map(Math.abs))],['折外整体 R²',denom>0?1-sse/denom:null],['训练均值基线 RMSE',Math.sqrt(baselineSSE/m)],['相对基线误差减少',baselineSSE>0?1-sse/baselineSSE:null]];
  result.tables=[table('各折验证',['折','训练 N','验证 N','RMSE','MAE','该折 R²'],foldRows),table('逐行折外预测',['观测行（表头不计）','验证折','实际值','折外预测','残差','训练均值基线'],rows.map((r,i)=>[r.row,folds[i]<0?null:folds[i]+1,r.values[c.outcome],predictions[i],predictions[i]===null?null:r.values[c.outcome]-predictions[i]!,baselines[i]]),true)];
  if(mode==='group')result.tables.push(table('主体隔离检查',['折','训练主体数','验证主体数','交叉主体数'],splitRows));
  if(mode==='time')result.tables.push(table('时间顺序检查',['折','训练最早时间','训练最晚时间','验证最早时间','验证最晚时间'],splitRows));
  if(encodingRows.length)result.tables.push(table('逐折分类编码',['折','字段','类别','参考组','解释列'],encodingRows));
  result.context+=`；含截距 OLS；${k} 折；${mode==='random'?'随机分折':mode==='group'?`主体分组（${c.group}）`:`时间前向（${c.time}）`}；${mode==='time'?'同一时间点不跨块、扩展训练窗口':`LCG+Fisher–Yates 种子 ${c.seed}`}；每折独立训练预处理；不输出全样本最终模型`;
  if(mode==='time')result.warnings.push('最早时间块只用于初始训练，其折外预测为空，不计入评估；同一时间点的全部记录在同一块。尚未设置训练/验证间隔或清除重叠标签窗口，金融预测等场景需另外处理。');
  if(mode==='group')result.warnings.push('主体完整隔离，按主体个数近似均分，各折观测数可能不平衡；这是对新主体的泛化评估，未同时保证时间前向。');
  result.warnings.push('变量筛选、未来可用性与超参数调优仍需独立设计；负 R² 表示预测比对应验证均值参考更差。');return result;
}
