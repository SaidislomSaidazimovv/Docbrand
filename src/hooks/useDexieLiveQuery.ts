// src/hooks/useDexieLiveQuery.ts
// Exactly as specified in docs/Skills/dexie/Dexie_LiveQuery_Sidebar.md
'use client';

import { useState, useEffect } from 'react';
import { liveQuery } from 'dexie';

export function useDexieLiveQuery<T>(
    querier: () => Promise<T> | T,
    deps: any[] = [],
    defaultValue: T
): T {
    const [result, setResult] = useState<T>(defaultValue);

    useEffect(() => {
        const observable = liveQuery(querier);
        const subscription = observable.subscribe({
            next: (value) => setResult(value),
            error: (err) => console.error('[Dexie] Error:', err),
        });
        return () => subscription.unsubscribe();
    }, deps);

    return result;
}
