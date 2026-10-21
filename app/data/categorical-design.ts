import {isMissing,type DataSet} from '../stats';
export type CategorySpec={name:string;reference:string};
export type CategoryRow={categories?:Record<string,string>};
export type CategoryColumn={key:string;label:string;source:string;level:string;reference:string};
export type CategoryEncoding={columns:CategoryColumn[];levels:Array<{name:string;reference:string;levels:string[]}>};
export function validCategories(value:unknown):value is CategorySpec[]{
  const field=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=500&&!Array.from(v).some(c=>c.charCodeAt(0)<32);
  return Array.isArray(value)&&value.length<=6&&value.every(v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===2&&field(v.name)&&field(v.reference)&&v.reference===v.reference.trim())&&new Set(value.map(v=>v.name)).size===value.length;
}
export function categoryLevels(data:DataSet,name:string){const index=data.headers.indexOf(name);return index<0?[]:[...new Set(data.rows.map(r=>(r[index]??'').trim()).filter(v=>!isMissing(v)))].sort();}
export function fitCategoryEncoding(rows:CategoryRow[],specs:CategorySpec[],usedNames:string[],numericCount:number):CategoryEncoding{
  if(!validCategories(specs))throw new Error('分类变量与参考组格式无效，最多选择 6 个不同分类字段。');
  const used=new Set(usedNames),columns:CategoryColumn[]=[],levels:CategoryEncoding['levels']=[];
  for(const spec of specs){
    const values=[...new Set(rows.map(r=>r.categories?.[spec.name]??''))].sort();
    if(values.some(v=>!v||v.length>500||Array.from(v).some(c=>c.charCodeAt(0)<32)))throw new Error(`“${spec.name}”有空值或不受支持的类别标签。`);
    if(values.length<2||values.length>12)throw new Error(`“${spec.name}”在训练/完整样本中需有 2 至 12 个类别。`);
    if(!values.includes(spec.reference))throw new Error(`“${spec.name}”的参考组“${spec.reference}”未出现在训练/完整样本中，请核对参考组或验证划分。`);
    levels.push({...spec,levels:values});
    for(const level of values.filter(v=>v!==spec.reference)){
      let key=`__acaora_category_${columns.length+1}__`;while(used.has(key))key+='_';used.add(key);
      columns.push({key,label:`${spec.name} [${level} vs ${spec.reference}]`,source:spec.name,level,reference:spec.reference});
    }
  }
  if(numericCount+columns.length>12)throw new Error('分类编码后超过 12 个解释列，请减少数值变量或类别数量。');return {columns,levels};
}
export function encodeCategoryRow(row:CategoryRow,encoding:CategoryEncoding){
  for(const variable of encoding.levels){const value=row.categories?.[variable.name];if(!value||!variable.levels.includes(value))throw new Error(`验证集“${variable.name}”出现训练集未见类别“${value??''}”；未把它当作参考组，请调整划分或类别设计。`);}
  return encoding.columns.map(c=>row.categories?.[c.source]===c.level?1:0);
}
export function expandCategoricalData(data:DataSet,specs:CategorySpec[],numericCount:number,eligible:Array<{row:number;categories?:Record<string,string>}>){
  const encoding=fitCategoryEncoding(eligible,specs,data.headers,numericCount),byRow=new Map(eligible.map(r=>[r.row,r]));
  return {encoding,data:{...data,headers:[...data.headers,...encoding.columns.map(c=>c.key)],rows:data.rows.map((r,i)=>[...r,...(byRow.has(i+1)?encodeCategoryRow(byRow.get(i+1)!,encoding).map(String):encoding.columns.map(()=>''))])}};
}
export function encodingDescription(specs:CategorySpec[]=[]){return specs.map(c=>`${c.name}（参考：${c.reference}）`).join('、');}
