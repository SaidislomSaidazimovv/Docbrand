/**
 * Header/Footer Store - Zustand
 * 
 * Manages document header and footer content:
 * - Company name
 * - Document title
 * - Logo URL
 * - Footer text
 * - Page numbers toggle
 */

import { create } from 'zustand';

interface HeaderFooterState {
    header: {
        companyName: string;
        documentTitle: string;
        logoUrl: string;
        showLogo: boolean;
    };
    footer: {
        text: string;
        showPageNumbers: boolean;
        showDate: boolean;
    };

    // Actions
    updateHeader: (data: Partial<HeaderFooterState['header']>) => void;
    updateFooter: (data: Partial<HeaderFooterState['footer']>) => void;
    reset: () => void;
}

const defaultState = {
    header: {
        companyName: '',
        documentTitle: '',
        logoUrl: '',
        showLogo: false,
    },
    footer: {
        text: 'Confidential',
        showPageNumbers: true,
        showDate: true,
    },
};

export const useHeaderFooterStore = create<HeaderFooterState>((set) => ({
    ...defaultState,

    updateHeader: (data) =>
        set((state) => ({
            header: { ...state.header, ...data },
        })),

    updateFooter: (data) =>
        set((state) => ({
            footer: { ...state.footer, ...data },
        })),

    reset: () => set(defaultState),
}));
