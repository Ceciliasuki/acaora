"use client";

import {useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent} from 'react';

// A discrete disclosure, shared by the app rail and course directories.
export default function useHoverNavigation() {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInside = useRef(false);
  const keyboardInside = useRef(false);
  const restoringFocus = useRef(false);

  function cancelLeave() {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  }
  function close() {
    cancelLeave();
    keyboardInside.current = false;
    setExpanded(false);
  }
  useEffect(() => {
    function outside(event: globalThis.PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        keyboardInside.current = false;
        setExpanded(false);
      }
    }
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  return {
    expanded, rootRef, toggleRef,
    toggle() { cancelLeave(); keyboardInside.current = false; setExpanded(value => !value); },
    handlers: {
      onPointerEnter(event: PointerEvent<HTMLDivElement>) {
        if (event.pointerType !== 'mouse' || !window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)').matches) return;
        cancelLeave(); pointerInside.current = true; setExpanded(true);
      },
      onPointerLeave() {
        pointerInside.current = false;
        cancelLeave();
        leaveTimer.current = setTimeout(() => {
          if (!keyboardInside.current) setExpanded(false);
        }, 180);
      },
      onFocusCapture(event: FocusEvent<HTMLDivElement>) {
        if (restoringFocus.current) { restoringFocus.current = false; return; }
        if (event.target.matches(':focus-visible')) {
          cancelLeave(); keyboardInside.current = true; setExpanded(true);
        }
      },
      onBlurCapture(event: FocusEvent<HTMLDivElement>) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          keyboardInside.current = false;
          if (!pointerInside.current) close();
        }
      },
      onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key !== 'Escape' || !expanded) return;
        event.preventDefault(); event.stopPropagation();
        close();
        if (document.activeElement !== toggleRef.current) {
          restoringFocus.current = true;
          toggleRef.current?.focus();
        }
      },
    },
  };
}
