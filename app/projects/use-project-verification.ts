'use client';
import {useEffect, useState} from 'react';
import {assessAnalysisVerification} from '../lib/research-readiness';
import type {ProjectAnalysisRecord} from '../lib/project-research';
import type {LedgerEvent} from '../lib/research-ledger';

type Assessment = Awaited<ReturnType<typeof assessAnalysisVerification>>;
export default function useProjectVerification(analyses:ProjectAnalysisRecord[], events:LedgerEvent[]) {
  const signature = JSON.stringify([analyses, events.filter(event=>event.collection==='verification')]);
  const [result, setResult] = useState<{signature:string; rows:Assessment} | null>(null);
  useEffect(() => {
    let active = true;
    const [records, history] = JSON.parse(signature) as [ProjectAnalysisRecord[], LedgerEvent[]];
    void assessAnalysisVerification(records, history).then(rows => {if(active) setResult({signature, rows});});
    return () => {active = false;};
  }, [signature]);
  return result?.signature === signature ? result.rows : null;
}
