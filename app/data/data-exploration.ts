import {isMissing,numericColumns,type DataSet} from '../stats';

const numericValue=(value:string|undefined)=>value!==undefined&&!isMissing(value)&&Number.isFinite(Number(value))?Number(value):null;
export function quantile(sorted:number[],probability:number) {
  if(!sorted.length)return NaN;
  const position=(sorted.length-1)*probability,lower=Math.floor(position),fraction=position-lower;
  return sorted[lower]*(1-fraction)+(sorted[Math.min(lower+1,sorted.length-1)])*fraction;
}
export function describeValues(values:number[]) {
  const sorted=[...values].sort((a,b)=>a-b),n=values.length;
  let mean=0,m2=0,count=0;
  for(const value of values){count++;const delta=value-mean;mean+=delta/count;m2+=delta*(value-mean);}
  return {n,mean:n?mean:NaN,sd:n>1?Math.sqrt(m2/(n-1)):NaN,min:sorted[0]??NaN,q1:quantile(sorted,.25),median:quantile(sorted,.5),q3:quantile(sorted,.75),max:sorted.at(-1)??NaN};
}
export function qualityProfile(data:DataSet) {
  const numeric=new Set(numericColumns(data));
  const columns=data.headers.map((name,index)=>{
    const present=data.rows.map(row=>row[index]??'').filter(value=>!isMissing(value));
    const values=present.map(value=>numericValue(value)).filter((value):value is number=>value!==null);
    return {name,type:numeric.has(name)?'数值':'文本/分类',missing:data.rows.length-present.length,present:present.length,distinct:new Set(present).size,
      invalidNumeric:numeric.has(name)?present.length-values.length:0,constant:present.length>0&&(numeric.has(name)?new Set(values).size===1:new Set(present).size===1),n:values.length};
  });
  const seen=new Set<string>();let duplicates=0;
  for(const row of data.rows){const key=JSON.stringify(row);if(seen.has(key))duplicates++;else seen.add(key);}
  return {columns,duplicates};
}
export function groupedSummaries(data:DataSet,groupHeader:string,valueHeader:string) {
  const groupIndex=data.headers.indexOf(groupHeader),valueIndex=data.headers.indexOf(valueHeader);
  if((groupHeader!==''&&groupIndex<0)||valueIndex<0||!numericColumns(data).includes(valueHeader))throw new Error('请选择有效的分组变量和数值变量。');
  const groups=new Map<string,{values:number[];missing:number;invalid:number}>();let missingGroup=0;
  for(const row of data.rows){
    const group=groupHeader===''?'全部观测':row[groupIndex]??'',raw=row[valueIndex]??'';
    if(isMissing(group)){missingGroup++;continue;}
    if(!groups.has(group))groups.set(group,{values:[],missing:0,invalid:0});
    if(groups.size>200)throw new Error('分组变量超过 200 个不同值，请选择类别更少的变量。');
    const entry=groups.get(group)!;const value=numericValue(raw);
    if(isMissing(raw))entry.missing++;else if(value===null)entry.invalid++;else entry.values.push(value);
  }
  return {missingGroup,groups:[...groups.entries()].map(([group,entry])=>({group,missing:entry.missing,invalid:entry.invalid,...describeValues(entry.values)}))};
}
export function frequencyTable(data:DataSet,header:string) {
  const index=data.headers.indexOf(header);if(index<0)throw new Error('请选择有效变量。');
  const counts=new Map<string,number>();let missing=0;
  for(const row of data.rows){const value=row[index]??'';if(isMissing(value))missing++;else counts.set(value,(counts.get(value)??0)+1);}
  const valid=data.rows.length-missing;
  return {missing,valid,rows:[...counts.entries()].map(([value,count])=>({value,count,percent:valid?count/valid*100:NaN})).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value,'zh-CN'))};
}
export function correlationMatrix(data:DataSet,headers:string[]) {
  const available=new Set(numericColumns(data));
  if(headers.length<2||headers.length>12||new Set(headers).size!==headers.length||headers.some(header=>!available.has(header)))throw new Error('请选择 2 至 12 个不同的数值变量。');
  const columns=headers.map(header=>{const index=data.headers.indexOf(header);return data.rows.map(row=>numericValue(row[index]));});
  const matrix:Array<Array<{n:number;r:number|null}>>=headers.map(()=>[]);
  for(let x=0;x<columns.length;x++)for(let y=x;y<columns.length;y++){
    let n=0,mx=0,my=0,sx=0,sy=0,c=0;
    for(let row=0;row<data.rows.length;row++){
      const a=columns[x][row],b=columns[y][row];if(a===null||b===null)continue;
      n++;const dx=a-mx,dy=b-my;mx+=dx/n;my+=dy/n;sx+=dx*(a-mx);sy+=dy*(b-my);c+=dx*(b-my);
    }
    const correlation=c/Math.sqrt(sx)/Math.sqrt(sy);
    const cell={n,r:n>=3&&sx>0&&sy>0&&Number.isFinite(correlation)?Math.max(-1,Math.min(1,correlation)):null};
    matrix[x][y]=cell;matrix[y][x]=cell;
  }
  return matrix;
}
export function statisticsCsv(rows:Array<Array<string|number|null>>) {
  const cell=(value:string|number|null)=>{
    let text=value===null||typeof value==='number'&&!Number.isFinite(value)?'':String(value);
    if(typeof value==='string'&&/^\s*[=+@-]/.test(text))text=`'${text}`;
    return `"${text.replace(/"/g,'""')}"`;
  };
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
