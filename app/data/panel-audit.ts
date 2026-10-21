import {isMissing,type DataSet} from '../stats';
export function auditPanel(data:DataSet,entity:string,time:string,interval:number,variables:string[]){
  if(!entity||!time||entity===time||!data.headers.includes(entity)||!data.headers.includes(time)||!Number.isFinite(interval)||interval<=0||variables.length>12||variables.some(h=>!data.headers.includes(h)))throw new Error('请选择不同的主体/数值时间字段、正间隔和最多 12 个检查变量。');
  if(data.rows.length>100000)throw new Error('面板体检最多支持 100,000 行。');
  const ei=data.headers.indexOf(entity),ti=data.headers.indexOf(time),indices=variables.map(h=>data.headers.indexOf(h)),groups=new Map<string,{times:Set<number>;rows:number[];values:Array<{min:number;max:number;n:number}>}>(),keys=new Map<string,number[]>();let missingEntity=0,missingTime=0,invalidTime=0;
  for(let i=0;i<data.rows.length;i++){
    const r=data.rows[i],id=(r[ei]??'').trim(),raw=r[ti]??'';if(isMissing(id)){missingEntity++;continue;}if(isMissing(raw)){missingTime++;continue;}const t=Number(raw);if(!Number.isFinite(t)){invalidTime++;continue;}
    const key=JSON.stringify([id,t]),occurrences=keys.get(key)??[];occurrences.push(i+1);keys.set(key,occurrences);
    const g=groups.get(id)??{times:new Set<number>(),rows:[],values:variables.map(()=>({min:Infinity,max:-Infinity,n:0}))};g.times.add(t);g.rows.push(i+1);
    indices.forEach((j,k)=>{const raw=r[j]??'',v=Number(raw);if(!isMissing(raw)&&Number.isFinite(v)){g.values[k].min=Math.min(g.values[k].min,v);g.values[k].max=Math.max(g.values[k].max,v);g.values[k].n++;}});groups.set(id,g);
  }
  const allTimes=new Set([...groups.values()].flatMap(g=>[...g.times])),duplicates=[...keys].filter(([,v])=>v.length>1).map(([key,rows])=>({entity:JSON.parse(key)[0] as string,time:JSON.parse(key)[1] as number,rows}));
  const subjects=[...groups].map(([name,g])=>{const times=[...g.times].sort((a,b)=>a-b);let gaps=0,irregular=0;for(let j=1;j<times.length;j++){const ratio=(times[j]-times[j-1])/interval;if(!Number.isFinite(ratio)||Math.abs(ratio-Math.round(ratio))>1e-7)irregular++;else gaps+=Math.max(0,Math.round(ratio)-1);}return {entity:name,n:g.rows.length,periods:times.length,first:times[0],last:times.at(-1)!,gaps,irregular};});
  const constant=variables.map((name,j)=>{let usable=0,invariant=0,noValues=0;for(const g of groups.values()){if(!g.values[j].n)noValues++;else{usable++;if(g.values[j].min===g.values[j].max)invariant++;}}return {name,usable,invariant,noValues};});
  return {valid:data.rows.length-missingEntity-missingTime-invalidTime,missingEntity,missingTime,invalidTime,subjects,duplicates,duplicateExtraRows:duplicates.reduce((s,d)=>s+d.rows.length-1,0),periods:allTimes.size,balanced:groups.size>0&&duplicates.length===0&&[...groups.values()].every(g=>g.times.size===allTimes.size),constant};
}
