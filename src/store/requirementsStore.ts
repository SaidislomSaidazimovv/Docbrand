/**
 * Requirements Store - Zustand with Persist
 * 
 * Manages RFP requirements state:
 * - Requirements list (persisted in localStorage)
 * - Import/delete requirements
 * - Link requirements to blocks
 * - Kanban status tracking
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Requirement } from '@/types';

type KanbanStatus = Requirement['kanbanStatus'];

interface RequirementsState {
    requirements: Requirement[];
    activeLinkingReqId: string | null;

    // Actions
    importRequirements: (reqs: Requirement[]) => void;
    clearRequirements: () => void;
    setStatus: (reqId: string, status: Requirement['status']) => void;
    setKanbanStatus: (reqId: string, status: KanbanStatus) => void;
    linkToBlock: (reqId: string, blockId: string) => void;
    unlinkFromBlock: (reqId: string, blockId: string) => void;
    setLinkingMode: (reqId: string | null) => void;
}

// Start with empty requirements - user needs to import RFP
// Data is persisted in localStorage
export const useRequirementsStore = create<RequirementsState>()(
    persist(
        (set) => ({
            requirements: [],
            activeLinkingReqId: null,

            importRequirements: (reqs) =>
                set((state) => ({
                    requirements: [...state.requirements, ...reqs],
                })),

            clearRequirements: () => set({ requirements: [] }),

            setStatus: (reqId, status) =>
                set((state) => ({
                    requirements: state.requirements.map((r) =>
                        r.id === reqId ? { ...r, status } : r
                    ),
                })),

            setKanbanStatus: (reqId, kanbanStatus) =>
                set((state) => ({
                    requirements: state.requirements.map((r) =>
                        r.id === reqId ? { ...r, kanbanStatus } : r
                    ),
                })),

            linkToBlock: (reqId, blockId) =>
                set((state) => ({
                    requirements: state.requirements.map((r) =>
                        r.id === reqId
                            ? {
                                ...r,
                                linkedBlockIds: [...r.linkedBlockIds, blockId],
                                status: 'linked' as const,
                            }
                            : r
                    ),
                    activeLinkingReqId: null,
                })),

            unlinkFromBlock: (reqId, blockId) =>
                set((state) => ({
                    requirements: state.requirements.map((r) =>
                        r.id === reqId
                            ? {
                                ...r,
                                linkedBlockIds: r.linkedBlockIds.filter((id) => id !== blockId),
                                status: r.linkedBlockIds.length <= 1 ? ('unlinked' as const) : r.status,
                            }
                            : r
                    ),
                })),

            setLinkingMode: (reqId) => set({ activeLinkingReqId: reqId }),
        }),
        {
            name: 'docbrand-requirements',
            // Don't persist activeLinkingReqId (UI state)
            partialize: (state) => ({ requirements: state.requirements }),
        }
    )
);
