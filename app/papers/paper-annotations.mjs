/** @param {import('./paper-types').Paragraph} paragraph */
export function validAnnotations(paragraph) {
  return (Array.isArray(paragraph.annotations) ? paragraph.annotations : []).filter(a => a && typeof a.id === 'string' &&
    Number.isInteger(a.start) && Number.isInteger(a.end) && a.start >= 0 && a.end > a.start && a.end <= paragraph.original.length &&
    a.quote === paragraph.original.slice(a.start, a.end) && typeof a.comment === 'string' && ['yellow', 'blue', 'green'].includes(a.color));
}

/** Splitting at every boundary preserves overlapping highlights and exact original text.
 * @param {import('./paper-types').Paragraph} paragraph */
export function annotationSegments(paragraph) {
  const annotations = validAnnotations(paragraph);
  const boundaries = [...new Set([0, paragraph.original.length, ...annotations.flatMap(a => [a.start, a.end])])].sort((a,b)=>a-b);
  return boundaries.slice(0,-1).map((start,index) => {
    const end = boundaries[index+1];
    const covering = annotations.filter(a => a.start <= start && a.end >= end);
    return {start, text: paragraph.original.slice(start,end), annotation: covering.at(-1)};
  });
}

/** @param {HTMLElement} root @param {Selection | null} selection
 * @returns {import('./paper-types').TextAnchor[]} */
export function selectionAnchors(root, selection) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return [];
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return [];
  return Array.from(root.querySelectorAll('[data-original-text]')).flatMap(element => {
    if (!range.intersectsNode(element)) return [];
    const text = element.textContent ?? '';
    const prefix = document.createRange(); prefix.selectNodeContents(element);
    let start=0, end=text.length;
    if (element.contains(range.startContainer)) {prefix.setEnd(range.startContainer,range.startOffset);start=prefix.toString().length;}
    if (element.contains(range.endContainer)) {prefix.selectNodeContents(element);prefix.setEnd(range.endContainer,range.endOffset);end=prefix.toString().length;}
    const paragraphId=element.closest('[data-paragraph-id]')?.getAttribute('data-paragraph-id');
    return paragraphId && end>start && text.slice(start,end).trim() ? [{paragraphId,start,end,quote:text.slice(start,end)}] : [];
  });
}
