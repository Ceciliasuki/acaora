import type {PaperAnnotation, PaperRecord} from './paper-types';

export type CollectedAnnotation = {paragraphId: string; index: number; section: string; page: number; annotation: PaperAnnotation};
export const annotationKey = (paragraphId: string, annotationId: string) => JSON.stringify([paragraphId, annotationId]);

/** A source-linked extract, rather than an invented bibliographic citation. */
export function annotationMarkdown(paper: Pick<PaperRecord, 'title' | 'fileName'>, entries: CollectedAnnotation[]) {
  const lines = [`# ${paper.title.replace(/\s*\n\s*/g, ' ')} · 批注摘录`, '', `原文件：${paper.fileName}`, '', '页码对应原 PDF；P 编号对应当前提取正文。摘录与个人评论分别列出。', ''];
  for (const entry of [...entries].sort((a, b) => a.index - b.index || a.annotation.start - b.annotation.start)) {
    lines.push(`## ${entry.section} · P${entry.index + 1} · 第 ${entry.page} 页`, '', ...entry.annotation.quote.split(/\r?\n/).map(line => `> ${line}`), '');
    if (entry.annotation.comment.trim()) lines.push('个人评论：', '', entry.annotation.comment, '');
  }
  return lines.join('\n');
}
