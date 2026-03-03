/**
 * UI Store - Zustand
 * 
 * Manages UI state like sidebar visibility
 */

import { create } from 'zustand';

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

    feedbackOpen: false,
    openFeedback: () => set({ feedbackOpen: true }),
    closeFeedback: () => set({ feedbackOpen: false }),
}));
