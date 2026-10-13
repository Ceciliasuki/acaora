'use client';

import {useEffect, useRef, useState} from 'react';
import type {AnnotationDraft, PaperAnnotation, PaperRecord, TextAnchor} from './paper-types';
import {validAnnotations} from './paper-annotations.mjs';

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

export default function AnnotationPanel({paper,onEdit,onDelete,onJump,onCreate}: {paper:PaperRecord;onEdit:(paragraphId:string,annotation:PaperAnnotation)=>void;onDelete:(paragraphId:string,id:string)=>void;onJump:(index:number)=>void;onCreate:(anchors:TextAnchor[],highlightOnly:boolean)=>void}) {
 const entries=paper.paragraphs.flatMap((paragraph,index)=>validAnnotations(paragraph).map(annotation=>({paragraph,index,annotation})));
 const active=paper.paragraphs[paper.activeParagraph];
 return <section className="paper-annotation-list" aria-label="划线批注">
  <header><h3>划线批注</h3><span>{entries.length}</span></header>
  {!entries.length&&<p>选中文字后添加高亮或批注。也可用 Alt＋M 高亮、Alt＋A 批注。</p>}
  {active&&<button className="paper-annotate-paragraph" type="button" onClick={()=>onCreate([{paragraphId:active.id,start:0,end:active.original.length,quote:active.original}],false)}>批注当前段落</button>}
  {entries.map(({paragraph,index,annotation})=><article key={annotation.id} className={`annotation-entry color-${annotation.color}`}>
   <button className="annotation-location" type="button" onClick={()=>onJump(index)}>P{index+1} · 第 {paragraph.page} 页</button>
   <blockquote>{annotation.quote}</blockquote>{annotation.comment&&<p>{annotation.comment}</p>}
   <div><button type="button" onClick={()=>onEdit(paragraph.id,annotation)}>编辑批注</button><button type="button" aria-label={`删除批注：${annotation.quote.slice(0,40)}`} onClick={()=>onDelete(paragraph.id,annotation.id)}>删除</button></div>
  </article>)}
 </section>;
}
