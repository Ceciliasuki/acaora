'use client';
import {useRef, useState} from 'react';
import {Dialog} from '../components/ui';
import {exportPaperBackup,MAX_BACKUP_BYTES,parsePaperBackup} from './paper-backup';
import type {PaperRecord} from './paper-types';

export default function PaperBackupTools({getRecords,onRestore,disabled}:{getRecords:()=>Promise<PaperRecord[]>;onRestore:(papers:PaperRecord[])=>Promise<void>;disabled:boolean}) {
  const file = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const [busy,setBusy] = useState(false);
  const [preview,setPreview] = useState<PaperRecord[]|null>(null);
  const [message,setMessage] = useState('');
  async function run(action:()=>Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {await action();} catch(error) {setMessage(error instanceof Error ? error.message : '备份操作未完成。');}
    finally {lock.current = false; setBusy(false);}
  }
  return <div className="paper-backup-tools">
    <div className="paper-backup-actions"><button type="button" disabled={busy||disabled} onClick={()=>void run(async()=>{
      const content = exportPaperBackup(await getRecords());
      const url = URL.createObjectURL(new Blob([content],{type:'application/json'}));
      const a = document.createElement('a'); a.href=url; a.download='acaora-paper-backup.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      setMessage('研究记录备份已导出，不包含原始 PDF。');
    })}>备份记录</button><button type="button" disabled={busy||disabled} onClick={()=>file.current?.click()}>恢复备份</button></div>
    <input className="sr-only" ref={file} type="file" accept=".json,application/json" aria-label="选择论文备份文件" disabled={busy||disabled} onChange={event=>{
      const selected=event.currentTarget.files?.[0]; event.currentTarget.value=''; if(!selected)return;
      void run(async()=>{if(selected.size>MAX_BACKUP_BYTES)throw new Error('备份文件不得超过 12 MB。'); setPreview(parsePaperBackup(await selected.text()));});
    }}/>
    {message&&<p role="status">{message}</p>}
    {preview&&<Dialog open title="恢复研究记录" description="将创建新副本，保留现有记录。原始 PDF 需在阅读器中重新选择。登录时，新副本的文本和笔记会按当前账户同步。" busy={busy} confirmLabel={busy?'正在恢复…':`恢复 ${preview.length} 篇新副本`} onClose={()=>{if(!busy)setPreview(null);}} onConfirm={()=>void run(async()=>{await onRestore(preview); setPreview(null); setMessage(`已恢复 ${preview.length} 篇新副本。`);})}>
      <ul>{preview.map((paper,index)=><li key={index}>{paper.title} · {paper.paragraphs.length} 段 · {paper.paragraphs.filter(p=>p.note).length} 条笔记 · {paper.paragraphs.reduce((n,p)=>n+(p.annotations?.length??0),0)} 条批注</li>)}</ul>
      {message&&<p role="alert">{message}</p>}
    </Dialog>}
  </div>;
}
