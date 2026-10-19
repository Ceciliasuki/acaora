'use client';
import SourcePreview from './source-preview';

import {useEffect, useRef, useState} from 'react';
import type {AnnotationDraft, PaperAnnotation, PaperRecord, TextAnchor} from './paper-types';
import {validAnnotations} from './paper-annotations.mjs';
import styles from './annotation-filters.module.css';
import {annotationKey, annotationMarkdown} from './annotation-collection';

export function AnnotationEditor({draft,onSave,onCancel}: {draft:AnnotationDraft;onSave:(draft:AnnotationDraft)=>void;onCancel:()=>void}) {
 const [comment,setComment]=useState(draft.comment);
 const [color,setColor]=useState(draft.color);
 const input=useRef<HTMLTextAreaElement>(null);
 useEffect(()=>{input.current?.focus();},[]);
 return <form className="paper-annotation-editor" aria-label={draft.annotationId?'编辑批注':'添加批注'} onSubmit={event=>{event.preventDefault();onSave({...draft,comment,color});}}>
  <h3>{draft.annotationId?'编辑批注':'添加批注'}</h3>
  <blockquote>{draft.anchors.map(anchor=>anchor.quote).join('\n')}</blockquote>
  <label>批注内容<textarea ref={input} aria-label="批注内容" value={comment} maxLength={5000} placeholder="记录你的理解、疑问或需要核对的依据" onChange={event=>setComment(event.target.value)}/></label>
  <fieldset><legend>高亮颜色</legend>{(['yellow','blue','green'] as const).map(value=><label key={value} className={`annotation-color color-${value}`}><input type="radio" name="annotation-color" value={value} checked={color===value} onChange={()=>setColor(value)}/>{{yellow:'黄色',blue:'蓝色',green:'绿色'}[value]}</label>)}</fieldset>
  <div className="paper-annotation-actions"><button type="submit">保存批注</button><button type="button" onClick={onCancel}>取消</button></div>
 </form>;
}

