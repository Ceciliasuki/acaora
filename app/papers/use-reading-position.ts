'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import type {PaperRecord} from './paper-types';

type Position = {key: string; index: number; updatedAt: number};
const cloudIntervalMs = 15_000;

function positionKey(paper: PaperRecord) {
  return `acaora:reading-position:${JSON.stringify([paper.ownerId ?? null, paper.id, paper.addedAt])}`;
}

function clampIndex(index: number, paragraphCount: number) {
  return Math.max(0, Math.min(index, paragraphCount - 1));
}

function readPosition(key: string, index: number, updatedAt: number, paragraphCount: number): Position {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (saved && Number.isInteger(saved.index) && Number.isFinite(saved.updatedAt) && saved.updatedAt >= updatedAt) {
      return {key, index: clampIndex(saved.index, paragraphCount), updatedAt: saved.updatedAt};
    }
  } catch { /* A blocked/corrupt preference does not prevent reading. */ }
  return {key, index: clampIndex(index, paragraphCount), updatedAt};
}

export function restoreReadingPosition(paper: PaperRecord): PaperRecord {
  const restored = readPosition(positionKey(paper), paper.activeParagraph, paper.updatedAt, paper.paragraphs.length);
  return restored.index === paper.activeParagraph ? paper : {...paper, activeParagraph: restored.index};
}

// The device cursor is tiny and immediate. Content and the durable cloud queue
// stay in PaperRecord; committing a cursor uses that same queue at most once
// per interval, without creating another persistence or conflict mechanism.
export function useReadingPosition(paper: PaperRecord, onCommit: (paperId: string, ownerId: string | undefined, index: number) => void) {
  const key = positionKey(paper);
  const {id: paperId, ownerId, activeParagraph, updatedAt} = paper;
  const paragraphCount = paper.paragraphs.length;
  const [position, setPosition] = useState<Position | null>(null);
  const currentRef = useRef<Position | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const restored = readPosition(key, activeParagraph, updatedAt, paragraphCount);
    void Promise.resolve().then(() => {
      if (!active) return;
      currentRef.current = restored;
      setPosition(restored);
    });
    return () => {active = false;};
  }, [key, activeParagraph, updatedAt, paragraphCount]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, [key]);

  const select = useCallback((index: number) => {
    const next = {key, index: clampIndex(index, paragraphCount), updatedAt: Date.now()};
    currentRef.current = next;
    setPosition(next);
    try {localStorage.setItem(key, JSON.stringify({index: next.index, updatedAt: next.updatedAt}));} catch { /* Session reading still works. */ }
    if (timerRef.current === null) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const latest = currentRef.current;
        if (latest?.key === key) onCommit(paperId, ownerId, latest.index);
      }, cloudIntervalMs);
    }
  }, [key, paragraphCount, paperId, ownerId, onCommit]);

  const snapshot = useCallback((record: PaperRecord) => {
    const current = currentRef.current;
    return current?.key === positionKey(record) ? {...record, activeParagraph: clampIndex(current.index, record.paragraphs.length)} : record;
  }, []);

  return {activeIndex: position?.key === key ? clampIndex(position.index, paragraphCount) : clampIndex(activeParagraph, paragraphCount), select, snapshot};
}
