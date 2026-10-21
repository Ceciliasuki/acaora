'use client';
import {useEffect,useRef,useState} from 'react';
import {getCurrentUser,authChangeEvent} from '../lib/auth-client';
import {Button} from '../components/ui';
import type {AnalysisResult} from './result-tools';
import type {AdvancedConfig,AdvancedTable} from './advanced-config';
import type {RegressionConfig} from './regression-config';
import type {PaperChartSpec} from './paper-chart-svg';
import type {ResearchContextValue} from './research-context';
import {useResearchContext} from './research-context';
import {downloadRegressionFile} from './regression-recipe-tools';
import PaperChart from './paper-chart';
import ReproductionTools from './reproduction-tools';
import styles from './multiple-regression.module.css';
export type ResearchAnalysis={kind:'basic';config:{method:string;x:string;y:string;group:string;value:string}}|{kind:'ols';config:RegressionConfig;tables?:AdvancedTable[];charts?:PaperChartSpec[]}|{kind:'advanced';config:AdvancedConfig;tables?:AdvancedTable[];charts?:PaperChartSpec[]};
export type ResearchSnapshot={format:'acaora-analysis-snapshot';version:1;id:string;name:string;createdAt:string;result:AnalysisResult;analysis:ResearchAnalysis;dataset:{name:string;rows:number;headers:string[];fingerprint:string;sourceFingerprint:string};workflow:ResearchContextValue['workflow']['records'];dictionary:ResearchContextValue['dictionary']};
const guestKey='acaora.datalab.history.guest.v1',changeEvent='acaora:datalab-history',byteLength=(s:string)=>new TextEncoder().encode(s).length;
function storage(owner:string){return owner==='guest'?sessionStorage:localStorage;}
function storageKey(owner:string){return owner==='guest'?guestKey:`acaora.datalab.history.v1:${encodeURIComponent(owner)}`;}
export function validateHistory(value:unknown):ResearchSnapshot[]{
  if(!Array.isArray(value)||value.length>20)throw new Error('本地历史格式或数量无效。');
  for(const v of value)if(!v||v.format!=='acaora-analysis-snapshot'||v.version!==1||typeof v.id!=='string'||typeof v.name!=='string'||v.name.length>100||!v.name.trim()||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||!v.result||!Array.isArray(v.result.metrics)||!v.result.metrics.every((m:unknown)=>Array.isArray(m)&&m.length===2&&m.every(x=>typeof x==='string'))||!v.analysis||!['basic','ols','advanced'].includes(v.analysis.kind)||!v.analysis.config||!v.dataset||!/^[a-f0-9]{64}$/.test(v.dataset.fingerprint)||!/^[a-f0-9]{64}$/.test(v.dataset.sourceFingerprint)||!Array.isArray(v.dataset.headers)||!Array.isArray(v.workflow)||!Array.isArray(v.dictionary)||byteLength(JSON.stringify(v))>2000000)throw new Error('本地快照损坏或超出 2 MB，请先从浏览器备份恢复。');
  return value;
}
function read(owner:string){const raw=storage(owner).getItem(storageKey(owner));if(!raw)return [];if(byteLength(raw)>4000000)throw new Error('本地历史超过 4 MB。');return validateHistory(JSON.parse(raw));}
function useHistory(){
  const [items,setItems]=useState<ResearchSnapshot[]>([]),[owner,setOwner]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const epoch=useRef(0),current=useRef<string|null>(null),alive=useRef(true),lock=useRef(false);
  useEffect(()=>{
    alive.current=true;
    const load=async()=>{const generation=++epoch.current;current.current=null;setOwner(null);setItems([]);try{const user=await getCurrentUser();if(!alive.current||generation!==epoch.current)return;const id=user?.id??'guest';const list=read(id);current.current=id;setOwner(id);setItems(list);setError('');}catch(e){if(alive.current&&generation===epoch.current)setError(e instanceof Error?e.message:'无法读取本地历史。');}};
    const auth=()=>{try{sessionStorage.removeItem(guestKey);}catch{/* Storage may be disabled; auth invalidation still proceeds. */}void load();};
    const refresh=()=>{void load();};void load();window.addEventListener(authChangeEvent,auth);window.addEventListener(changeEvent,refresh);window.addEventListener('storage',refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- This ref is an auth generation, not a DOM node; cleanup must invalidate pending reads.
    return()=>{alive.current=false;epoch.current++;current.current=null;window.removeEventListener(authChangeEvent,auth);window.removeEventListener(changeEvent,refresh);window.removeEventListener('storage',refresh);};
  },[]);
  async function mutate(update:(list:ResearchSnapshot[])=>ResearchSnapshot[]){
    if(lock.current)return false;const expected=current.current,generation=epoch.current;if(!expected){setError('身份尚未确认，暂不能保存。');return false;}
    lock.current=true;setBusy(true);setError('');
    try{const user=await getCurrentUser();if(!alive.current||generation!==epoch.current||current.current!==expected)throw new Error('登录状态已变化，请重新打开历史后操作。');if((user?.id??'guest')!==expected){window.dispatchEvent(new Event(authChangeEvent));throw new Error('登录状态已变化，未保存到任何账号。');}const list=validateHistory(update(read(expected))),raw=JSON.stringify(list);if(byteLength(raw)>4000000)throw new Error('本地历史超过 4 MB，请导出并删除部分快照。');storage(expected).setItem(storageKey(expected),raw);setItems(list);window.dispatchEvent(new Event(changeEvent));return true;}catch(e){if(alive.current)setError(e instanceof Error?e.message:'存储失败；旧历史仍保留，请检查浏览器容量。');return false;}finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return {items,owner,error,busy,mutate};
}
export function ResearchResultActions({result,analysis}:{result:AnalysisResult;analysis:ResearchAnalysis}){
  const ctx=useResearchContext(),history=useHistory(),[name,setName]=useState(''),[message,setMessage]=useState('');if(!ctx)return null;
  async function save(){if(!ctx?.dataFingerprint||!ctx.sourceFingerprint)return;const title=name.trim();if(!title)return;const snapshot:ResearchSnapshot={format:'acaora-analysis-snapshot',version:1,id:crypto.randomUUID(),name:title,createdAt:new Date().toISOString(),result:structuredClone(result),analysis:structuredClone(analysis),dataset:{name:ctx.data.name,rows:ctx.data.rows.length,headers:ctx.data.headers,fingerprint:ctx.dataFingerprint,sourceFingerprint:ctx.sourceFingerprint},workflow:ctx.workflow.records,dictionary:ctx.dictionary};if(await history.mutate(list=>[snapshot,...list]))setMessage('已保存命名快照，可在分析历史查看与对照。');}
  return <details className={styles.recipe}><summary>保存快照与导出复现包</summary><label className={styles.control}>分析快照名称<input maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="如：主模型 · HC3 · 第一版"/></label><Button variant="secondary" size="sm" disabled={!name.trim()||!ctx.dataFingerprint||!ctx.sourceFingerprint||!history.owner||history.busy} onClick={()=>void save()}>保存命名快照</Button><p className={styles.help}>{history.owner==='guest'?'未登录：快照只保留在当前标签页。':'登录后：快照保存在此浏览器，按账号隔离，不在设备之间同步。'}最多 20 个 / 合计 4 MB；保存设置、摘要、汇总表、图及变量说明，排除逐行结果和数据行。快照保留默认图表标题与图注，编辑后的图请单独导出。</p><ReproductionTools analysis={analysis} result={result}/>{history.error&&<p role="alert">{history.error}</p>}{ctx.fingerprintError&&<p role="alert">{ctx.fingerprintError}</p>}{message&&<p role="status">{message}</p>}</details>;
}
export function AnalysisHistory(){
  const history=useHistory(),ctx=useResearchContext(),[selected,setSelected]=useState(''),[compare,setCompare]=useState(''),[rename,setRename]=useState('');
  const a=history.items.find(v=>v.id===selected),b=history.items.find(v=>v.id===compare),labels=[...new Set([...(a?.result.metrics.map(v=>v[0])??[]),...(b?.result.metrics.map(v=>v[0])??[])])];
  return <details className={`quality-panel ${styles.history}`}><summary>分析历史与版本对照（{history.items.length}）</summary><p className={styles.help}>历史不会自动重算；先按数据指纹判断是否来自同一处理表。浏览器数据被清理后无法恢复，请导出重要快照。</p><div className={styles.controls}><label className={styles.control}>查看快照<select value={a?.id??''} onChange={e=>{setSelected(e.target.value);setRename(history.items.find(v=>v.id===e.target.value)?.name??'');}}><option value="">选择已保存的分析</option>{history.items.map(v=><option key={v.id} value={v.id}>{v.name} · {v.createdAt.slice(0,16)}</option>)}</select></label><label className={styles.control}>对照快照<select value={b?.id??''} onChange={e=>setCompare(e.target.value)}><option value="">暂不对照</option>{history.items.filter(v=>v.id!==a?.id).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label></div>
    {a&&<section aria-label="已保存分析快照"><h3>{a.name}</h3><p>{a.result.method} · {a.dataset.name} · {a.dataset.rows} 行 · {a.createdAt}</p><p>{a.dataset.fingerprint===ctx?.dataFingerprint?'与当前处理表指纹一致。':'与当前处理表指纹不同。'}{b&&(a.dataset.fingerprint===b.dataset.fingerprint?' 两个快照使用同一处理表。':' 两个快照来自不同处理表，指标差异可能由样本变化引起。')}</p><p>{a.result.context}</p><label className={styles.control}>快照新名称<input maxLength={100} value={rename} onChange={e=>setRename(e.target.value)}/></label><div className={styles.actions}><Button variant="secondary" size="sm" disabled={!rename.trim()||history.busy} onClick={()=>void history.mutate(list=>list.map(v=>v.id===a.id?{...v,name:rename.trim()}:v))}>重命名快照</Button><Button variant="ghost" size="sm" onClick={()=>downloadRegressionFile(JSON.stringify(a,null,2),'acaora-analysis-snapshot.json','application/json')}>导出此快照 JSON</Button><Button variant="ghost" size="sm" disabled={history.busy} onClick={()=>void history.mutate(list=>list.filter(v=>v.id!==a.id))}>删除此快照</Button></div><div className={styles.scroll}><table><caption>已保存摘要；— 表示该方法没有此指标。</caption><thead><tr><th scope="col">指标</th><th scope="col">{a.name}</th>{b&&<th scope="col">{b.name}</th>}</tr></thead><tbody>{labels.map(label=><tr key={label}><th scope="row">{label}</th><td>{a.result.metrics.find(v=>v[0]===label)?.[1]??'—'}</td>{b&&<td>{b.result.metrics.find(v=>v[0]===label)?.[1]??'—'}</td>}</tr>)}</tbody></table></div><details><summary>查看保存的设置、处理记录与变量来源</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({analysis:a.analysis.config,workflow:a.workflow,dictionary:a.dictionary},null,2)}</pre></details>{a.analysis.kind!=='basic'&&a.analysis.charts?.map((spec,i)=><PaperChart key={`${a.id}-${i}`} spec={spec}/>)}</section>}{history.error&&<p role="alert">{history.error}</p>}
  </details>;
}
