'use client';

import {useEffect, useRef, type RefObject} from 'react';

/** A local, temporary cue; never changes text geometry or reading position. */
export function readingCue(node: HTMLElement | null) {
  if (!node) return () => {};
  node.dataset.readingCue = 'true';
  const clear = () => {delete node.dataset.readingCue;};
  const timer = window.setTimeout(clear, 1100);
  return () => {window.clearTimeout(timer); clear();};
}

export function useAnnotationCue(root: RefObject<HTMLElement | null>, ids: string) {
  const previous = useRef<Set<string> | null>(null);
  useEffect(() => {
    const next = new Set<string>(JSON.parse(ids));
    const added = previous.current && new Set([...next].filter(id => !previous.current!.has(id)));
    previous.current = next;
    const cleanups: (() => void)[] = [];
    if (added?.size) root.current?.querySelectorAll<HTMLElement>('[data-annotation-id]').forEach(node => {
      if (added.has(node.dataset.annotationId!)) cleanups.push(readingCue(node));
    });
    return () => cleanups.forEach(clear => clear());
  }, [ids, root]);
}
