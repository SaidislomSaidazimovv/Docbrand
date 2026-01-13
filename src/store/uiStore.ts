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
}

export const useUIStore = create<UIState>((set) => ({
    leftSidebarOpen: true,
    rightSidebarOpen: true,

    toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
    toggleRightSidebar: () => set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen })),
    setLeftSidebar: (open) => set({ leftSidebarOpen: open }),
    setRightSidebar: (open) => set({ rightSidebarOpen: open }),
}));
