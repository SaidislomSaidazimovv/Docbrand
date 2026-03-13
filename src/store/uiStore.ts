/**
 * UI Store - Zustand
 * 
 * Manages UI state like sidebar visibility
 */

import { create } from 'zustand';

export interface PasteModalData {
    beforeHtml: string;
    afterHtml: string;
    changes: { icon: string; text: string }[];
    pendingContent: string;
}

interface UIState {
    leftSidebarOpen: boolean;
    rightSidebarOpen: boolean;
    toggleLeftSidebar: () => void;
    toggleRightSidebar: () => void;
    setLeftSidebar: (open: boolean) => void;
    setRightSidebar: (open: boolean) => void;

    // Auto-heading toast
    autoHeadingToast: { count: number } | null;
    showAutoHeadingToast: (count: number) => void;
    hideAutoHeadingToast: () => void;

    // Paste toast
    pasteToast: { message: string; changesCount?: number } | null;
    showPasteToast: (message: string, changesCount?: number) => void;
    hidePasteToast: () => void;

    // Paste firewall modal
    pasteModal: PasteModalData | null;
    showPasteModal: (data: PasteModalData) => void;
    hidePasteModal: () => void;

    // Scan trigger (increment to trigger scan from outside RightSidebar)
    scanTrigger: number;
    triggerScan: () => void;

    // Feedback modal
    feedbackOpen: boolean;
    openFeedback: () => void;
    closeFeedback: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    leftSidebarOpen: true,
    rightSidebarOpen: true,

    toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
    toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    setLeftSidebar: (open) => set({ leftSidebarOpen: open }),
    setRightSidebar: (open) => set({ rightSidebarOpen: open }),

    autoHeadingToast: null,
    showAutoHeadingToast: (count) => set({ autoHeadingToast: { count } }),
    hideAutoHeadingToast: () => set({ autoHeadingToast: null }),

    pasteToast: null,
    showPasteToast: (message, changesCount) => set({ pasteToast: { message, changesCount } }),
    hidePasteToast: () => set({ pasteToast: null }),

    pasteModal: null,
    showPasteModal: (data) => set({ pasteModal: data }),
    hidePasteModal: () => set({ pasteModal: null }),

    scanTrigger: 0,
    triggerScan: () => set((state) => ({ scanTrigger: state.scanTrigger + 1 })),

    feedbackOpen: false,
    openFeedback: () => set({ feedbackOpen: true }),
    closeFeedback: () => set({ feedbackOpen: false }),
}));
