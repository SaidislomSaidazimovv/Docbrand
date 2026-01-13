/**
 * Sources Store - Zustand with Persist
 * 
 * Manages imported source documents (persisted in localStorage):
 * - Track imported files
 * - File metadata (name, size, date)
 * - Delete sources
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SourceFile {
    id: string;
    filename: string;
    fileSize: number;
    importedAt: number;
    requirementCount: number;
}

interface SourcesState {
    sources: SourceFile[];

    // Actions
    addSource: (source: SourceFile) => void;
    removeSource: (sourceId: string) => void;
    clearSources: () => void;
}

export const useSourcesStore = create<SourcesState>()(
    persist(
        (set) => ({
            sources: [], // Empty by default

            addSource: (source) =>
                set((state) => ({
                    sources: [...state.sources, source],
                })),

            removeSource: (sourceId) =>
                set((state) => ({
                    sources: state.sources.filter((s) => s.id !== sourceId),
                })),

            clearSources: () => set({ sources: [] }),
        }),
        {
            name: 'docbrand-sources',
        }
    )
);
