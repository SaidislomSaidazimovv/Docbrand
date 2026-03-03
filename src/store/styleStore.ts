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
// Defaults (DocBrand baseline — Brand Spec)
// ---------------------------------------------------------------------------

const DEFAULTS = {
    fontFamily: 'Times New Roman',

    // Body
    fontSize: 12,
    lineHeight: 1,
    spaceBefore: 0,
    spaceAfter: 6,
    firstLineIndent: 0,
    bodyColor: '#1A1A1A',

    // Title
    titleFontSize: 32,
    titleColor: '#1A1A1A',
    titleSpaceBefore: 0,
    titleSpaceAfter: 24,
    titleLineHeight: 1.2,

    // Subtitle
    subtitleFontSize: 14,
    subtitleColor: '#1A1A1A',
    subtitleSpaceBefore: 0,
    subtitleSpaceAfter: 6,
    subtitleLineHeight: 1.15,

    // H1
    h1FontSize: 16,
    h1Color: '#13818A',
    h1SpaceBefore: 6,
    h1SpaceAfter: 12,
    h1LineHeight: 1.15,

    // H2
    h2FontSize: 14,
    h2Color: '#1A1A1A',
    h2SpaceBefore: 14,
    h2SpaceAfter: 6,
    h2LineHeight: 1.15,

    // H3
    h3FontSize: 13,
    h3Color: '#1A1A1A',
    h3SpaceBefore: 12,
    h3SpaceAfter: 6,
    h3LineHeight: 1,

    // H4 (Callout)
    h4FontSize: 11,
    h4Color: '#1A1A1A',
    h4SpaceBefore: 0,
    h4SpaceAfter: 4,
    h4LineHeight: 1,

    // H5 (Lead)
    h5FontSize: 12,
    h5Color: '#1A1A1A',
    h5SpaceBefore: 0,
    h5SpaceAfter: 6,
    h5LineHeight: 1.5,

    // H6 (Caption)
    h6FontSize: 10,
    h6Color: '#616366',
    h6SpaceBefore: 6,
    h6SpaceAfter: 4,
    h6LineHeight: 1,

    // Page margins (px) — 96px = 1 inch
    marginTop: 96,
    marginBottom: 96,
    marginLeft: 96,
    marginRight: 96,
    // Page dimensions (px) — US Letter at 96 DPI
    pageWidth: 816,
    pageHeight: 1056,
    // Margin guide visibility
    showMarginGuides: true,
    // Recently used fonts
    recentFonts: ['Times New Roman', 'Arial'] as string[],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PresetKey = 'title' | 'subtitle' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body';

interface StyleState {
    // Typography (Body)
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    spaceBefore: number;
    spaceAfter: number;
    firstLineIndent: number;
    bodyColor: string;

    // Title
    titleFontSize: number;
    titleColor: string;
    titleSpaceBefore: number;
    titleSpaceAfter: number;
    titleLineHeight: number;

    // Subtitle
    subtitleFontSize: number;
    subtitleColor: string;
    subtitleSpaceBefore: number;
    subtitleSpaceAfter: number;
    subtitleLineHeight: number;

    // H1
    h1FontSize: number;
    h1Color: string;
    h1SpaceBefore: number;
    h1SpaceAfter: number;
    h1LineHeight: number;

    // H2
    h2FontSize: number;
    h2Color: string;
    h2SpaceBefore: number;
    h2SpaceAfter: number;
    h2LineHeight: number;

    // H3
    h3FontSize: number;
    h3Color: string;
    h3SpaceBefore: number;
    h3SpaceAfter: number;
    h3LineHeight: number;

    // H4
    h4FontSize: number;
    h4Color: string;
    h4SpaceBefore: number;
    h4SpaceAfter: number;
    h4LineHeight: number;

    // H5
    h5FontSize: number;
    h5Color: string;
    h5SpaceBefore: number;
    h5SpaceAfter: number;
    h5LineHeight: number;

    // H6
    h6FontSize: number;
    h6Color: string;
    h6SpaceBefore: number;
    h6SpaceAfter: number;
    h6LineHeight: number;

    // Page margins (px)
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;

    // Page dimensions (px)
    pageWidth: number;
    pageHeight: number;

    // Margin guide visibility
    showMarginGuides: boolean;

    // Recently used fonts
    recentFonts: string[];

    // Actions
    setFontFamily: (font: string) => void;
    setFontSize: (size: number) => void;
    setLineHeight: (height: number) => void;
    setSpaceBefore: (value: number) => void;
    setSpaceAfter: (value: number) => void;
    setFirstLineIndent: (value: number) => void;
    setBodyColor: (color: string) => void;

    setTitleFontSize: (size: number) => void;
    setTitleColor: (color: string) => void;
    setSubtitleFontSize: (size: number) => void;
    setSubtitleColor: (color: string) => void;

    setH1FontSize: (size: number) => void;
    setH1Color: (color: string) => void;
    setH1SpaceBefore: (value: number) => void;
    setH1SpaceAfter: (value: number) => void;

    setH2FontSize: (size: number) => void;
    setH2Color: (color: string) => void;
    setH2SpaceBefore: (value: number) => void;
    setH2SpaceAfter: (value: number) => void;

    setH3FontSize: (size: number) => void;
    setH3Color: (color: string) => void;
    setH3SpaceBefore: (value: number) => void;
    setH3SpaceAfter: (value: number) => void;

    setH4FontSize: (size: number) => void;
    setH4Color: (color: string) => void;
    setH5FontSize: (size: number) => void;
    setH5Color: (color: string) => void;
    setH6FontSize: (size: number) => void;
    setH6Color: (color: string) => void;

    setMargins: (margins: { top: number; bottom: number; left: number; right: number }) => void;
    setPageSize: (size: { width: number; height: number }) => void;
    setShowMarginGuides: (show: boolean) => void;
    addRecentFont: (font: string) => void;
    applyPreset: (preset: PresetKey) => void;
    applyBrandPartial: (partial: Partial<typeof DEFAULTS>) => void;
    resetToDefaults: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStyleStore = create<StyleState>()(
    persist(
        (set) => ({
            ...DEFAULTS,

            // Body setters
            setFontFamily: (font) => set({ fontFamily: font }),
            setFontSize: (size) => set({ fontSize: size }),
            setLineHeight: (height) => set({ lineHeight: height }),
            setSpaceBefore: (value) => set({ spaceBefore: value }),
            setSpaceAfter: (value) => set({ spaceAfter: value }),
            setFirstLineIndent: (value) => set({ firstLineIndent: value }),
            setBodyColor: (color) => set({ bodyColor: color }),

            // Title / Subtitle
            setTitleFontSize: (size) => set({ titleFontSize: size }),
            setTitleColor: (color) => set({ titleColor: color }),
            setSubtitleFontSize: (size) => set({ subtitleFontSize: size }),
            setSubtitleColor: (color) => set({ subtitleColor: color }),

            // H1
            setH1FontSize: (size) => set({ h1FontSize: size }),
            setH1Color: (color) => set({ h1Color: color }),
            setH1SpaceBefore: (value) => set({ h1SpaceBefore: value }),
            setH1SpaceAfter: (value) => set({ h1SpaceAfter: value }),

            // H2
            setH2FontSize: (size) => set({ h2FontSize: size }),
            setH2Color: (color) => set({ h2Color: color }),
            setH2SpaceBefore: (value) => set({ h2SpaceBefore: value }),
            setH2SpaceAfter: (value) => set({ h2SpaceAfter: value }),

            // H3
            setH3FontSize: (size) => set({ h3FontSize: size }),
            setH3Color: (color) => set({ h3Color: color }),
            setH3SpaceBefore: (value) => set({ h3SpaceBefore: value }),
            setH3SpaceAfter: (value) => set({ h3SpaceAfter: value }),

            // H4–H6
            setH4FontSize: (size) => set({ h4FontSize: size }),
            setH4Color: (color) => set({ h4Color: color }),
            setH5FontSize: (size) => set({ h5FontSize: size }),
            setH5Color: (color) => set({ h5Color: color }),
            setH6FontSize: (size) => set({ h6FontSize: size }),
            setH6Color: (color) => set({ h6Color: color }),

            // Page
            setMargins: (margins) => set({
                marginTop: margins.top,
                marginBottom: margins.bottom,
                marginLeft: margins.left,
                marginRight: margins.right,
            }),
            setPageSize: (size) => set({ pageWidth: size.width, pageHeight: size.height }),
            setShowMarginGuides: (show) => set({ showMarginGuides: show }),

            addRecentFont: (font) => set((state) => ({
                recentFonts: [
                    font,
                    ...state.recentFonts.filter(f => f !== font),
                ].slice(0, 5),
            })),

            applyPreset: (preset) => {
                switch (preset) {
                    case 'title':
                        set({ titleFontSize: 32, titleLineHeight: 1.2, titleColor: '#1A1A1A', titleSpaceBefore: 0, titleSpaceAfter: 24 });
                        break;
                    case 'subtitle':
                        set({ subtitleFontSize: 14, subtitleLineHeight: 1.15, subtitleColor: '#1A1A1A', subtitleSpaceBefore: 0, subtitleSpaceAfter: 6 });
                        break;
                    case 'h1':
                        set({ h1FontSize: 16, h1LineHeight: 1.15, h1Color: '#13818A', h1SpaceBefore: 6, h1SpaceAfter: 12 });
                        break;
                    case 'h2':
                        set({ h2FontSize: 14, h2LineHeight: 1.15, h2Color: '#1A1A1A', h2SpaceBefore: 14, h2SpaceAfter: 6 });
                        break;
                    case 'h3':
                        set({ h3FontSize: 13, h3LineHeight: 1, h3Color: '#1A1A1A', h3SpaceBefore: 12, h3SpaceAfter: 6 });
                        break;
                    case 'h4':
                        set({ h4FontSize: 11, h4LineHeight: 1, h4Color: '#1A1A1A', h4SpaceBefore: 0, h4SpaceAfter: 4 });
                        break;
                    case 'h5':
                        set({ h5FontSize: 12, h5LineHeight: 1.5, h5Color: '#1A1A1A', h5SpaceBefore: 0, h5SpaceAfter: 6 });
                        break;
                    case 'h6':
                        set({ h6FontSize: 10, h6LineHeight: 1, h6Color: '#616366', h6SpaceBefore: 6, h6SpaceAfter: 4 });
                        break;
                    case 'body':
                        set({ fontSize: 12, lineHeight: 1, bodyColor: '#1A1A1A', spaceBefore: 0, spaceAfter: 6 });
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
            version: 5,
            migrate: (persisted: unknown, version: number) => {
                const state = persisted as Record<string, unknown>;
                if (version < 4) {
                    // v3→v4: Reset to brand-spec defaults (major schema change)
                    return { ...DEFAULTS, ...state, ...DEFAULTS };
                }
                if (version < 5) {
                    // v4→v5: Add recentFonts
                    return { ...state, recentFonts: ['Times New Roman', 'Arial'] };
                }
                return state;
            },
            partialize: (state) => ({
                fontFamily: state.fontFamily,
                fontSize: state.fontSize,
                lineHeight: state.lineHeight,
                spaceBefore: state.spaceBefore,
                spaceAfter: state.spaceAfter,
                firstLineIndent: state.firstLineIndent,
                bodyColor: state.bodyColor,

                titleFontSize: state.titleFontSize,
                titleColor: state.titleColor,
                titleSpaceBefore: state.titleSpaceBefore,
                titleSpaceAfter: state.titleSpaceAfter,
                titleLineHeight: state.titleLineHeight,

                subtitleFontSize: state.subtitleFontSize,
                subtitleColor: state.subtitleColor,
                subtitleSpaceBefore: state.subtitleSpaceBefore,
                subtitleSpaceAfter: state.subtitleSpaceAfter,
                subtitleLineHeight: state.subtitleLineHeight,

                h1FontSize: state.h1FontSize,
                h1Color: state.h1Color,
                h1SpaceBefore: state.h1SpaceBefore,
                h1SpaceAfter: state.h1SpaceAfter,
                h1LineHeight: state.h1LineHeight,

                h2FontSize: state.h2FontSize,
                h2Color: state.h2Color,
                h2SpaceBefore: state.h2SpaceBefore,
                h2SpaceAfter: state.h2SpaceAfter,
                h2LineHeight: state.h2LineHeight,

                h3FontSize: state.h3FontSize,
                h3Color: state.h3Color,
                h3SpaceBefore: state.h3SpaceBefore,
                h3SpaceAfter: state.h3SpaceAfter,
                h3LineHeight: state.h3LineHeight,

                h4FontSize: state.h4FontSize,
                h4Color: state.h4Color,
                h4SpaceBefore: state.h4SpaceBefore,
                h4SpaceAfter: state.h4SpaceAfter,
                h4LineHeight: state.h4LineHeight,

                h5FontSize: state.h5FontSize,
                h5Color: state.h5Color,
                h5SpaceBefore: state.h5SpaceBefore,
                h5SpaceAfter: state.h5SpaceAfter,
                h5LineHeight: state.h5LineHeight,

                h6FontSize: state.h6FontSize,
                h6Color: state.h6Color,
                h6SpaceBefore: state.h6SpaceBefore,
                h6SpaceAfter: state.h6SpaceAfter,
                h6LineHeight: state.h6LineHeight,

                marginTop: state.marginTop,
                marginBottom: state.marginBottom,
                marginLeft: state.marginLeft,
                marginRight: state.marginRight,
                pageWidth: state.pageWidth,
                pageHeight: state.pageHeight,
                showMarginGuides: state.showMarginGuides,
                recentFonts: state.recentFonts,
            }),
        }
    )
);
