'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '../components/ui';
import {numericColumns,type DataSet} from '../stats';
import {fingerprintDataset} from './analysis-recipe';
import {categoryLevels} from './categorical-design';
import {createRegressionRecipe,parseRegressionRecipe,regressionConfigErrors,type RegressionConfig,type RegressionRecipe} from './regression-config';
import styles from './multiple-regression.module.css';

export function downloadRegressionFile(text:string,name:string,type='text/csv;charset=utf-8'){
  const url=URL.createObjectURL(new Blob([text],{type})),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function RegressionRecipeTools({data,config,busy,onApply}:{data:DataSet;config:RegressionConfig;busy:boolean;onApply:(config:RegressionConfig)=>void}){
  const [fingerprint,setFingerprint]=useState('');
  const [staged,setStaged]=useState<{recipe:RegressionRecipe;config:RegressionConfig}|null>(null);
  const [acknowledged,setAcknowledged]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [reading,setReading]=useState(false);
  const input=useRef<HTMLInputElement>(null),mounted=useRef(true);
  const numeric=numericColumns(data),changed=Boolean(staged&&fingerprint&&staged.recipe.dataset.fingerprint!==fingerprint);
  const errors=staged?regressionConfigErrors(data,staged.config):[];
  useEffect(()=>{
    mounted.current=true;let current=true;
    void fingerprintDataset(data).then(value=>{if(current)setFingerprint(value);}).catch(cause=>{if(current)setError(cause instanceof Error?cause.message:'无法计算数据指纹。');});
    return()=>{current=false;mounted.current=false;};
  },[data]);
  function exportRecipe(){
    setMessage('');setError('');
    try{const errors=regressionConfigErrors(data,config);if(errors.length)throw new Error(errors.join(''));downloadRegressionFile(JSON.stringify(createRegressionRecipe(data,config,fingerprint),null,2),'acaora-regression-recipe.json','application/json');setMessage('回归方案已导出，不包含数据行；重新载入时需要核对变量。');}
    catch(cause){setError(cause instanceof Error?cause.message:'方案导出未完成。');}
  }
  async function read(file?:File){
    if(!file||reading)return;setReading(true);setError('');setMessage('');setStaged(null);setAcknowledged(false);
    try{if(file.size>256*1024)throw new Error('回归方案超过 256 KB。');const recipe=parseRegressionRecipe(await file.text());if(mounted.current)setStaged({recipe,config:{...recipe.config,predictors:[...recipe.config.predictors]}});}
    catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'方案读取未完成。');}
    finally{if(mounted.current)setReading(false);}
  }
  function mapping(index:number|null,label:string,source:string){
    if(!staged)return null;
    return <label className={styles.control}>{label}<select aria-label={index===null?'方案因变量':`方案解释变量 ${index+1}`} value={numeric.includes(source)?source:''} onChange={event=>{const value=event.target.value;setAcknowledged(false);setStaged(current=>current?{...current,config:index===null?{...current.config,outcome:value}:{...current.config,predictors:current.config.predictors.map((name,j)=>j===index?value:name)}}:current);}}><option value="">{source&&!numeric.includes(source)?`未找到“${source}”，请映射`:'请选择'}</option>{numeric.map(header=><option key={header}>{header}</option>)}</select></label>;
  }
  return <details className={styles.recipe}><summary>保存与载入回归方案</summary>
    <div className={styles.actions}><Button variant="secondary" size="sm" disabled={busy||!fingerprint} onClick={exportRecipe}>导出当前模型方案</Button><Button variant="ghost" size="sm" disabled={busy||reading} onClick={()=>input.current?.click()}>载入回归方案</Button><input ref={input} className="sr-only" type="file" accept=".json,application/json" aria-label="选择回归方案文件" disabled={busy||reading} onChange={event=>{const file=event.target.files?.[0];event.currentTarget.value='';void read(file);}}/></div>
    {staged&&<section className={styles.staging} aria-label="待应用回归方案"><h3>核对回归变量</h3><p>{changed?'数据指纹不同，应用后使用当前数据；结果可能不同。':'请核对变量；应用配置后仍需点击拟合。'}</p><div className={styles.controls}>{mapping(null,'方案因变量',staged.config.outcome)}{staged.config.predictors.map((name,index)=><div key={index}>{mapping(index,`解释变量 ${index+1}（原：${staged.recipe.config.predictors[index]}）`,name)}</div>)}{(staged.config.categoricals??[]).map((c,index)=><div key={`cat-${index}`}><label className={styles.control}>分类字段（原：{staged.recipe.config.categoricals?.[index].name}）<select aria-label={`方案分类变量 ${index+1}`} value={data.headers.includes(c.name)?c.name:''} onChange={e=>{const name=e.target.value;setAcknowledged(false);setStaged(current=>current?{...current,config:{...current.config,categoricals:current.config.categoricals?.map((v,j)=>j===index?{...v,name}:v)}}:current);}}><option value="">请选择分类字段</option>{data.headers.map(h=><option key={h}>{h}</option>)}</select></label><label className={styles.control}>分类参考组<select aria-label={`方案分类参考组 ${index+1}`} value={categoryLevels(data,c.name).includes(c.reference)?c.reference:''} onChange={e=>{const reference=e.target.value;setAcknowledged(false);setStaged(current=>current?{...current,config:{...current.config,categoricals:current.config.categoricals?.map((v,j)=>j===index?{...v,reference}:v)}}:current);}}><option value="">请核对参考组（原：{staged.recipe.config.categoricals?.[index].reference}）</option>{categoryLevels(data,c.name).map(level=><option key={level}>{level}</option>)}</select></label></div>)}</div><p>标准误：{staged.config.standardErrors==='HC3'?'HC3 稳健':'常规'}；95% 区间；包含截距；整行排除模型变量不完整的观测。</p>{errors.length>0&&<ul role="alert">{errors.map(error=><li key={error}>{error}</li>)}</ul>}{changed&&<label className={styles.check}><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>我已核对映射，使用当前数据</label>}<div className={styles.actions}><Button size="sm" disabled={busy||!fingerprint||errors.length>0||(changed&&!acknowledged)} onClick={()=>{onApply(staged.config);setStaged(null);setMessage('配置已应用，尚未拟合。请点击“拟合模型”。');}}>应用回归配置</Button><Button variant="ghost" size="sm" onClick={()=>setStaged(null)}>取消载入</Button></div></section>}
    {reading&&<p role="status">正在读取方案…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  </details>;
}
