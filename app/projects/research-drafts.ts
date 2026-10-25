import {validateResearchDossier, type ResearchDossier} from '../lib/project-research';

export type ResearchDraft = {version: 1; ownerId: string; projectId: string; baseline: string; value: ResearchDossier};
const key = (ownerId: string, projectId: string) => `acaora.research-draft.v1:${encodeURIComponent(ownerId)}:${encodeURIComponent(projectId)}`;
export function readResearchDraft(ownerId: string, projectId: string): {draft: ResearchDraft | null; raw: string | null; error: string} {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key(ownerId, projectId));
    if (!raw) return {draft: null, raw, error: ''};
    if (raw.length > 260_000) throw new Error('本机研究草稿过长。');
    const draft = JSON.parse(raw) as ResearchDraft;
    if (draft.version !== 1 || draft.ownerId !== ownerId || draft.projectId !== projectId || typeof draft.baseline !== 'string' || !validateResearchDossier(draft.value, true)) throw new Error('本机研究草稿格式异常。');
    return {draft, raw, error: ''};
  } catch (cause) {return {draft: null, raw, error: cause instanceof Error ? cause.message : '本机研究草稿不可读。'};}
}
/** Compare-and-swap keeps a second tab from overwriting or clearing this draft. */
export function writeResearchDraft(ownerId: string, projectId: string, value: ResearchDraft | null, expected: string | null): {ok: boolean; raw: string | null} {
  try {
    if (value && (value.ownerId !== ownerId || value.projectId !== projectId || !validateResearchDossier(value.value, true))) return {ok: false, raw: expected};
    const storageKey = key(ownerId, projectId);
    if (localStorage.getItem(storageKey) !== expected) return {ok: false, raw: expected};
    const raw = value ? JSON.stringify(value) : null;
    if (raw && raw.length > 260_000) return {ok: false, raw: expected};
    if (raw) localStorage.setItem(storageKey, raw); else localStorage.removeItem(storageKey);
    return {ok: true, raw};
  } catch {return {ok: false, raw: expected};}
}
