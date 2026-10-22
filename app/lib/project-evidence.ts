/** A saved source snapshot. Removing a source paper does not erase this quotation. */
export type ProjectEvidence = {
  id: string;
  paperId: string;
  paragraphId: string;
  paperTitle: string;
  fileName: string;
  page: number;
  section: string;
  quote: string;
  comment: string;
  createdAt: number;
  annotationId?: string;
  start?: number;
  end?: number;
};

export type ProjectEvidenceDraft = Omit<ProjectEvidence, 'id' | 'createdAt'>;

const fields = new Set(['id', 'paperId', 'paragraphId', 'paperTitle', 'fileName', 'page', 'section', 'quote', 'comment', 'createdAt', 'annotationId', 'start', 'end']);
const identifier = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
const text = (value: unknown, max: number, required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);

/** Strictly validate the persisted shape; destinations are derived, never stored URLs. */
export function validateProjectEvidence(value: unknown): value is ProjectEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (Object.keys(item).some(key => !fields.has(key))) return false;
  if (!identifier(item.id) || !identifier(item.paperId) || !identifier(item.paragraphId)) return false;
  if (!text(item.paperTitle, 500, true) || !text(item.fileName, 500, true) || !text(item.section, 500)) return false;
  if (!text(item.quote, 30_000, true) || !text(item.comment, 5_000)) return false;
  if (!Number.isSafeInteger(item.page) || (item.page as number) < 1 || (item.page as number) > 1_000_000) return false;
  if (!Number.isSafeInteger(item.createdAt) || (item.createdAt as number) <= 0) return false;
  if (item.annotationId !== undefined && !identifier(item.annotationId)) return false;
  if (item.start !== undefined || item.end !== undefined) {
    if (!Number.isSafeInteger(item.start) || !Number.isSafeInteger(item.end) || (item.start as number) < 0 || (item.end as number) <= (item.start as number)) return false;
    if ((item.end as number) - (item.start as number) !== (item.quote as string).length) return false;
  }
  return true;
}

export function paperSourceHref(evidence: Pick<ProjectEvidence, 'paperId' | 'paragraphId'>) {
  const query = new URLSearchParams({paper: evidence.paperId, paragraph: evidence.paragraphId});
  return `/papers?${query.toString()}`;
}

/** Personal comments can change without making the same quotation a new source. */
export function evidenceDuplicateKey(evidence: Pick<ProjectEvidence, 'paperId' | 'paragraphId' | 'quote'>) {
  return JSON.stringify([evidence.paperId, evidence.paragraphId, evidence.quote]);
}
