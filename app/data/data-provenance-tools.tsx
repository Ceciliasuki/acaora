'use client';
import {useRef,useState,useEffect,useLayoutEffect} from 'react';
import {Button} from '../components/ui';
import {getCurrentUser} from '../lib/auth-client';
import {useResearchContext} from './research-context';
import {canonicalJson,type DataProvenance,type LedgerEvent} from '../lib/research-ledger';
import type {ResearchLedger} from '../projects/use-research-ledger';
import styles from './multiple-regression.module.css';
export default function DataProvenanceTools({ownerId,projectId,ledger}:{ownerId:string;projectId:string;ledger:ResearchLedger}){
 const ctx=useResearchContext(),[selected,setSelected]=useState(''),[name,setName]=useState(''),[source,setSource]=useState(''),[description,setDescription]=useState(''),[message,setMessage]=useState('');
 const attempt=useRef<{key:string;payload:DataProvenance;previous?:LedgerEvent}|null>(null),latest=useRef(ctx),alive=useRef(true);useLayoutEffect(()=>{latest.current=ctx;},[ctx]);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[ownerId,projectId]);
 const datasets=ledger.current.filter(e=>e.collection==='dataset'&&!e.archived),previous=datasets.find(e=>e.entity_id===selected);
 async function capture(){if(!ctx?.sourceFingerprint||!ctx.dataFingerprint)return;const current=ctx;setMessage('');if(previous&&previous.payload.sourceFingerprint!==ctx.sourceFingerprint){setMessage('所选来源的原表指纹不同。请为这份原表新建来源记录。');return;}
 const key=JSON.stringify({selected,revision:previous?.revision,name,source,description,sourceHash:ctx.sourceFingerprint,dataHash:ctx.dataFingerprint,steps:ctx.workflow.records,dictionary:ctx.dictionary});
 if(attempt.current&&attempt.current.key!==key){setMessage('上一次保存结果尚未确认，请先恢复上次输入重试，或刷新记录核对后开始新的捕获。');return;}
 if(!attempt.current){const existing=previous?.payload as unknown as DataProvenance|undefined,versions=existing?.versions??[],last=versions.at(-1);if(last?.fingerprint===ctx.dataFingerprint&&canonicalJson(existing?.dictionary??[])===canonicalJson(ctx.dictionary)){setMessage('这个处理版本已经登记，无需重复捕获。');return;}
 const payload:DataProvenance=existing?structuredClone(existing):{name:name.trim(),source:source.trim(),url:'',accessedAt:new Date().toISOString(),license:'',coverage:'',unit:'',notes:'',sourceFingerprint:ctx.sourceFingerprint,versions:[]};
 payload.dictionary=structuredClone(ctx.dictionary);
 if(payload.versions.at(-1)?.fingerprint!==ctx.dataFingerprint)payload.versions.push({id:crypto.randomUUID(),name:description.trim()||`处理版本 ${payload.versions.length+1}`,fingerprint:ctx.dataFingerprint,parentFingerprint:ctx.dataFingerprint===ctx.sourceFingerprint?'':ctx.sourceFingerprint,rows:ctx.data.rows.length,columns:ctx.data.headers.length,description:description.trim(),createdAt:new Date().toISOString(),steps:ctx.workflow.records.map(record=>record.step)});attempt.current={key,payload,previous};}
 if((await getCurrentUser())?.id!==ownerId||!alive.current||latest.current?.source!==current.source||latest.current?.data!==current.data)return;
 const event=await ledger.save('dataset',attempt.current.payload as unknown as Record<string,unknown>,attempt.current.previous);if(alive.current&&event){attempt.current=null;setSelected(event.entity_id);setMessage('数据来源与处理谱系已登记；云端只保存指纹和步骤，不包含数据行。');}}
 return <details className={styles.recipe}><summary>捕获数据来源与处理版本</summary><p className={styles.help}>捕获当前原表与处理表的 SHA-256、行列数和实际处理步骤。每条处理链从原表开始重放；已登记来源的许可、样本范围可回到项目补充。</p><label className={styles.control}>登记到数据来源<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">新建来源记录</option>{datasets.map(e=><option key={e.entity_id} value={e.entity_id}>{String(e.payload.name)}</option>)}</select></label>{!previous&&<div className={styles.controls}><label className={styles.control}>来源名称<input value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></label><label className={styles.control}>来源机构 / 数据库<input value={source} maxLength={4000} onChange={e=>setSource(e.target.value)}/></label></div>}<label className={styles.control}>版本名称与变更说明<input value={description} maxLength={200} onChange={e=>setDescription(e.target.value)}/></label><Button variant="secondary" disabled={ledger.busy||!ctx?.dataFingerprint||!previous&&(!name.trim()||!source.trim())} onClick={()=>void capture()}>捕获当前数据版本</Button>{message&&<p role="status">{message}</p>}</details>;
}
