/** Research navigation is explicit in the URL, never a device-wide current project. */
export const projectsChangedEvent = 'acaora:projects-change';

export function researchProjectId(value: string | null): string | null {
  return value && value.length <= 200 && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ? value : null;
}

export function withResearchProject(href: string, projectId: string | null) {
  const url = new URL(href, 'https://acaora.cn');
  if (url.origin !== 'https://acaora.cn' || !['/papers', '/data', '/projects'].includes(url.pathname)) throw new Error('不支持的研究页面。');
  if (researchProjectId(projectId)) url.searchParams.set('project', projectId!);
  else url.searchParams.delete('project');
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Read the existing saved-note format without migrating or rewriting notes. */
export function projectAnalysisLinks(notes: string, records: unknown = []) {
  const links = new Map<string, {id: string; name: string; href: string}>();
  for (const match of notes.matchAll(/\[分析快照：([^\]\n]{1,100})\]\((\/data\?snapshot=[^\s)#]+#history)\)/g)) {
    try {
      const url = new URL(match[2], 'https://acaora.cn');
      const id = researchProjectId(url.searchParams.get('snapshot'));
      if (id) links.set(id, {id, name: match[1], href: `/data?${new URLSearchParams({snapshot: id})}#history`});
    } catch { /* Malformed text stays editable in the original project note. */ }
  }
  if (Array.isArray(records)) for (const record of records) {
    if (!record || typeof record !== 'object' || typeof record.name !== 'string' || !record.name.trim() || record.name.length > 100) continue;
    const id = typeof record.snapshotId === 'string' ? researchProjectId(record.snapshotId) : null;
    if (id) links.set(id, {id, name: record.name, href: `/data?${new URLSearchParams({snapshot: id})}#history`});
  }
  return [...links.values()];
}
