"use client";

import {useEffect} from 'react';
import {useSearchParams} from 'next/navigation';

// Isolate URL observation under Suspense so the library can remain prerendered.
export default function PaperLocation({onChange}: {onChange: (query: string) => void}) {
  const query = useSearchParams().toString();
  useEffect(() => onChange(query), [query, onChange]);
  return null;
}