export default function AnnotationPanel({paper,onEdit,onDelete,onJump,onCreate,onCompare}: {paper:PaperRecord;onEdit:(paragraphId:string,annotation:PaperAnnotation)=>void;onDelete:(paragraphId:string,id:string)=>void;onJump:(index:number)=>void;onCreate:(anchors:TextAnchor[],highlightOnly:boolean)=>void;onCompare?:(index:number)=>void}) {
 const [query,setQuery]=useState('');
 const [color,setColor]=useState('all');
 const [commentsOnly,setCommentsOnly]=useState(false);
 const [sort,setSort]=useState('source');
 const [selected,setSelected]=useState<Set<string>>(new Set());
 const [feedback,setFeedback]=useState('');
 const entries=paper.paragraphs.flatMap((paragraph,index)=>validAnnotations(paragraph).map(annotation=>({paragraph,index,annotation})));
 const term=query.trim().toLocaleLowerCase();
 const filtered=entries.filter(({paragraph,annotation})=>(color==='all'||annotation.color===color)&&(!commentsOnly||annotation.comment.trim())&&(!term||[annotation.quote,annotation.comment,paragraph.section].some(text=>text.toLocaleLowerCase().includes(term)))).sort((a,b)=>sort==='newest'?b.annotation.createdAt-a.annotation.createdAt||a.index-b.index:a.index-b.index||a.annotation.start-b.annotation.start);
 const picked=entries.filter(({paragraph,annotation})=>selected.has(annotationKey(paragraph.id,annotation.id)));
 const allVisible=Boolean(filtered.length)&&filtered.every(({paragraph,annotation})=>selected.has(annotationKey(paragraph.id,annotation.id)));
 function choose(key:string){setSelected(previous=>{const next=new Set(previous);if(next.has(key))next.delete(key);else next.add(key);return next;});setFeedback('');}
 function collected(){return annotationMarkdown(paper,picked.map(({paragraph,index,annotation})=>({paragraphId:paragraph.id,index,section:paragraph.section,page:paragraph.page,annotation})));}
 function download(){
  const url=URL.createObjectURL(new Blob([collected()],{type:'text/markdown;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${paper.title.replace(/[<>:"/\\|?*]/g,'_').replace(/\p{Cc}/gu,'_').slice(0,90)||'paper'}-extracts.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setFeedback(`已导出 ${picked.length} 条摘录。`);
 }
 async function copy(){try{await navigator.clipboard.writeText(collected());setFeedback(`已复制 ${picked.length} 条带来源的摘录。`);}catch{setFeedback('剪贴板不可用，请使用“导出所选摘录”保存文件。');}}
 const hasFilters=Boolean(query||color!=='all'||commentsOnly);
 const active=paper.paragraphs[paper.activeParagraph];
 return <section className="paper-annotation-list" aria-label="划线批注">
  <header><h3>划线批注</h3><span>{entries.length}</span></header>
  {entries.length>0&&<div className={styles.filters}>
   <input type="search" aria-label="搜索批注" value={query} placeholder="搜索摘录、评论或章节" onChange={event=>setQuery(event.target.value)}/>
   <div><label>颜色<select aria-label="筛选批注颜色" value={color} onChange={event=>setColor(event.target.value)}><option value="all">全部颜色</option><option value="yellow">黄色</option><option value="blue">蓝色</option><option value="green">绿色</option></select></label><label><input type="checkbox" checked={commentsOnly} onChange={event=>setCommentsOnly(event.target.checked)}/>有评论</label></div>
   <label>排序<select aria-label="批注排序" value={sort} onChange={event=>setSort(event.target.value)}><option value="source">原文顺序</option><option value="newest">最近添加</option></select></label>
   {hasFilters&&<p role="status">显示 {filtered.length} / {entries.length} 条<button type="button" onClick={()=>{setQuery('');setColor('all');setCommentsOnly(false);}}>清除筛选</button></p>}
   {!filtered.length&&<p>没有符合条件的批注，请调整筛选。</p>}
  </div>}
  {entries.length>0&&<div className={styles.collection} aria-label="批注摘录集">
   <label><input type="checkbox" aria-label="选择当前筛选结果" checked={allVisible} disabled={!filtered.length} ref={node=>{if(node)node.indeterminate=!allVisible&&filtered.some(({paragraph,annotation})=>selected.has(annotationKey(paragraph.id,annotation.id)));}} onChange={()=>{setSelected(previous=>{const next=new Set(previous);for(const {paragraph,annotation} of filtered){const key=annotationKey(paragraph.id,annotation.id);if(allVisible)next.delete(key);else next.add(key);}return next;});setFeedback('');}}/>选择当前结果</label>
   <p>已选 {picked.length} 条{picked.some(entry=>!filtered.includes(entry))?'（含其他筛选中的批注）':''}</p>
   <div><button type="button" disabled={!picked.length} onClick={download}>导出所选摘录</button><button type="button" disabled={!picked.length} onClick={()=>void copy()}>复制所选摘录</button>{picked.length>0&&<button type="button" onClick={()=>{setSelected(new Set());setFeedback('');}}>清空选择</button>}</div>
   {feedback&&<p role="status">{feedback}</p>}
  </div>}
  {!entries.length&&<p>选中文字后添加高亮或批注。也可用 Alt＋M 高亮、Alt＋A 批注。</p>}
  {active&&<button className="paper-annotate-paragraph" type="button" onClick={()=>onCreate([{paragraphId:active.id,start:0,end:active.original.length,quote:active.original}],false)}>批注当前段落</button>}
  {filtered.map(({paragraph,index,annotation})=><article key={annotationKey(paragraph.id,annotation.id)} className={`annotation-entry color-${annotation.color}`}>
   <label className={styles.pick}><input type="checkbox" aria-label={`选择 P${index+1} 的批注：${annotation.quote.slice(0,40)}`} checked={selected.has(annotationKey(paragraph.id,annotation.id))} onChange={()=>choose(annotationKey(paragraph.id,annotation.id))}/>加入摘录集</label>
   <SourcePreview paper={paper} index={index} onNavigate={onJump} onCompare={onCompare}/><button className="annotation-location" type="button" onClick={()=>onJump(index)}>P{index+1} · 第 {paragraph.page} 页</button>
   <blockquote>{annotation.quote}</blockquote>{annotation.comment&&<p>{annotation.comment}</p>}
   <div><button type="button" onClick={()=>onEdit(paragraph.id,annotation)}>编辑批注</button><button type="button" aria-label={`删除批注：${annotation.quote.slice(0,40)}`} onClick={()=>onDelete(paragraph.id,annotation.id)}>删除</button></div>
  </article>)}
 </section>;
}
