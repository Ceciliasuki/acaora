'use client';
import {useId,useMemo,useState,type ReactNode} from 'react';
import {Button} from '../components/ui';
import MotionNavigation from '../components/motion-navigation';
import {navigateTabs} from '../components/tab-keyboard';
import {formatNumber,numericColumns,type DataSet} from '../stats';
import {correlationMatrix,frequencyTable,groupedSummaries,qualityProfile,statisticsCsv} from './data-exploration';
import styles from './data-explorer.module.css';

type Props={data:DataSet;onSelectPair:(x:string,y:string)=>void};
type Tab='quality'|'summary'|'frequency'|'correlation';
type Cells=Array<Array<string|number|null>>;
const tabs=[['quality','质量诊断'],['summary','分组汇总'],['frequency','频数分布'],['correlation','相关矩阵']] as const;
const display=(value:string|number|null)=>typeof value==='number'?Number.isFinite(value)?Number.isInteger(value)?value.toLocaleString('zh-CN'):formatNumber(value,3):'—':value??'—';
function ScrollRegion({label,children}:{label:string;children:ReactNode}){
  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A labelled overflow region needs focus for keyboard horizontal scrolling.
  return <div className={styles.scroll} role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

export default function DataExplorer(props:Props){
  const [open,setOpen]=useState(false);
  return <details className={styles.explorer} aria-label="数据诊断与探索" onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>数据诊断与探索</summary><p className={styles.help}>检查缺失与非数值、按组比较分布，或同时查看多个变量的线性关联。</p>
    {open&&<ExplorerBody {...props}/>}
  </details>;
}
function ExplorerBody({data,onSelectPair}:Props){
  const id=useId();
  const [tab,setTab]=useState<Tab>('quality');
  const numeric=useMemo(()=>numericColumns(data),[data]);
  const profile=useMemo(()=>qualityProfile(data),[data]);
  const [query,setQuery]=useState('');
  const [group,setGroup]=useState('');
  const [value,setValue]=useState(numeric[0]??'');
  const [frequency,setFrequency]=useState(data.headers.find(header=>!numeric.includes(header))??data.headers[0]??'');
  const [columns,setColumns]=useState(numeric.slice(0,Math.min(6,numeric.length)));
  const [feedback,setFeedback]=useState('');
  const filtered=profile.columns.filter(column=>column.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const summary=useMemo(()=>{
    if(tab!=='summary'||!value)return null;
    try{return {result:groupedSummaries(data,group,value),error:''};}catch(error){return {result:null,error:error instanceof Error?error.message:'无法汇总，请重新选择变量。'};}
  },[data,group,value,tab]);
  const frequencies=useMemo(()=>tab==='frequency'&&frequency?frequencyTable(data,frequency):null,[data,frequency,tab]);
  const matrix=useMemo(()=>tab==='correlation'&&columns.length>=2?correlationMatrix(data,columns):null,[data,columns,tab]);
  const table:{headers:string[];rows:Cells}=tab==='quality'?{headers:['变量','类型','有效数值 N','缺失','非数值','不同原始值','提示'],rows:filtered.map(column=>[column.name,column.type,column.type==='数值'?column.n:null,column.missing,column.type==='数值'?column.invalidNumeric:null,column.distinct,column.present===0?'全缺失':column.constant?'常量':column.invalidNumeric?'混有非数值':'—'])}:
    tab==='summary'?{headers:['组别','有效 N','缺失','非数值','均值','标准差','最小值','Q1','中位数','Q3','最大值'],rows:summary?.result?.groups.map(entry=>[entry.group,entry.n,entry.missing,entry.invalid,entry.mean,entry.sd,entry.min,entry.q1,entry.median,entry.q3,entry.max])??[]}:
    {headers:['取值','频数','有效百分比 (%)'],rows:frequencies?.rows.map(entry=>[entry.value,entry.count,entry.percent])??[]};

  function exportTable(){
    const rows:Cells=tab==='correlation'?matrix?columns.flatMap((x,i)=>columns.slice(i+1).map((y,j)=>{const cell=matrix[i][i+j+1];return [x,y,cell.n,cell.r];})):[]:table.rows;
    if(!rows.length)return;
    const header=tab==='correlation'?['变量 X','变量 Y','成对有效 N','Pearson r']:table.headers;
    const csv=statisticsCsv([header,...rows]);
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`acaora-${tab}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setFeedback('已导出当前表格，数值保留计算精度。表格不包含逐行原始数据。');
  }
  const exportDisabled=tab==='correlation'?!matrix:!table.rows.length;
  return <div className={styles.body}>
    <MotionNavigation as="div" className={styles.tabs} role="tablist" label="数据探索方式" value={tab} onKeyDown={navigateTabs}>{tabs.map(([key,label])=><button type="button" key={key} role="tab" id={`${id}-${key}`} aria-selected={tab===key} aria-controls={`${id}-panel`} tabIndex={tab===key?0:-1} onClick={()=>{setTab(key);setFeedback('');}}>{label}</button>)}</MotionNavigation>
    <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0} className={styles.panel}>
      {tab==='quality'&&<><p>有 {profile.duplicates} 行与此前的整行内容完全相同（计多余行）。重复可能是合理观测，未自动删除。</p><label className={styles.control}>查找诊断变量<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setFeedback('');}} placeholder="输入变量名称"/></label><p className={styles.help}>自动数值识别采用至少 80% 的非缺失值可解析为数值的规则；非数值与缺失分别计数。常量、全缺失变量不用于相关或回归。</p></>}
      {tab==='summary'&&<><div className={styles.controls}><label className={styles.control}>汇总分组<select value={group} onChange={event=>{setGroup(event.target.value);setFeedback('');}}><option value="">不分组</option>{data.headers.map(header=><option key={header}>{header}</option>)}</select></label><label className={styles.control}>汇总数值变量<select value={value} onChange={event=>{setValue(event.target.value);setFeedback('');}}>{!numeric.length&&<option value="">没有数值变量</option>}{numeric.map(header=><option key={header}>{header}</option>)}</select></label></div><p className={styles.help}>每组使用有效数值，不填补缺失。标准差使用 n−1；四分位数使用线性插值（R type 7）。{summary?.result?` 分组值缺失而未入组：${summary.result.missingGroup} 行。`:''}</p>{summary?.error&&<p role="alert">{summary.error}</p>}</>}
      {tab==='frequency'&&<><label className={styles.control}>频数变量<select value={frequency} onChange={event=>{setFrequency(event.target.value);setFeedback('');}}>{data.headers.map(header=><option key={header}>{header}</option>)}</select></label><p className={styles.help}>按频数降序排列；百分比以非缺失观测为分母。{frequencies?` 有效 ${frequencies.valid} 行，缺失 ${frequencies.missing} 行。`:''}</p></>}
      {tab==='correlation'&&<><fieldset className={styles.columns}><legend>选择矩阵变量（2 至 12 个）</legend>{numeric.map(header=><label key={header}><input type="checkbox" checked={columns.includes(header)} disabled={columns.length>=12&&!columns.includes(header)} onChange={event=>{setColumns(current=>event.target.checked?[...current,header]:current.filter(item=>item!==header));setFeedback('');}}/>{header}</label>)}</fieldset><p className={styles.help}>每个单元格分别使用两列都有效的观测，N 可能不同。只探索线性关联，不作因果或显著性判断。点击非对角单元格可查看对应散点图与回归。常量或少于 3 对有效观测显示“—”。</p>{!matrix&&<p role="status">请至少选择两个数值变量。</p>}</>}
      <div className={styles.tools}><Button variant="secondary" size="sm" disabled={exportDisabled} onClick={exportTable}>导出当前表格 CSV</Button><span className={styles.help}>{tab==='correlation'?'导出每对变量的 r 与有效 N':`共 ${table.rows.length} 行${table.rows.length>50?'，页面显示前 50 行；导出包含全部当前结果':''}`}</span></div>
      {tab==='correlation'?matrix&&<ScrollRegion label="相关矩阵，可横向滚动"><table><caption>Pearson 相关矩阵</caption><thead><tr><th scope="col">变量</th>{columns.map(column=><th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{columns.map((x,i)=><tr key={x}><th scope="row">{x}</th>{columns.map((y,j)=>{const cell=matrix[i][j];return <td key={y}><button className={styles.cell} type="button" disabled={i===j||cell.r===null} aria-label={`${x} 与 ${y}：r ${cell.r===null?'不可计算':cell.r.toFixed(3)}，有效 N ${cell.n}${i!==j&&cell.r!==null?'，查看散点图':''}`} onClick={()=>onSelectPair(x,y)}>{cell.r===null?'—':cell.r.toFixed(3)}<small>N = {cell.n}</small></button></td>;})}</tr>)}</tbody></table></ScrollRegion>:
        <ScrollRegion label={`${tabs.find(([key])=>key===tab)?.[1]}表，可横向滚动`}><table><caption>{tabs.find(([key])=>key===tab)?.[1]} · {data.name}</caption><thead><tr>{table.headers.map(header=><th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{table.rows.slice(0,50).map((row,i)=><tr key={i}>{row.map((cell,j)=>j===0?<th scope="row" key={j}>{display(cell)}</th>:<td key={j}>{display(cell)}</td>)}</tr>)}</tbody></table>{!table.rows.length&&!summary?.error&&<p>当前选择没有可用结果，请调整变量或检查数据。</p>}</ScrollRegion>}
      {feedback&&<p role="status">{feedback}</p>}
    </section>
  </div>;
}
