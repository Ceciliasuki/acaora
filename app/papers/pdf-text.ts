export type PdfLine = {text: string; size: number; y: number};

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
  const line = (row: TextItem[], y: number): PdfLine => ({y, size: Math.max(...row.map(item => item.size)), text: row.map(item => item.text).join(' ').replace(/\s+/g, ' ').trim()});
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
  const numbered = line.match(/^\d+(?:\.\d+)*[.)]?\s+([A-Za-z][A-Za-z ,:&()\-–/]{2,100})$/);
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
