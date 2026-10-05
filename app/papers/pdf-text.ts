export type PdfLine = {text: string; size: number; y: number};

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
