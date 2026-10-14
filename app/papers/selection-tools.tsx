'use client';

import {useEffect, useState, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {Highlighter, MessageSquarePlus, X} from 'lucide-react';
import {selectionAnchors} from './paper-annotations.mjs';
import type {TextAnchor} from './paper-types';

export default function SelectionTools({rootRef,onCreate}: {rootRef:RefObject<HTMLDivElement|null>; onCreate:(anchors:TextAnchor[],highlightOnly:boolean)=>void}) {
 const [selection,setSelection]=useState<{anchors:TextAnchor[];left:number;top:number}|null>(null);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>;
  const capture=()=>{
   const root=rootRef.current, selected=window.getSelection();
   if(!root?.getClientRects().length||document.querySelector('dialog[open]')) {setSelection(null);return;}
   const anchors=selectionAnchors(root,selected);
   const bounds=selected?.rangeCount?selected.getRangeAt(0).getBoundingClientRect():null;
   setSelection(anchors.length&&bounds&&bounds.bottom>0&&bounds.top<innerHeight?{anchors,left:Math.max(12,Math.min(bounds.left,innerWidth-276)),top:Math.max(12,Math.min(bounds.bottom+10,innerHeight-64))}:null);
  };
  const changed=()=>{clearTimeout(timer);timer=setTimeout(capture,180);};
  const scroll=()=>setSelection(null);
  const keys=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){setSelection(null);return;}
   if(!event.altKey||!['a','m'].includes(event.key.toLowerCase())||document.querySelector('dialog[open]'))return;
   const root=rootRef.current;const anchors=root?selectionAnchors(root,window.getSelection()):[];
   if(!anchors.length)return;
   event.preventDefault();onCreate(anchors,event.key.toLowerCase()==='m');window.getSelection()?.removeAllRanges();setSelection(null);
  };
  document.addEventListener('selectionchange',changed);window.addEventListener('scroll',scroll,true);window.addEventListener('keydown',keys);
  return()=>{clearTimeout(timer);document.removeEventListener('selectionchange',changed);window.removeEventListener('scroll',scroll,true);window.removeEventListener('keydown',keys);};
 },[rootRef,onCreate]);
 function create(highlightOnly:boolean){if(selection)onCreate(selection.anchors,highlightOnly);window.getSelection()?.removeAllRanges();setSelection(null);}
 return selection&&createPortal(<div className="paper-selection-tools" role="toolbar" aria-label="选中文字工具" style={{left:selection.left,top:selection.top}}>
  <button type="button" aria-keyshortcuts="Alt+M" onClick={()=>create(true)}><Highlighter size={16} aria-hidden="true"/>高亮</button>
  <button type="button" aria-keyshortcuts="Alt+A" onClick={()=>create(false)}><MessageSquarePlus size={16} aria-hidden="true"/>添加批注</button>
  <button type="button" aria-label="关闭选中文字工具" onClick={()=>{window.getSelection()?.removeAllRanges();setSelection(null);}}><X size={16} aria-hidden="true"/></button>
 </div>,document.body);
}
