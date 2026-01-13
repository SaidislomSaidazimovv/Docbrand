/**
 * History Store - Zustand with Persist
 * 
 * Archives cleared imports for history tracking
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Requirement } from '@/types';
import type { SourceFile } from './sourcesStore';

export interface HistoryEntry {
    id: string;
    clearedAt: number;
    sources: SourceFile[];
    requirements: Requirement[];
    linkedCount: number;
    totalCount: number;
}

interface HistoryState {
    history: HistoryEntry[];

    // Actions
    addToHistory: (entry: Omit<HistoryEntry, 'id' | 'clearedAt'>) => void;
    clearHistory: () => void;
    removeHistoryEntry: (id: string) => void;
}

export const useHistoryStore = create<HistoryState>()(
    persist(
        (set) => ({
            history: [],

            addToHistory: (entry) =>
                set((state) => ({
                    history: [
                        {
                            ...entry,
                            id: `history-${Date.now()}`,
                            clearedAt: Date.now(),
                        },
                        ...state.history,
                    ].slice(0, 10), // Keep only last 10 entries
                })),

            clearHistory: () => set({ history: [] }),

            removeHistoryEntry: (id) =>
                set((state) => ({
                    history: state.history.filter((h) => h.id !== id),
                })),
        }),
        {
            name: 'docbrand-history',
        }
    )
);
