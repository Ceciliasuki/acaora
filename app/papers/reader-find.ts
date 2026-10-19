import type {Paragraph} from './paper-types';

export type FindOptions = {query: string; caseSensitive: boolean};
export type FindRange = {start: number; end: number};
export type FindResult = {index: number; ranges: FindRange[]};

/** Literal original-text matches retain source UTF-16 offsets used by annotations. */
export function findInPaper(paragraphs: Paragraph[], {query, caseSensitive}: FindOptions): FindResult[] {
  const term = query.trim();
  if (!term) return [];
  const expression = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'gu' : 'giu');
  return paragraphs.flatMap((paragraph, index) => {
    const ranges = Array.from(paragraph.original.matchAll(expression), match => ({start: match.index, end: match.index + match[0].length}));
    return ranges.length ? [{index, ranges}] : [];
  });
}
