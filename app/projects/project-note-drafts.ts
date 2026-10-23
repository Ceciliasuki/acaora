export type ProjectNoteDraft = {
  version: 1;
  ownerId: string;
  projectId: string;
  text: string;
  baseNotes: string;
  baseUpdatedAt: string;
  updatedAt: number;
};

// Keep the latest input across client-side navigation even when device storage
// is unavailable. Only a successful localStorage write survives a page reload.
const pending = new Map<string, ProjectNoteDraft | null>();
const keyFor = (ownerId: string, projectId: string) => `acaora:project-note-draft:v1:${JSON.stringify([ownerId, projectId])}`;

export function readProjectNoteDraft(ownerId: string, projectId: string): ProjectNoteDraft | null {
  const key = keyFor(ownerId, projectId);
  if (pending.has(key)) return pending.get(key) ?? null;
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<ProjectNoteDraft> | null;
    return value?.version === 1 && value.ownerId === ownerId && value.projectId === projectId
      && typeof value.text === 'string' && typeof value.baseNotes === 'string'
      && typeof value.baseUpdatedAt === 'string' && typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
      ? value as ProjectNoteDraft : null;
  } catch { return null; }
}

export function storeProjectNoteDraft(draft: ProjectNoteDraft): boolean {
  const key = keyFor(draft.ownerId, draft.projectId);
  pending.set(key, draft);
  try {
    localStorage.setItem(key, JSON.stringify(draft));
    pending.delete(key);
    return true;
  } catch { return false; }
}

export function clearProjectNoteDraft(ownerId: string, projectId: string, expected?: ProjectNoteDraft): boolean {
  const key = keyFor(ownerId, projectId);
  const current = readProjectNoteDraft(ownerId, projectId);
  // A late save must not remove a newer draft written in this or another tab.
  if (expected && current && (current.text !== expected.text || current.updatedAt !== expected.updatedAt)) return false;
  pending.set(key, null);
  try { localStorage.removeItem(key); pending.delete(key); return true; }
  catch { return false; }
}

export function isProjectNoteDraftDurable(draft: ProjectNoteDraft): boolean {
  try { return localStorage.getItem(keyFor(draft.ownerId, draft.projectId)) === JSON.stringify(draft); }
  catch { return false; }
}
