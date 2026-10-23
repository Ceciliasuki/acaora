export type PdfLine = {text: string; size: number; y: number; x?: number; width?: number};
export type PdfPageText = {lines: PdfLine[]; height: number};

type TextItem = {text: string; x: number; y: number; width: number; size: number};

// Repeated prose runs on both sides of a central gutter identify ordinary
// two-column pages, independently of exact baselines. Numeric tables stay in
// the single-column path. Full-width lines divide columns into reading bands.
export function readingOrderLines(items: TextItem[], pageWidth: number): PdfLine[] {
  const ordered: {y: number; row: TextItem[]}[] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const previous = ordered[ordered.length - 1];
    if (previous && previous.y - item.y <= Math.min(3, item.size * .25)) previous.row.push(item);
    else ordered.push({y: item.y, row: [item]});
  }
  ordered.forEach(({row}) => row.sort((a, b) => a.x - b.x));
  const prose = (text: string) => {const letters = text.match(/\p{L}/gu)?.length ?? 0; return letters >= 24 && letters > text.length * .4;};
  const runs: TextItem[] = [];
  const rowRuns = new Map<number, TextItem[]>();
  for (const {row, y} of ordered) {
    const merged: TextItem[] = [];
    let run = {...row[0]};
    for (const item of row.slice(1)) {
      if (item.x - (run.x + run.width) > Math.max(18, item.size * 2)) {merged.push(run); run = {...item};}
      else {run.text += ` ${item.text}`; run.width = Math.max(run.width, item.x + item.width - run.x);}
    }
    merged.push(run); runs.push(...merged); rowRuns.set(y, merged);
  }
  const line = (row: TextItem[], y: number): PdfLine => {
    const x = Math.min(...row.map(item => item.x));
    return {y, x, width: Math.max(...row.map(item => item.x + item.width)) - x, size: Math.max(...row.map(item => item.size)), text: row.map(item => item.text).join(' ').replace(/\s+/g, ' ').trim()};
  };
  // Prefer the central split, then consider nearby gutters for unequal margins.
  const candidates = [.5, .45, .55, .4, .6, .35, .65].map(ratio => {
    const gutter = ratio * pageWidth;
    const left = runs.filter(run => prose(run.text) && run.x + run.width <= gutter - pageWidth * .01);
    const right = runs.filter(run => prose(run.text) && run.x >= gutter + pageWidth * .01);
    // Compare occupied line bands, not their bounding ranges: left/right/left
    // sequential indents must not become simultaneous columns.
    const near = (a: TextItem, b: TextItem) => Math.abs(a.y - b.y) <= Math.max(a.size, b.size) * 1.5;
    const pairedLeft = left.filter(a => right.some(b => near(a, b))).length;
    const pairedRight = right.filter(b => left.some(a => near(a, b))).length;
    return {gutter, score: pairedLeft >= 3 && pairedRight >= 3 ? Math.min(pairedLeft, pairedRight) : 0};
  }).sort((a, b) => b.score - a.score);
  if (!candidates[0].score) return ordered.map(({row, y}) => line(row, y));
  const gutter = candidates[0].gutter;
  const result: PdfLine[] = [];
  let left: PdfLine[] = [], right: PdfLine[] = [];
  const flush = () => {result.push(...left, ...right); left = []; right = [];};
  for (const {row, y} of ordered) {
    const l = row.filter(item => item.x < gutter), r = row.filter(item => item.x >= gutter);
    const numeric = (group: TextItem[]) => group.length > 0 && group.every(item => /\d/.test(item.text) && !/\p{L}/u.test(item.text));
    if (rowRuns.get(y)!.some(item => item.x < gutter && item.x + item.width > gutter) || (numeric(l) && numeric(r))) {flush(); result.push(line(row, y)); continue;}
    if (l.length) left.push(line(l, y));
    if (r.length) right.push(line(r, y));
  }
  flush();
  return result;
}

export function detectSection(line: string, headingSize = false) {
  const numbered = line.match(/^(?:\d+(?:\.\d+)*[.)]?|[IVXLCDM]{1,6}[.)])\s+([A-Za-z][A-Za-z0-9 ,:&()\-–/]{2,100})$/);
  const normalized = (numbered?.[1] ?? line).trim();
  const sections: [RegExp, string][] = [
    [/^abstract$/i, 'Abstract'], [/^(introduction|background)$/i, 'Introduction'],
    [/^(methods?|materials and methods?|methodology|study design)$/i, 'Methods'],
    [/^results?$/i, 'Results'], [/^(discussion|discussion and conclusions?)$/i, 'Discussion'],
    [/^conclusions?$/i, 'Conclusion'], [/^references$/i, 'References'],
    [/^acknowledg(e)?ments$/i, 'Acknowledgements'], [/^supplementary materials?$/i, 'Supplementary Materials'],
  ];
  const known = sections.find(([pattern]) => pattern.test(normalized))?.[1];
  if (known) return known;
  // Do not confuse numeric table cells or full numbered sentences with headings.
  if (headingSize && numbered && normalized.split(/\s+/).length <= 12 && !/[.!?;]$/.test(normalized)) return normalized;
  return '';
}

