import {isMissing,type DataSet} from '../stats';
import {describeValues} from './data-exploration';
export type DataStep={kind:'filter'|'derive'|'impute'|'drop-missing'|'recode';column:string;output:string;operation:string;value:string;other:string;mapping?:Record<string,string>};
export type StepRecord={step:DataStep;before:number;after:number;changed:number;parameters:Record<string,number|string>;fitted:boolean};
export type WorkflowResult={data:DataSet;sourceRows:number[];records:StepRecord[];fittedColumns:string[];fittedSelection:boolean};
export type VariableEntry={name:string;label:string;unit:string;definition:string;source:string;citation:string;period:string;kind:'unspecified'|'numeric'|'categorical'|'id'|'time'};
export const emptyVariable=(name:string):VariableEntry=>({name,label:'',unit:'',definition:'',source:'',citation:'',period:'',kind:'unspecified'});
const number=(v:string|undefined)=>v!==undefined&&!isMissing(v)&&Number.isFinite(Number(v))?Number(v):null;
const field=(v:unknown)=>typeof v==='string'&&v.length<=500&&!Array.from(v).some(c=>c.charCodeAt(0)<32);
export function validateDataStep(v:unknown):v is DataStep{
  if(!v||typeof v!=='object'||Array.isArray(v))return false;const s=v as DataStep;
  if(Object.keys(s).some(k=>!['kind','column','output','operation','value','other','mapping'].includes(k))||!['filter','derive','impute','drop-missing','recode'].includes(s.kind)||!['column','output','operation','value','other'].every(k=>Object.hasOwn(s,k)&&field(s[k as keyof DataStep]))||!s.column.trim())return false;
  if(s.kind==='filter'&&!['eq','ne','gt','ge','lt','le','missing','present'].includes(s.operation))return false;
  if(s.kind==='derive'&&!['log','log1p','square','zscore','sum','difference','product','ratio'].includes(s.operation))return false;
  if(s.kind==='impute'&&!['constant','mean','median'].includes(s.operation))return false;
  if((s.kind==='drop-missing'&&s.operation!=='drop')||(s.kind==='recode'&&s.operation!=='mapping')||(s.kind!=='recode'&&s.mapping!==undefined))return false;
  if(s.kind==='recode'&&(!s.mapping||typeof s.mapping!=='object'||Array.isArray(s.mapping)||Object.keys(s.mapping).length<1||Object.keys(s.mapping).length>100||Object.entries(s.mapping).some(([k,v])=>!field(k)||!field(v))))return false;
  return true;
}
export function applyDataWorkflow(source:DataSet,steps:DataStep[]):WorkflowResult{
  if(source.rows.length>100000)throw new Error('数据处理最多支持 100,000 行，请先拆分数据。');
  if(steps.length>50||!steps.every(validateDataStep))throw new Error('处理方案含不受支持的步骤或超过 50 步。');
  const data:DataSet={name:source.name,headers:[...source.headers],rows:source.rows.map(r=>[...r])},records:StepRecord[]=[],fittedColumns=new Set<string>();let sourceRows=source.rows.map((_,i)=>i+1),fittedSelection=false;
  if(new Set(data.headers).size!==data.headers.length)throw new Error('列名重复，无法处理。');
  for(const step of steps){
    const index=data.headers.indexOf(step.column),other=data.headers.indexOf(step.other),before=data.rows.length;let changed=0,fitted=false;const parameters:StepRecord['parameters']={};
    if(index<0)throw new Error(`没有找到“${step.column}”。`);
    if(step.kind==='filter'||step.kind==='drop-missing'){
      if(fittedColumns.has(step.column))fittedSelection=true;
      const keep:number[]=[];
      for(let i=0;i<data.rows.length;i++){
        const raw=data.rows[i][index]??'',v=number(raw);let yes=false;
        if(step.kind==='drop-missing')yes=!isMissing(raw);
        else if(step.operation==='missing')yes=isMissing(raw);else if(step.operation==='present')yes=!isMissing(raw);
        else if(step.operation==='eq'||step.operation==='ne')yes=step.operation==='eq'?raw===step.value:raw!==step.value;
        else{const bound=number(step.value);if(bound===null)throw new Error('数值筛选条件须为有限数值。');if(v!==null)yes=step.operation==='gt'?v>bound:step.operation==='ge'?v>=bound:step.operation==='lt'?v<bound:v<=bound;}
        if(yes)keep.push(i);
      }
      data.rows=keep.map(i=>data.rows[i]);sourceRows=keep.map(i=>sourceRows[i]);changed=before-keep.length;
      if(!data.rows.length)throw new Error('该步骤会移除全部记录，未应用。请调整筛选条件。');
    }else if(step.kind==='impute'){
      let fill=step.value;
      if(step.operation!=='constant'){
        const values=data.rows.map(r=>number(r[index])).filter((v):v is number=>v!==null);if(!values.length)throw new Error('此列没有可计算填补参数的数值。');const stats=describeValues(values),value=step.operation==='mean'?stats.mean:stats.median;if(!Number.isFinite(value))throw new Error('填补参数溢出。');fill=String(value);parameters.fill=value;fitted=true;fittedColumns.add(step.column);
      }else{if(isMissing(fill))throw new Error('填补常量不能仍为空值或 NA。');parameters.fill=fill;}
      data.rows=data.rows.map(r=>{if(!isMissing(r[index]??''))return r;changed++;const next=[...r];next[index]=fill;return next;});
    }else{
      const target=step.output.trim();if(!target||target.length>500||data.headers.includes(target))throw new Error('新列名不能为空或覆盖现有列。');
      const binary=['sum','difference','product','ratio'].includes(step.operation);if(step.kind==='derive'&&binary&&other<0)throw new Error('请选择第二个数值字段。');
      let m=0,sd=1;
      if(step.kind==='derive'&&step.operation==='zscore'){
        const values=data.rows.map(r=>number(r[index])).filter((v):v is number=>v!==null),stats=describeValues(values);m=stats.mean;sd=stats.sd;if(!Number.isFinite(m)||!Number.isFinite(sd)||sd<=0)throw new Error('标准化需要至少两个有变动的数值。');parameters.mean=m;parameters.sd=sd;fitted=true;
      }
      data.rows=data.rows.map(r=>{let output='';const raw=r[index]??'';
        if(step.kind==='recode')output=Object.hasOwn(step.mapping!,raw)?step.mapping![raw]:raw;
        else{const x=number(raw),y=binary?number(r[other]):0;if(x!==null&&y!==null){const v=step.operation==='log'?(x>0?Math.log(x):NaN):step.operation==='log1p'?(x>-1?Math.log1p(x):NaN):step.operation==='square'?x*x:step.operation==='zscore'?(x-m)/sd:step.operation==='sum'?x+y:step.operation==='difference'?x-y:step.operation==='product'?x*y:y!==0?x/y:NaN;if(Number.isFinite(v))output=String(v);}}
        if(output!==raw)changed++;return [...r,output];
      });data.headers.push(target);
      if(fitted||fittedColumns.has(step.column)||(binary&&fittedColumns.has(step.other)))fittedColumns.add(target);
      if(step.kind==='derive')parameters.invalidOrMissingOutput=data.rows.filter(r=>isMissing(r.at(-1)??'')).length;
    }
    records.push({step:structuredClone(step),before,after:data.rows.length,changed,parameters,fitted});
  }
  return {data,sourceRows,records,fittedColumns:[...fittedColumns],fittedSelection};
}
export function parseWorkflow(text:string){
  if(new TextEncoder().encode(text).length>1024*1024)throw new Error('处理方案超过 1 MB。');const v=JSON.parse(text);
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==4||v.format!=='acaora-data-workflow'||v.version!==1||typeof v.sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(v.sourceFingerprint)||!Array.isArray(v.steps)||v.steps.length>50||!v.steps.every(validateDataStep))throw new Error('不是受支持的数据处理方案。');
  return v as {format:'acaora-data-workflow';version:1;sourceFingerprint:string;steps:DataStep[]};
}
export function parseDictionary(text:string,headers:string[]){
  if(new TextEncoder().encode(text).length>1024*1024)throw new Error('变量字典超过 1 MB。');const v=JSON.parse(text);
  if(!v||v.format!=='acaora-data-dictionary'||v.version!==1||!Array.isArray(v.variables)||Object.keys(v).length!==3||v.variables.length>2000)throw new Error('不是受支持的变量字典。');
  const used=new Set<string>();for(const entry of v.variables){if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).length!==8||!['name','label','unit','definition','source','citation','period'].every(k=>Object.hasOwn(entry,k)&&typeof entry[k]==='string'&&entry[k].length<=2000)||!['unspecified','numeric','categorical','id','time'].includes(entry.kind)||!headers.includes(entry.name)||used.has(entry.name))throw new Error('字典含未知/重复字段或无效说明，请先核对当前表头。');used.add(entry.name);}
  return v.variables as VariableEntry[];
}
