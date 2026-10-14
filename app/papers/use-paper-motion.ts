"use client";

import {useCallback, useEffect, useLayoutEffect, useRef} from 'react';

const surfaces = '.plab-index, .plab-reader, .plab-rail, .paper-mode-content';
type Snapshot = Map<HTMLElement, number>;

/** Open the page margin without scaling type or disturbing vertical reading position. */
export default function usePaperMotion(state: string) {
  const shellRef = useRef<HTMLElement>(null);
  const pending = useRef<Snapshot | null>(null);
  const running = useRef(new Map<HTMLElement, Animation>());
  const cancel = useCallback(() => {
    running.current.forEach((animation, node) => {animation.cancel(); node.dataset.paperMotion = 'idle';});
    running.current.clear();
  }, []);
  const capture = useCallback(() => {
    const shell = shellRef.current;
    if (!shell) return;
    // Read the current visual position before cancelling an interrupted transition.
    pending.current = new Map(Array.from(shell.querySelectorAll<HTMLElement>(surfaces))
      .filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none')
      .map(node => [node, node.getBoundingClientRect().left]));
    cancel();
  }, [cancel]);

  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {if (preference.matches) {pending.current = null; cancel();}};
    preference.addEventListener('change', stop);
    // A breakpoint change commits its layout immediately, not through a stale FLIP.
    const resize = () => {pending.current = null; cancel();};
    window.addEventListener('resize', resize);
    return () => {preference.removeEventListener('change', stop); window.removeEventListener('resize', resize); cancel();};
  }, [cancel]);

  useLayoutEffect(() => {
    const before = pending.current;
    pending.current = null;
    if (!before || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const shell = shellRef.current;
    if (!shell) return;
    shell.querySelectorAll<HTMLElement>(surfaces).forEach(node => {
      if (!node.getClientRects().length || getComputedStyle(node).display === 'none' || !node.animate) return;
      const previous = before.get(node);
      const entering = previous === undefined;
      const delta = entering ? (node.classList.contains('plab-index') ? -12 : 12) : previous - node.getBoundingClientRect().left;
      if (!entering && Math.abs(delta) < 1) return;
      const animation = node.animate([
        {transform: `translateX(${delta}px)`, opacity: entering ? .65 : 1},
        {transform: 'translateX(0)', opacity: 1},
      ], {duration: entering ? 260 : 220, easing: 'cubic-bezier(.16,1,.3,1)'});
      running.current.set(node, animation);
      node.dataset.paperMotion = entering ? 'enter' : 'layout';
      const settled = () => {
        if (running.current.get(node) !== animation) return;
        running.current.delete(node);
        node.dataset.paperMotion = 'idle';
      };
      animation.onfinish = settled;
      animation.oncancel = settled;
    });
  }, [state]);

  return {shellRef, capture};
}
