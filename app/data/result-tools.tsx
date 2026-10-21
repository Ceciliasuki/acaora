"use client";
import {useRef, useState} from 'react';
import {Copy, Pin, X} from 'lucide-react';
import {ResearchResultActions,type ResearchAnalysis} from './research-history';
import {Button} from '../components/ui';

export type AnalysisResult = {source:string; sample:boolean; method:string; context:string; metrics:Array<readonly [string,string]>};
function resultText(result:AnalysisResult) {
  return [`${result.source}${result.sample ? '（示例数据）' : ''}`,result.method,result.context,...result.metrics.map(([label,value])=>`${label}：${value}`),'数值精度与页面显示一致；此副本不包含原始数据行。'].join('\n');
}

/** One session-only comparison, scoped by the dataset key supplied by the page. */
export default function ResultTools({result,analysis}:{result:AnalysisResult|null;analysis?:ResearchAnalysis}) {
  const [pinned,setPinned]=useState<AnalysisResult|null>(null);
  const [copyState,setCopyState]=useState<{text:string;state:'copied'|'error'}|null>(null);
  const [copying,setCopying]=useState(false);
  const copyLock=useRef(false);
  const text=result ? resultText(result) : '';
  const feedback=copyState?.text===text ? copyState.state : null;
  async function copy() {
    if(!result || copyLock.current)return;
    copyLock.current=true;setCopying(true);setCopyState(null);
    try {await navigator.clipboard.writeText(text);setCopyState({text,state:'copied'});}
    catch {setCopyState({text,state:'error'});}
    finally {copyLock.current=false;setCopying(false);}
  }
  const labels=[...new Set([...(pinned?.metrics.map(([label])=>label)??[]),...(result?.metrics.map(([label])=>label)??[])])];
  return <div className="data-result-tools">
    <div className="data-result-actions">
      <Button variant="secondary" size="sm" disabled={!result} onClick={()=>{if(result)setPinned(structuredClone(result));}}><Pin size={15} aria-hidden="true"/>{pinned?'替换固定结果':'固定本次结果'}</Button>
      <Button variant="ghost" size="sm" disabled={!result || copying} onClick={()=>void copy()}><Copy size={15} aria-hidden="true"/>{copying?'正在复制…':'复制当前结果'}</Button>
      {pinned && <Button variant="ghost" size="sm" onClick={()=>setPinned(null)}><X size={15} aria-hidden="true"/>取消固定</Button>}
      {feedback==='copied' && <span role="status">已复制，包含数据来源与分析条件</span>}
    </div>
    {feedback==='error' && <div className="data-copy-fallback"><p role="alert">浏览器未允许自动复制。可选中下面的结果手动复制。</p><textarea aria-label="可手动复制的分析结果" readOnly value={text} onFocus={event=>event.currentTarget.select()}/></div>}
    {result&&analysis&&<ResearchResultActions result={result} analysis={analysis}/>}
    {pinned && <details className="data-result-comparison"><summary>查看固定结果对照</summary>
      <header><h3>结果对照</h3></header>
      <p>{pinned.source}{pinned.sample?' · 示例数据':''} · 本次页面有效，重新导入数据后清除</p>
      <div className="data-comparison-context"><div><strong>固定结果 · {pinned.method}</strong><span>{pinned.context}</span></div><div><strong>当前结果{result?` · ${result.method}`:''}</strong><span>{result?.context??'当前选择没有可用结果'}</span></div></div>
      <div className="table-wrap" role="region" aria-label="结果对照表，可横向滚动"><button type="button" className="sr-only" aria-label="使用左右方向键横向滚动结果对照表" onKeyDown={event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();event.currentTarget.parentElement?.scrollBy({left:event.key==='ArrowRight'?160:-160});}}>横向滚动对照表</button><table><thead><tr><th scope="col">指标</th><th scope="col">固定结果</th><th scope="col">当前结果</th></tr></thead><tbody>{labels.map(label=><tr key={label}><th scope="row">{label}</th><td>{pinned.metrics.find(([name])=>name===label)?.[1]??'—'}</td><td>{result?.metrics.find(([name])=>name===label)?.[1]??'—'}</td></tr>)}</tbody></table></div>
      <small>— 表示该方法没有此指标或当前没有可用结果；对照不改变分析方法。</small>
    </details>}
  </div>;
}
