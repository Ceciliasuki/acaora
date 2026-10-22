import type {AiMemory, AiSavedResult, PaperRecord, Paragraph} from './paper-types';
import {normalizeBibliography} from './paper-bibliography';

export const MAX_BACKUP_BYTES = 12 * 1024 * 1024;
const invalid = () => new Error('备份格式不正确或内容超出限制，未恢复任何记录。');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number) {
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value;
}
function number(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 8.64e15) throw invalid();
  return value;
}
function boolean(value: unknown) {if (typeof value !== 'boolean') throw invalid(); return value;}
function jsonValue(value: unknown, depth = 0): unknown {
  if (depth > 30) throw invalid();
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => jsonValue(item, depth + 1));
  const entries = Object.entries(object(value)).filter(([key]) => !/^(?:__proto__|constructor|prototype)$|api.?key|access.?token|refresh.?token|authorization|password|secret/i.test(key));
  return Object.fromEntries(entries.map(([key,item]) => [key,jsonValue(item, depth + 1)]));
}
function aiResult(value: unknown): AiSavedResult {
  const item = object(value);
  return {action:string(item.action,100),title:string(item.title,1000),createdAt:number(item.createdAt),data:jsonValue(object(item.data)) as Record<string,unknown>};
}
function memory(value: unknown): AiMemory | undefined {
  if (value === undefined) return;
  const item = object(value), paragraph = object(item.paragraph);
  if (!Array.isArray(item.chats) || item.chats.length > 10000) throw invalid();
  const result: AiMemory = {paragraph:Object.fromEntries(Object.entries(paragraph).map(([id,result]) => [id,aiResult(result)])),chats:item.chats.map(aiResult)};
  for (const key of ['summary','audit','replication','search'] as const) if (item[key] !== undefined) result[key] = aiResult(item[key]);
  return result;
}
function paragraph(value: unknown): Paragraph {
  const p = object(value);
  const original = string(p.original,500000), id = string(p.id,200);
  const page = number(p.page);
  if (!id || !Number.isInteger(page) || page < 1) throw invalid();
  const annotations: Paragraph['annotations'] = [];
  if (p.annotations !== undefined) {
    if (!Array.isArray(p.annotations) || p.annotations.length > 10000) throw invalid();
    const ids = new Set<string>();
    for (const raw of p.annotations) {
      const a = object(raw), start = number(a.start), end = number(a.end), quote = string(a.quote,500000), annotationId = string(a.id,200);
      if (!annotationId || ids.has(annotationId) || !Number.isInteger(start) || !Number.isInteger(end) || end <= start || original.slice(start,end) !== quote || end > original.length || !['yellow','blue','green'].includes(String(a.color))) throw invalid();
      ids.add(annotationId);
      annotations.push({id:annotationId,start,end,quote,comment:string(a.comment,500000),color:a.color as 'yellow'|'blue'|'green',createdAt:number(a.createdAt)});
    }
  }
  return {id,page,section:string(p.section,1000),original,translation:string(p.translation,500000),note:string(p.note,500000),bookmarked:boolean(p.bookmarked),read:boolean(p.read),annotations};
}
function record(value: unknown): PaperRecord {
  const p = object(value);
  if (!Array.isArray(p.paragraphs) || !p.paragraphs.length || p.paragraphs.length > 20000) throw invalid();
  const paragraphs = p.paragraphs.map(paragraph), ids = new Set(paragraphs.map(p => p.id));
  const activeParagraph = number(p.activeParagraph);
  if (ids.size !== paragraphs.length || !Number.isInteger(activeParagraph) || activeParagraph >= paragraphs.length) throw invalid();
  const bibliography = normalizeBibliography(p.bibliography);
  if (p.bibliography !== undefined && !bibliography) throw invalid();
  // A whitelist excludes owner IDs, provider settings, credentials and PDF bytes.
  return {id:string(p.id,200),title:string(p.title,1000),fileName:string(p.fileName,1000),addedAt:number(p.addedAt),updatedAt:number(p.updatedAt),activeParagraph,paragraphs,aiMemory:memory(p.aiMemory),bibliography};
}
export function exportPaperBackup(papers: PaperRecord[], now = Date.now()) {
  if (!papers.length || papers.length > 200) throw new Error('请一次备份 1 至 200 篇论文。');
  const json = JSON.stringify({format:'acaora-paper-backup',version:1,exportedAt:now,papers:papers.map(record)},null,2);
  if (new TextEncoder().encode(json).length > MAX_BACKUP_BYTES) throw new Error('备份超过 12 MB，请减少论文数量。');
  return json;
}
export function parsePaperBackup(text: string): PaperRecord[] {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw invalid();
  const data = object(JSON.parse(text));
  if (data.format !== 'acaora-paper-backup' || data.version !== 1 || !Array.isArray(data.papers) || !data.papers.length || data.papers.length > 200) throw invalid();
  return data.papers.map(record);
}
export function restoredPaperCopies(papers: PaperRecord[], ownerId: string | null, now = Date.now(), uuid = () => crypto.randomUUID()): PaperRecord[] {
  return papers.map(paper => ({...record(paper),id:uuid(),ownerId:ownerId ?? undefined,updatedAt:now}));
}