export function bodyFontSize(lines: PdfLine[]) {
  const weights = new Map<number, number>();
  for (const line of lines) {
    const size = Math.round(line.size * 2) / 2;
    weights.set(size, (weights.get(size) ?? 0) + line.text.length);
  }
  return [...weights].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

export function inferPdfTitle(lines: PdfLine[], fallback: string) {
  const candidates = lines.filter(line => line.text.length >= 12 && line.text.length <= 220 && !detectSection(line.text) && !/doi\s*[:/]|university|department|journal|copyright|^©/i.test(line.text));
  if (!candidates.length) return fallback;
  const largest = Math.max(...candidates.slice(0, 16).map(line => line.size));
  const start = lines.findIndex(line => candidates.includes(line) && line.size === largest);
  const title: string[] = [];
  for (let index = start; index < lines.length && title.length < 6; index++) {
    const line = lines[index];
    if (Math.abs(line.size - largest) > .8 || detectSection(line.text) || (index > start && lines[index - 1].y - line.y > largest * 2.2)) break;
    title.push(line.text);
  }
  return title.join(' ').trim() || fallback;
}

// A repeated, short line must occur at the same outer page margin on most
// pages. Body repetitions, table rows and equations remain in the text.
export function stripRepeatedMargins(pages: PdfPageText[]): PdfPageText[] {
  if (pages.length < 2) return pages;
  const keys = new Map<PdfLine, string>();
  const occurrences = new Map<string, Set<number>>();
  pages.forEach((page, index) => {
    const body = bodyFontSize(page.lines.filter(line => line.y > page.height * .12 && line.y < page.height * .88));
    for (const line of page.lines) {
      if (!(page.height > 0) || line.text.length > 180 || !body || line.size > body + .5) continue;
      const margin = line.y <= page.height * .08 ? 'bottom' : line.y >= page.height * .92 ? 'top' : '';
      if (!margin) continue;
      const text = line.text.trim().replace(/\s+/g, ' ').toLowerCase();
      const pageNumber = /^(?:page\s+)?\d{1,4}(?:\s*(?:\/|of)\s*\d{1,4})?$/.test(text);
      const letters = text.match(/\p{L}/gu)?.length ?? 0;
      if (!pageNumber && (letters < 8 || letters < text.length * .55 || /[=<>∑∫]/u.test(text))) continue;
      const key = `${margin}:${pageNumber ? '[page-number]' : text}`;
      keys.set(line, key);
      const seen = occurrences.get(key) ?? new Set<number>();
      seen.add(index); occurrences.set(key, seen);
    }
  });
  const threshold = Math.max(2, Math.ceil(pages.length * .6));
  return pages.map(page => ({...page, lines: page.lines.filter(line => (occurrences.get(keys.get(line) ?? '')?.size ?? 0) < threshold)}));
}

// Hard hyphens are ambiguous. Join only with a continuous line layout AND an
// unhyphenated spelling already present elsewhere in this document. Known
// compound prefixes and an explicitly hyphenated spelling veto that repair.
export type PdfJoinEvidence = {
  words: ReadonlySet<string>;
  compounds: ReadonlySet<string>;
};

// Share this document-level index across paragraph flushes. A string remains
// accepted for isolated callers, but is indexed lazily only for repair candidates.
export function buildPdfJoinEvidence(text: string): PdfJoinEvidence {
  const normalized = text.toLowerCase();
  return {
    words: new Set(normalized.match(/\p{L}{3,}/gu) ?? []),
    compounds: new Set(normalized.match(/\p{L}+(?:-\p{L}+)+/gu) ?? []),
  };
}

export function joinPdfLines(lines: PdfLine[], evidence: PdfJoinEvidence | string = ''): string {
  let indexEvidence: PdfJoinEvidence | undefined = typeof evidence === 'string' ? undefined : evidence;
  const compoundPrefix = /^(?:well|self|cross|multi|non|anti|re|pre|post|low|high|long|short|case|data|state|time|small|large|full|single|double|all|half|two|three)$/i;
  let text = '';
  for (let index = 0; index < lines.length; index++) {
    const current = lines[index], previous = lines[index - 1];
    if (!previous) {text = current.text; continue;}
    const soft = /\p{L}\u00ad$/u.test(previous.text) && /^\p{Ll}/u.test(current.text);
    const left = previous.text.match(/(?:^|[^\p{L}-])(\p{L}{4,})-$/u)?.[1];
    const right = current.text.match(/^(\p{Ll}{3,})(?=[^\p{L}-]|$)/u)?.[1];
    let hard = false;
    if (left && right && !compoundPrefix.test(left)
      && previous.x !== undefined && previous.width !== undefined && current.x !== undefined
      && Math.abs(previous.x - current.x) <= previous.size * 1.5 && Math.abs(previous.size - current.size) <= .8
      && previous.y - current.y >= previous.size * .5 && previous.y - current.y <= previous.size * 2.4) {
      indexEvidence ??= buildPdfJoinEvidence(evidence as string);
      if (indexEvidence.words.has(`${left}${right}`.toLowerCase()) && !indexEvidence.compounds.has(`${left}-${right}`.toLowerCase())) {
        const rightEdge = Math.max(...lines.filter(line => line.x !== undefined && line.width !== undefined && Math.abs(line.x - previous.x!) <= previous.size * 1.5).map(line => line.x! + line.width!));
        hard = previous.x + previous.width >= rightEdge - previous.size;
      }
    }
    text = soft || hard ? `${text.slice(0, -1)}${current.text}` : `${text} ${current.text}`;
  }
  return text.replace(/\s+/g, ' ').trim();
}

// Leave uncertain/short/mixed-language text unlabelled instead of marking all
// imported source material as English. 'zh' does not guess a writing script.
export function inferTextLanguage(text: string): 'en' | 'zh' | undefined {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  if (han >= 8 && han / letters >= .6) return 'zh';
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const markers = new Set(words.filter(word => /^(?:the|and|of|to|in|is|are|was|were|with|for|that|this|these|we|our|from|using|between|study|results)$/i.test(word)));
  if (latin >= 40 && latin / letters >= .95 && words.length >= 12 && markers.size >= 3) return 'en';
  return undefined;
}
