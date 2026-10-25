'use client';
import {Suspense,useEffect,useLayoutEffect,useRef,useState,type ChangeEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import AnalysisProjectLink from './analysis-project-link';
import Link from 'next/link';
import {withResearchProject} from '../lib/research-links';
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
import LocalExecutionTools from './local-execution-tools';
import {validateExtensionPayload} from '../lib/research-extension-schema';
import DataResearchOperations from './data-research-operations';
import {runResearchWorker} from './research-worker-client';
import {makeExecutionIdentity,validateResearchBaseline,type ResearchBaseline} from '../lib/research-verification';
import {ADVANCED_ENGINE} from './advanced-config';
import {REGRESSION_ENGINE} from './regression-config';
import styles from './multiple-regression.module.css';
export type ResearchAnalysis={kind:'basic';config:{method:string;x:string;y:string;group:string;value:string}}|{kind:'ols';config:RegressionConfig;tables?:AdvancedTable[];charts?:PaperChartSpec[]}|{kind:'advanced';config:AdvancedConfig;tables?:AdvancedTable[];charts?:PaperChartSpec[]};
export type ResearchSnapshot={format:'acaora-analysis-snapshot';version:1;id:string;name:string;createdAt:string;result:AnalysisResult;analysis:ResearchAnalysis;dataset:{name:string;rows:number;headers:string[];fingerprint:string;sourceFingerprint:string};workflow:ResearchContextValue['workflow']['records'];dictionary:ResearchContextValue['dictionary'];baseline?:ResearchBaseline;joinHistory?:ResearchContextValue['joinHistory']};
const guestKey='acaora.datalab.history.guest.v1',changeEvent='acaora:datalab-history',byteLength=(s:string)=>new TextEncoder().encode(s).length;
function storage(owner:string){return owner==='guest'?sessionStorage:localStorage;}
function storageKey(owner:string){return owner==='guest'?guestKey:`acaora.datalab.history.v1:${encodeURIComponent(owner)}`;}
export function validateHistory(value:unknown):ResearchSnapshot[]{
  if(!Array.isArray(value)||value.length>20)throw new Error('本地历史格式或数量无效。');
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(key=>!['format','version','id','name','createdAt','result','analysis','dataset','workflow','dictionary','baseline','joinHistory'].includes(key)))throw new Error('快照包含未知字段，未导入。');
    const v=item as ResearchSnapshot;
    if(typeof v.id!=='string'||!v.id.trim()||v.id.length>200||!v.result||typeof v.result.source!=='string'||typeof v.result.context!=='string'||typeof v.result.method!=='string'||typeof v.result.sample!=='boolean'||!v.dataset||typeof v.dataset.name!=='string'||!Number.isSafeInteger(v.dataset.rows)||v.dataset.rows<0||!Array.isArray(v.dataset.headers)||!v.dataset.headers.every(h=>typeof h==='string')||Object.keys(v.dataset).some(key=>!['name','rows','headers','fingerprint','sourceFingerprint'].includes(key))||!v.analysis||!v.analysis.config||typeof v.analysis.config!=='object'||Array.isArray(v.analysis.config))throw new Error('快照的来源、设置或数据身份格式无效。');
    if(v.analysis.kind!=='basic'&&v.analysis.charts!==undefined&&(!Array.isArray(v.analysis.charts)||v.analysis.charts.some(chart=>!chart||typeof chart.title!=='string'||typeof chart.xLabel!=='string'||typeof chart.yLabel!=='string'||typeof chart.note!=='string'||typeof chart.source!=='string'||typeof chart.method!=='string'||!Array.isArray(chart.points)||chart.points.length>10001||chart.points.some(point=>!point||typeof point.label!=='string'||!Number.isFinite(point.value)))))throw new Error('快照图表格式无效。');
    if(v.joinHistory!==undefined&&(!Array.isArray(v.joinHistory)||v.joinHistory.length>50||v.joinHistory.some(item=>!item||!validateExtensionPayload('join',item.receipt)||!Array.isArray(item.leftWorkflow)||!/^[a-f0-9]{64}$/.test(item.leftSourceFingerprint)||!Array.isArray(item.dictionary))))throw new Error('合并历史格式无效。');
    if(Object.hasOwn(v,'baseline')){
      const baseline=v.baseline,engine=v.analysis.kind==='basic'?'acaora-stats-v2':v.analysis.kind==='ols'?REGRESSION_ENGINE:ADVANCED_ENGINE;
      if(!validateResearchBaseline(baseline)||Object.keys(baseline).some(key=>!['format','version','identity','metrics','environment','capturedAt'].includes(key))||Object.keys(baseline.identity).some(key=>!['engine','settingsHash','dataFingerprint','sourceFingerprint'].includes(key))||baseline.identity.engine!==engine||baseline.identity.dataFingerprint!==v.dataset.fingerprint||baseline.identity.sourceFingerprint!==v.dataset.sourceFingerprint)throw new Error('快照核验基线或数据身份无效。');
    }
  }
  for(const v of value)if(!v||v.format!=='acaora-analysis-snapshot'||v.version!==1||typeof v.id!=='string'||typeof v.name!=='string'||v.name.length>100||!v.name.trim()||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||!v.result||!Array.isArray(v.result.metrics)||!v.result.metrics.every((m:unknown)=>Array.isArray(m)&&m.length===2&&m.every(x=>typeof x==='string'))||!v.analysis||!['basic','ols','advanced'].includes(v.analysis.kind)||!v.analysis.config||!v.dataset||!/^[a-f0-9]{64}$/.test(v.dataset.fingerprint)||!/^[a-f0-9]{64}$/.test(v.dataset.sourceFingerprint)||!Array.isArray(v.dataset.headers)||!Array.isArray(v.workflow)||!Array.isArray(v.dictionary)||byteLength(JSON.stringify(v))>2000000)throw new Error('本地快照损坏或超出 2 MB，请先从浏览器备份恢复。');
  return value;
}
function read(owner:string){const raw=storage(owner).getItem(storageKey(owner));if(!raw)return [];if(byteLength(raw)>4000000)throw new Error('本地历史超过 4 MB。');return validateHistory(JSON.parse(raw));}
export function readResearchSnapshots(owner:string):ResearchSnapshot[]{return read(owner);}
type HistoryIdentity={owner:string|null;generation:number};
function useHistory(){
  const [items,setItems]=useState<ResearchSnapshot[]>([]),[owner,setOwner]=useState<string|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[damagedRaw,setDamagedRaw]=useState<string|null>(null);
  const epoch=useRef(0),current=useRef<string|null>(null),alive=useRef(true),lock=useRef(false);
  useEffect(()=>{
    alive.current=true;
    const load=async()=>{
      const generation=++epoch.current;
      try {
        const user=await getCurrentUser();if(!alive.current||generation!==epoch.current)return;
        const id=user?.id??'guest';
        if(current.current!==id)setItems([]);
        current.current=id;setOwner(id);
        const raw=storage(id).getItem(storageKey(id));
        try {if(raw&&byteLength(raw)>4000000)throw new Error('本地历史超过 4 MB。');const list=raw?validateHistory(JSON.parse(raw)):[];setItems(list);setDamagedRaw(null);setError('');}
        catch(cause){setDamagedRaw(raw);setError(cause instanceof Error?cause.message:'本地历史损坏，请从备份恢复。');}
      }catch(cause){if(alive.current&&generation===epoch.current)setError(cause instanceof Error?cause.message:'无法读取本地历史。');}
    };
    const auth=()=>{epoch.current++;current.current=null;setOwner(null);setItems([]);setDamagedRaw(null);try{sessionStorage.removeItem(guestKey);}catch{/* Identity is invalidated even without storage. */}void load();};
    const refresh=()=>{void load();};
    const stored=(event:StorageEvent)=>{const id=current.current;if(id&&(event.key===null||event.key===storageKey(id))&&(!event.storageArea||event.storageArea===storage(id)))void load();};
    void load();window.addEventListener(authChangeEvent,auth);window.addEventListener(changeEvent,refresh);window.addEventListener('storage',stored);
    // These refs are identity tokens, not DOM nodes; cleanup must invalidate the latest token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return()=>{alive.current=false;epoch.current++;current.current=null;window.removeEventListener(authChangeEvent,auth);window.removeEventListener(changeEvent,refresh);window.removeEventListener('storage',stored);};
  },[]);
  function identity():HistoryIdentity{return {owner:current.current,generation:epoch.current};}
  function matchesIdentity(token:HistoryIdentity){return alive.current&&token.owner===current.current&&token.generation===epoch.current;}
  async function mutate(update:(list:ResearchSnapshot[])=>ResearchSnapshot[],replaceDamaged=false,initiator?:HistoryIdentity){
    if(initiator&&!matchesIdentity(initiator)){setError('账户或历史已变化，请重新选择备份。');return false;}
    if(lock.current)return false;const expected=current.current,generation=epoch.current;if(!expected){setError('身份尚未确认，暂不能保存。');return false;}
    lock.current=true;setBusy(true);setError('');
    try{
      const user=await getCurrentUser();if(!alive.current||generation!==epoch.current||current.current!==expected)throw new Error('登录状态已变化，请重新打开历史后操作。');
      if((user?.id??'guest')!==expected){window.dispatchEvent(new Event(authChangeEvent));throw new Error('登录状态已变化，未保存到任何账号。');}
      const target=storage(expected),key=storageKey(expected);
      if(replaceDamaged&&(damagedRaw===null||target.getItem(key)!==damagedRaw))throw new Error('本机历史已经变化，未覆盖；请重新载入后核对。');
      const list=validateHistory(update(replaceDamaged?[]:read(expected))),raw=JSON.stringify(list);if(byteLength(raw)>4000000)throw new Error('本地历史超过 4 MB，请导出并删除部分快照。');
      if(replaceDamaged)target.setItem(`${key}:recovery:${crypto.randomUUID()}`,damagedRaw!);
      target.setItem(key,raw);setItems(list);setDamagedRaw(null);window.dispatchEvent(new Event(changeEvent));return true;
    }catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'存储失败，原历史仍保留。');return false;}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return {items,owner,error,busy,mutate,damagedRaw,identity,matchesIdentity};
}
export function ResearchResultActions({result,analysis}:{result:AnalysisResult;analysis:ResearchAnalysis}){
  const ctx=useResearchContext(),history=useHistory(),[name,setName]=useState(''),[message,setMessage]=useState(''),[savedLink,setSavedLink]=useState<{owner:string;href:string}|null>(null),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
  const mounted=useRef(true),lock=useRef(false),controller=useRef<AbortController|null>(null),latest=useRef({ctx,analysis,result});
  useLayoutEffect(()=>{latest.current={ctx,analysis,result};});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  if(!ctx)return null;
  async function save(){
    if(lock.current||!ctx?.dataFingerprint||!ctx.sourceFingerprint||!name.trim())return;
    const initiator=history.identity(),captured=ctx,settings=JSON.stringify({kind:analysis.kind,config:analysis.config}),summary=JSON.stringify(result);
    if(!initiator.owner)return;
    const snapshot:ResearchSnapshot={format:'acaora-analysis-snapshot',version:1,id:crypto.randomUUID(),name:name.trim(),createdAt:new Date().toISOString(),result:structuredClone(result),analysis:structuredClone(analysis),dataset:{name:ctx.data.name,rows:ctx.data.rows.length,headers:[...ctx.data.headers],fingerprint:ctx.dataFingerprint,sourceFingerprint:ctx.sourceFingerprint},workflow:structuredClone(ctx.workflow.records),dictionary:structuredClone(ctx.dictionary),joinHistory:structuredClone(ctx.joinHistory)};
    const unchanged=()=>{const current=latest.current;return mounted.current&&current.ctx?.data===captured.data&&current.ctx.source===captured.source&&current.ctx.dataFingerprint===captured.dataFingerprint&&current.ctx.sourceFingerprint===captured.sourceFingerprint&&current.ctx.workflow===captured.workflow&&current.ctx.dictionary===captured.dictionary&&JSON.stringify({kind:current.analysis.kind,config:current.analysis.config})===settings&&JSON.stringify(current.result)===summary;};
    lock.current=true;setSaving(true);setSaveError('');setMessage('');const abort=new AbortController();controller.current=abort;
    try{
      const execution=await runResearchWorker(captured.data,snapshot.analysis,[],abort.signal);
      if(execution.dataFingerprint!==captured.dataFingerprint)throw new Error('计算线程的数据指纹与当前处理表不符，未保存快照。');
      const identity=await makeExecutionIdentity(snapshot.analysis,execution.result.engine,execution.dataFingerprint,captured.sourceFingerprint);
      if(!unchanged()||!history.matchesIdentity(initiator))throw new Error('账户、数据或分析设置已变化，未保存过期快照；名称已保留，请核对后重试。');
      snapshot.baseline={format:'acaora-execution-baseline',version:1,identity,metrics:execution.result.metrics,environment:{userAgent:navigator.userAgent},capturedAt:new Date().toISOString()};
      const saved=await history.mutate(list=>{if(!unchanged())throw new Error('数据或分析设置已变化，未保存过期快照。');return [snapshot,...list];},false,initiator);
      if(saved&&unchanged()&&history.identity().owner===initiator.owner){setMessage('已保存命名快照与完整精度核验基线，可在分析历史查看与对照。');setSavedLink({owner:initiator.owner,href:withResearchProject('/data?'+new URLSearchParams({snapshot:snapshot.id})+'#history',new URLSearchParams(window.location.search).get('project'))});}
    }catch(cause){if(mounted.current)setSaveError(cause instanceof Error?cause.message:'无法保存核验基线，名称已保留，请重试。');}
    finally{lock.current=false;controller.current=null;if(mounted.current)setSaving(false);}
  }
  return <details className={styles.recipe}><summary>保存快照与导出复现包</summary><label className={styles.control}>分析快照名称<input maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="如：主模型 · HC3 · 第一版"/></label><Button variant="secondary" size="sm" disabled={!name.trim()||!ctx.dataFingerprint||!ctx.sourceFingerprint||!history.owner||history.busy||saving} onClick={()=>void save()}>{saving?'正在生成核验基线…':'保存命名快照'}</Button><p className={styles.help}>{history.owner==='guest'?'未登录：快照只保留在当前标签页。':'登录后：快照保存在此浏览器，按账号隔离，不在设备之间同步。'}最多 20 个 / 合计 4 MB；保存设置、摘要、汇总表、图及变量说明，排除逐行结果和数据行。快照保留默认图表标题与图注，编辑后的图请单独导出。</p><ReproductionTools analysis={analysis} result={result}/><DataResearchOperations analysis={analysis} result={result}/><LocalExecutionTools analysis={analysis}/>{saveError&&<p role="alert">{saveError}</p>}{history.error&&<p role="alert">{history.error}</p>}{ctx.fingerprintError&&<p role="alert">{ctx.fingerprintError}</p>}{message&&<p role="status">{message}</p>}{savedLink?.owner===history.owner&&<p><Link href={savedLink.href}>查看快照并关联项目</Link></p>}</details>;
}
export function AnalysisHistory(){
  return <Suspense fallback={<p role="status">正在读取分析历史…</p>}><AnalysisHistoryContent/></Suspense>;
}
function AnalysisHistoryContent(){
  const history=useHistory(),ctx=useResearchContext(),[selected,setSelected]=useState(''),[compare,setCompare]=useState(''),[rename,setRename]=useState('');
  const query=useSearchParams(),target=query.get('snapshot');
  const [importStatus,setImportStatus]=useState('');
  const [recovery,setRecovery]=useState<{snapshot:ResearchSnapshot;identity:HistoryIdentity}|null>(null),[recoveryAck,setRecoveryAck]=useState(false);
  async function confirmRecovery(){if(!recovery||!recoveryAck)return;if(await history.mutate(()=>[recovery.snapshot],true,recovery.identity)){setRecovery(null);setRecoveryAck(false);setImportStatus('快照已恢复，损坏原件已另存本机，其他账户历史未改变。');}}
  async function importSnapshot(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(!file)return;const initiator=history.identity();try{if(file.size>2000000)throw new Error('快照文件超过 2 MB。');const raw=await file.text();if(!history.matchesIdentity(initiator))throw new Error('账户或历史已变化，请重新选择备份。');const parsed=JSON.parse(raw),[snapshot]=validateHistory([parsed]);if(history.damagedRaw!==null){setRecovery({snapshot,identity:initiator});setRecoveryAck(false);setImportStatus('已验证备份；请确认后建立新历史。');return;}const existing=history.items.find(item=>item.id===snapshot.id);if(existing){if(JSON.stringify(existing)!==JSON.stringify(snapshot))throw new Error('同 ID 已有不同内容，未覆盖；请先备份并核对。');setImportStatus('相同快照已存在，无需重复导入。');return;}if(await history.mutate(list=>[snapshot,...list],false,initiator))setImportStatus('快照已恢复到本机。原数据仍需重新选择，未自动关联或写入项目。');}catch(cause){setImportStatus(cause instanceof Error?cause.message:'无法恢复快照。');}}
  function selectSnapshot(id:string){setSelected(id);setRename(history.items.find(v=>v.id===id)?.name??'');const url=new URL(window.location.href);if(id)url.searchParams.set('snapshot',id);else url.searchParams.delete('snapshot');window.history.replaceState(null,'',`${url.pathname}${url.search}#history`);}
  const a=history.items.find(v=>v.id===(target??selected)),b=history.items.find(v=>v.id===compare),labels=[...new Set([...(a?.result.metrics.map(v=>v[0])??[]),...(b?.result.metrics.map(v=>v[0])??[])])];
  return <details open={target?true:undefined} className={`quality-panel ${styles.history}`}><summary>分析历史与版本对照（{history.items.length}）</summary><p className={styles.help}>历史不会自动重算；先按数据指纹判断是否来自同一处理表。浏览器数据被清理后需从导出备份恢复，请及时导出重要快照。</p><label className={styles.control}>从 JSON 恢复快照<input type="file" accept="application/json,.json" disabled={!history.owner||history.busy} onChange={event=>void importSnapshot(event)}/></label>{history.damagedRaw!==null&&<section aria-label="损坏历史恢复"><p>账户已确认，但本机历史损坏。可先导出原件，再选择快照备份建立新历史；原件会另存本机，恢复不自动写入项目。</p><Button variant="secondary" onClick={()=>downloadRegressionFile(history.damagedRaw!,'acaora-damaged-history.txt','text/plain')}>导出损坏历史原件</Button>{recovery&&history.owner===recovery.identity.owner&&<><p>待恢复：{recovery.snapshot.name}</p><label><input type="checkbox" checked={recoveryAck} onChange={event=>setRecoveryAck(event.target.checked)}/>我确认用此备份建立新历史，并保留损坏原件</label><Button disabled={!recoveryAck||history.busy} onClick={()=>void confirmRecovery()}>确认恢复本机历史</Button></>}</section>}{importStatus&&<p role="status">{importStatus}</p>}{target&&history.owner&&!a&&<p role="alert">此账户在本机没有这份快照。可导入原导出 JSON 恢复；没有打开其他快照。</p>}<div className={styles.controls}><label className={styles.control}>查看快照<select value={a?.id??''} onChange={e=>selectSnapshot(e.target.value)}><option value="">选择已保存的分析</option>{history.items.map(v=><option key={v.id} value={v.id}>{v.name} · {v.createdAt.slice(0,16)}</option>)}</select></label><label className={styles.control}>对照快照<select value={b?.id??''} onChange={e=>setCompare(e.target.value)}><option value="">暂不对照</option>{history.items.filter(v=>v.id!==a?.id).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label></div>
    {a&&<section aria-label="已保存分析快照"><h3>{a.name}</h3><p>{a.result.method} · {a.dataset.name} · {a.dataset.rows} 行 · {a.createdAt}</p><p>{a.dataset.fingerprint===ctx?.dataFingerprint?'与当前处理表指纹一致。':'与当前处理表指纹不同。'}{b&&(a.dataset.fingerprint===b.dataset.fingerprint?' 两个快照使用同一处理表。':' 两个快照来自不同处理表，指标差异可能由样本变化引起。')}</p><p>{a.result.context}</p><AnalysisProjectLink key={`${history.owner}:${a.id}:${query.get('project')??''}`} snapshot={a} ownerId={history.owner}/><DataResearchOperations analysis={a.analysis} result={a.result} snapshot={a}/><LocalExecutionTools analysis={a.analysis} snapshot={a}/><label className={styles.control}>快照新名称<input maxLength={100} value={rename} onChange={e=>setRename(e.target.value)}/></label><div className={styles.actions}><Button variant="secondary" size="sm" disabled={!rename.trim()||history.busy} onClick={()=>void history.mutate(list=>list.map(v=>v.id===a.id?{...v,name:rename.trim()}:v))}>重命名快照</Button><Button variant="ghost" size="sm" onClick={()=>downloadRegressionFile(JSON.stringify(a,null,2),'acaora-analysis-snapshot.json','application/json')}>导出此快照 JSON</Button><Button variant="ghost" size="sm" disabled={history.busy} onClick={()=>void history.mutate(list=>list.filter(v=>v.id!==a.id))}>删除此快照</Button></div><div className={styles.scroll}><table><caption>已保存摘要；— 表示该方法没有此指标。</caption><thead><tr><th scope="col">指标</th><th scope="col">{a.name}</th>{b&&<th scope="col">{b.name}</th>}</tr></thead><tbody>{labels.map(label=><tr key={label}><th scope="row">{label}</th><td>{a.result.metrics.find(v=>v[0]===label)?.[1]??'—'}</td>{b&&<td>{b.result.metrics.find(v=>v[0]===label)?.[1]??'—'}</td>}</tr>)}</tbody></table></div><details><summary>查看保存的设置、处理记录与变量来源</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({analysis:a.analysis.config,workflow:a.workflow,dictionary:a.dictionary},null,2)}</pre></details>{a.analysis.kind!=='basic'&&a.analysis.charts?.map((spec,i)=><PaperChart key={`${a.id}-${i}`} spec={spec}/>)}</section>}{history.error&&<p role="alert">{history.error}</p>}
  </details>;
}
