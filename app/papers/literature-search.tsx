'use client';

import {useEffect,useRef,useState} from 'react';
import {papersRis,safeLink} from './literature-search.mjs';
import type {SearchPaper} from './paper-types';

type Criteria={q:string;field:string;from:string;to:string;type:string;sort:string};
type Results={papers:SearchPaper[];source?:string;total?:number|null;page?:number;pageSize?:number;hasMore?:boolean};
const initial=(q:string):Criteria=>({q,field:'keywords',from:'',to:'',type:'all',sort:'relevance'});
const types:Record<string,string>={'journal-article':'期刊论文','proceedings-article':'会议论文',dissertation:'学位论文','book-chapter':'书籍章节'};

export default function LiteratureSearch({seed}:{seed:string}) {
 const [criteria,setCriteria]=useState(()=>initial(seed));
 const [results,setResults]=useState<(Results&{criteria:Criteria;page:number})|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState('');
 const [selected,setSelected]=useState<Map<string,SearchPaper>>(new Map());
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{
  let active=true;controller.current?.abort();
  void Promise.resolve().then(()=>{if(active){setCriteria(initial(seed));setResults(null);setSelected(new Map());setError('');setBusy(false);}});
  return()=>{active=false;controller.current?.abort();};
 },[seed]);
 async function search(input:Criteria,page=1) {
  controller.current?.abort();const request=new AbortController();controller.current=request;
  setBusy(true);setError('');setStatus('');setResults(null);if(page===1)setSelected(new Map());
  try {
   const response=await fetch(`/api/papers/search?${new URLSearchParams({...input,page:String(page)})}`,{signal:request.signal});
   const payload=await response.json() as Results&{error?:string};
   if(!response.ok)throw new Error(payload.error??'检索暂不可用，请重试。');
   if(controller.current===request&&!request.signal.aborted)setResults({...payload,papers:Array.isArray(payload.papers)?payload.papers:[],criteria:{...input},page});
  }catch(problem){if(controller.current===request&&!request.signal.aborted)setError(problem instanceof Error?problem.message:'检索失败，请重试。');}
  finally{if(controller.current===request&&!request.signal.aborted)setBusy(false);}
 }
 function change(field:keyof Criteria,value:string){setCriteria(previous=>({...previous,[field]:value}));}
 function exportRis(){
  const url=URL.createObjectURL(new Blob([papersRis([...selected.values()])],{type:'application/x-research-info-systems;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='acaora-references.ris';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus(`已导出${selected.size}条文献，可导入Zotero等文献管理器。`);
 }
 async function copyDoi(doi:string){try{await navigator.clipboard.writeText(doi);setStatus('DOI已复制。');}catch{setStatus(`无法访问剪贴板，请手动复制：${doi}`);}}
 return <section className="literature-search" aria-label="文献检索">
  <header><h2>文献检索</h2><p>查找中英文文献，筛选结果并导出引用。</p></header>
  <form onSubmit={event=>{event.preventDefault();void search(criteria);}}>
   <div className="literature-query"><label><span className="sr-only">检索字段</span><select aria-label="检索字段" value={criteria.field} onChange={event=>change('field',event.target.value)}><option value="keywords">标题 / 关键词</option><option value="author">作者</option><option value="journal">期刊</option><option value="doi">DOI</option></select></label>
    <input aria-label="论文检索关键词" value={criteria.q} maxLength={300} onChange={event=>change('q',event.target.value)} placeholder="输入中文、英文关键词或完整 DOI" autoComplete="off"/>
    <button type="submit" disabled={busy}>{busy?'检索中…':'检索'}</button>
   </div>
   <div className="literature-filters">
    <fieldset><legend className="sr-only">发表年份范围</legend><label>从<input aria-label="起始年份" inputMode="numeric" maxLength={4} placeholder="年份" value={criteria.from} onChange={event=>change('from',event.target.value)}/></label><label>至<input aria-label="结束年份" inputMode="numeric" maxLength={4} placeholder="年份" value={criteria.to} onChange={event=>change('to',event.target.value)}/></label></fieldset>
    <label>类型<select aria-label="文献类型" value={criteria.type} onChange={event=>change('type',event.target.value)}><option value="all">全部类型</option>{Object.entries(types).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>排序<select aria-label="结果排序" value={criteria.sort} onChange={event=>change('sort',event.target.value)}><option value="relevance">相关度</option><option value="newest">最新优先</option><option value="citations">被引次数</option></select></label>
   </div>
  </form>
  <details className="literature-source"><summary>数据来源与覆盖</summary><p>主要检索Crossref中已登记DOI的中英文文献；“标题 / 关键词”使用书目信息匹配，可能同时匹配作者等信息。中文收录和学位论文覆盖不等同于知网，全文访问以出版来源权限为准。检索词发送至公共索引，正文和笔记不会自动提交。</p><a href="https://www.crossref.org/" target="_blank" rel="noreferrer">Crossref</a></details>
  {busy&&<div className="literature-loading" role="status">正在检索公共学术索引…</div>}
  {error&&<div className="literature-error" role="alert"><p>{error}</p><button type="button" onClick={()=>void search(criteria)}>重新检索</button></div>}
  {status&&<p className="literature-status" role="status">{status}</p>}
  {results&&<>
   <div className="literature-results-head"><div><h3>“{results.criteria.q}”的结果</h3><p>{results.source??'公共学术索引'}{typeof results.total==='number'?` · 索引返回 ${results.total.toLocaleString('zh-CN')} 条`:''} · 第 {results.page} 页</p></div><button type="button" disabled={!selected.size} onClick={exportRis}>导出引用{selected.size?`（${selected.size}）`:''}</button></div>
   {!results.papers.length?<p className="literature-empty">没有符合当前条件的文献。可调整关键词或放宽年份、类型范围后重试。</p>:<ol className="literature-records">{results.papers.map(paper=>{
    const key=`${paper.source}:${paper.id}`,url=safeLink(paper.url),pdf=safeLink(paper.pdfUrl);
    return <li key={key}>
     <label className="literature-select"><input type="checkbox" aria-label={`选择文献：${paper.title}`} checked={selected.has(key)} onChange={event=>{const checked=event.target.checked;setSelected(previous=>{const next=new Map(previous);if(checked)next.set(key,paper);else next.delete(key);return next;});}}/></label>
     <article><h3>{url?<a href={url} target="_blank" rel="noreferrer">{paper.title}</a>:paper.title}</h3>
      <p className="literature-metadata">{paper.authors.length?paper.authors.join(' · '):'作者未提供'}{paper.venue?` · ${paper.venue}`:''}{paper.year!==null?` · ${paper.year}`:''}{paper.type&&types[paper.type]?` · ${types[paper.type]}`:''}{paper.citationCount!==null?` · 被引 ${paper.citationCount}`:''}</p>
      {paper.abstract&&<details><summary>摘要</summary><p>{paper.abstract}</p></details>}
      <div className="literature-actions">{url&&<a href={url} target="_blank" rel="noreferrer">查看来源</a>}{pdf&&<a href={pdf} target="_blank" rel="noreferrer">开放全文</a>}{paper.doi&&<button type="button" onClick={()=>void copyDoi(paper.doi)}>复制DOI</button>}</div>
     </article>
    </li>;
   })}</ol>}
   <nav className="literature-pagination" aria-label="检索结果分页"><button type="button" disabled={results.page<=1} onClick={()=>void search(results.criteria,results.page-1)}>上一页</button><span>第 {results.page} 页</span><button type="button" disabled={!results.hasMore||results.page>=100} onClick={()=>void search(results.criteria,results.page+1)}>下一页</button></nav>
  </>}
 </section>;
}
