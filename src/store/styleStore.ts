/**
 * Style Store - Zustand
 *
 * Manages document typography and spacing styles that apply to the editor.
 * Includes brand color fields for company brand sovereignty.
 * Persisted to localStorage so styles survive page refresh.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Defaults (DocBrand baseline)
// ---------------------------------------------------------------------------

const DEFAULTS = {
    fontFamily: 'Times New Roman',
    fontSize: 16,
    lineHeight: 1,
    spaceBefore: 0,
    spaceAfter: 0,
    firstLineIndent: 0,
    h1Color: '#1A1A1A',
    h2Color: '#13818A',
    bodyColor: '#1A1A1A',
    h1FontSize: null as number | null,
    h2FontSize: null as number | null,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StyleState {
    // Typography
    fontFamily: string;
    fontSize: number;
    lineHeight: number;

    // Heading font sizes (null = use multiplier fallback)
    h1FontSize: number | null;
    h2FontSize: number | null;

    // Spacing
    spaceBefore: number;
    spaceAfter: number;
    firstLineIndent: number;

    // Brand colors
    h1Color: string;
    h2Color: string;
    bodyColor: string;

    // Actions
    setFontFamily: (font: string) => void;
    setFontSize: (size: number) => void;
    setLineHeight: (height: number) => void;
    setH1FontSize: (size: number | null) => void;
    setH2FontSize: (size: number | null) => void;
    setSpaceBefore: (value: number) => void;
    setSpaceAfter: (value: number) => void;
    setFirstLineIndent: (value: number) => void;
    setH1Color: (color: string) => void;
    setH2Color: (color: string) => void;
    setBodyColor: (color: string) => void;
    applyPreset: (preset: 'h1' | 'h2' | 'body' | 'caption') => void;
    applyBrandPartial: (partial: Partial<Omit<StyleState, 'setFontFamily' | 'setFontSize' | 'setLineHeight' | 'setH1FontSize' | 'setH2FontSize' | 'setSpaceBefore' | 'setSpaceAfter' | 'setFirstLineIndent' | 'setH1Color' | 'setH2Color' | 'setBodyColor' | 'applyPreset' | 'applyBrandPartial' | 'resetToDefaults'>>) => void;
    resetToDefaults: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStyleStore = create<StyleState>()(
    persist(
        (set) => ({
            ...DEFAULTS,

            setFontFamily: (font) => set({ fontFamily: font }),
            setFontSize: (size) => set({ fontSize: size }),
            setLineHeight: (height) => set({ lineHeight: height }),
            setH1FontSize: (size) => set({ h1FontSize: size }),
            setH2FontSize: (size) => set({ h2FontSize: size }),
            setSpaceBefore: (value) => set({ spaceBefore: value }),
            setSpaceAfter: (value) => set({ spaceAfter: value }),
            setFirstLineIndent: (value) => set({ firstLineIndent: value }),
            setH1Color: (color) => set({ h1Color: color }),
            setH2Color: (color) => set({ h2Color: color }),
            setBodyColor: (color) => set({ bodyColor: color }),

            applyPreset: (preset) => {
                switch (preset) {
                    case 'h1':
                        set({ fontFamily: 'Times New Roman', fontSize: 42.67, lineHeight: 1.15 });
                        break;
                    case 'h2':
                        set({ fontFamily: 'Times New Roman', fontSize: 21.33, lineHeight: 1.15 });
                        break;
                    case 'body':
                        set({ fontFamily: 'Times New Roman', fontSize: 16, lineHeight: 1 });
                        break;
                    case 'caption':
                        set({ fontFamily: 'Times New Roman', fontSize: 13.33, lineHeight: 1 });
                        break;
                }
            },

            /** Apply multiple brand fields atomically (only non-undefined fields) */
            applyBrandPartial: (partial) => set((state) => ({ ...state, ...partial })),

            /** Reset all fields to DocBrand defaults */
            resetToDefaults: () => set({ ...DEFAULTS }),
        }),
        {
            name: 'docbrand-style-store',
            partialize: (state) => ({
                fontFamily: state.fontFamily,
                fontSize: state.fontSize,
                lineHeight: state.lineHeight,
                h1FontSize: state.h1FontSize,
                h2FontSize: state.h2FontSize,
                spaceBefore: state.spaceBefore,
                spaceAfter: state.spaceAfter,
                firstLineIndent: state.firstLineIndent,
                h1Color: state.h1Color,
                h2Color: state.h2Color,
                bodyColor: state.bodyColor,
            }),
        }
    )
);
