'use client';

import {useState} from 'react';
import type {PaperRecord} from './paper-types';

export function notesMarkdown(paper: PaperRecord) {
  const lines = [`# ${paper.title.replace(/\s*\n\s*/g, ' ')}`, '', `原文件：${paper.fileName}`, '', '页码对应原 PDF；P 编号对应当前提取正文。', ''];
  const sections = [...new Set(paper.paragraphs.map(p => p.section))];
  for (const section of sections) {
    const entries = paper.paragraphs.map((paragraph, index) => ({paragraph, index})).filter(({paragraph}) => paragraph.section === section && (paragraph.note.trim() || paragraph.bookmarked));
    if (!entries.length) continue;
    lines.push(`## ${section}`, '');
    for (const {paragraph, index} of entries) {
      lines.push(`### P${index + 1} · 第 ${paragraph.page} 页${paragraph.bookmarked ? ' · 已收藏' : ''}`, '', ...paragraph.original.split(/\r?\n/).map(line => `> ${line}`), '');
      if (paragraph.note.trim()) lines.push('笔记：', '', paragraph.note, '');
    }
  }
  return lines.join('\n');
}

export default function NotesSummary({paper, onSelect}: {paper: PaperRecord; onSelect: (index: number) => void}) {
  const [open, setOpen] = useState(false);
  const entries = paper.paragraphs.map((paragraph, index) => ({paragraph, index})).filter(({paragraph}) => paragraph.note.trim() || paragraph.bookmarked);
  function download() {
    const url = URL.createObjectURL(new Blob([notesMarkdown(paper)], {type: 'text/markdown;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${paper.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\p{Cc}/gu, '_').slice(0, 100) || 'paper'}-notes.md`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="paper-notes-summary">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)}>笔记汇总</button>
    {open && <section aria-label="笔记汇总">
      <div className="paper-notes-summary-head"><span>{entries.length} 段笔记 / 收藏</span><button type="button" disabled={!entries.length} onClick={download}>导出 Markdown</button></div>
      {!entries.length && <p>还没有笔记或收藏。阅读时记录重点，即可在这里汇总。</p>}
      {[...new Set(entries.map(({paragraph}) => paragraph.section))].map(section => <div key={section}>
        <h3>{section}</h3>
        {entries.filter(({paragraph}) => paragraph.section === section).map(({paragraph, index}) => <article key={paragraph.id}>
          <button type="button" onClick={() => onSelect(index)}>P{index + 1} · 第 {paragraph.page} 页{paragraph.bookmarked ? ' · 已收藏' : ''}</button>
          <blockquote>{paragraph.original}</blockquote>
          {paragraph.note.trim() && <p>{paragraph.note}</p>}
        </article>)}
      </div>)}
    </section>}
  </div>;
}
