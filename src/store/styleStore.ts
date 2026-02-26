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
    h1Color: null as string | null,
    h2Color: null as string | null,
    bodyColor: '#1A1A1A',
    h1FontSize: null as number | null,
    h2FontSize: null as number | null,
    h1SpaceBefore: null as number | null,
    h1SpaceAfter: null as number | null,
    h2SpaceBefore: null as number | null,
    h2SpaceAfter: null as number | null,
    h3Color: null as string | null,
    h3FontSize: null as number | null,
    h3SpaceBefore: null as number | null,
    h3SpaceAfter: null as number | null,
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

    // Heading-specific spacing (null = fall back to spaceBefore/spaceAfter)
    h1SpaceBefore: number | null;
    h1SpaceAfter: number | null;
    h2SpaceBefore: number | null;
    h2SpaceAfter: number | null;
    h3SpaceBefore: number | null;
    h3SpaceAfter: number | null;

    // Heading font sizes (null = use multiplier fallback)
    h3FontSize: number | null;

    // Brand colors (null = inherit naturally)
    h1Color: string | null;
    h2Color: string | null;
    h3Color: string | null;
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
    setH1SpaceBefore: (value: number | null) => void;
    setH1SpaceAfter: (value: number | null) => void;
    setH2SpaceBefore: (value: number | null) => void;
    setH2SpaceAfter: (value: number | null) => void;
    setH3SpaceBefore: (value: number | null) => void;
    setH3SpaceAfter: (value: number | null) => void;
    setH3FontSize: (size: number | null) => void;
    setH1Color: (color: string | null) => void;
    setH2Color: (color: string | null) => void;
    setH3Color: (color: string | null) => void;
    setBodyColor: (color: string) => void;
    applyPreset: (preset: 'h1' | 'h2' | 'body' | 'caption') => void;
    applyBrandPartial: (partial: Partial<Omit<StyleState, 'setFontFamily' | 'setFontSize' | 'setLineHeight' | 'setH1FontSize' | 'setH2FontSize' | 'setSpaceBefore' | 'setSpaceAfter' | 'setFirstLineIndent' | 'setH1SpaceBefore' | 'setH1SpaceAfter' | 'setH2SpaceBefore' | 'setH2SpaceAfter' | 'setH1Color' | 'setH2Color' | 'setBodyColor' | 'applyPreset' | 'applyBrandPartial' | 'resetToDefaults'>>) => void;
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
            setH1SpaceBefore: (value) => set({ h1SpaceBefore: value }),
            setH1SpaceAfter: (value) => set({ h1SpaceAfter: value }),
            setH2SpaceBefore: (value) => set({ h2SpaceBefore: value }),
            setH2SpaceAfter: (value) => set({ h2SpaceAfter: value }),
            setH3SpaceBefore: (value) => set({ h3SpaceBefore: value }),
            setH3SpaceAfter: (value) => set({ h3SpaceAfter: value }),
            setH3FontSize: (size) => set({ h3FontSize: size }),
            setH1Color: (color) => set({ h1Color: color }),
            setH2Color: (color) => set({ h2Color: color }),
            setH3Color: (color) => set({ h3Color: color }),
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
            version: 2,
            migrate: (persisted: unknown, version: number) => {
                const state = persisted as Record<string, unknown>;
                if (version < 1) {
                    // v0→v1: Clear hardcoded teal/dark heading colors so they become null (inherit)
                    if (state.h1Color === '#1A1A1A') state.h1Color = null;
                    if (state.h2Color === '#13818A') state.h2Color = null;
                }
                if (version < 2) {
                    // v1→v2: Force-clear any stale heading colors to null
                    state.h1Color = null;
                    state.h2Color = null;
                }
                return state;
            },
            partialize: (state) => ({
                fontFamily: state.fontFamily,
                fontSize: state.fontSize,
                lineHeight: state.lineHeight,
                h1FontSize: state.h1FontSize,
                h2FontSize: state.h2FontSize,
                spaceBefore: state.spaceBefore,
                spaceAfter: state.spaceAfter,
                firstLineIndent: state.firstLineIndent,
                h1SpaceBefore: state.h1SpaceBefore,
                h1SpaceAfter: state.h1SpaceAfter,
                h2SpaceBefore: state.h2SpaceBefore,
                h2SpaceAfter: state.h2SpaceAfter,
                h3SpaceBefore: state.h3SpaceBefore,
                h3SpaceAfter: state.h3SpaceAfter,
                h3FontSize: state.h3FontSize,
                h1Color: state.h1Color,
                h2Color: state.h2Color,
                h3Color: state.h3Color,
                bodyColor: state.bodyColor,
            }),
        }
    )
);
