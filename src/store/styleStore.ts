/**
 * Style Store - Zustand
 * 
 * Manages document typography and spacing styles that apply to the editor
 */

import { create } from 'zustand';

interface StyleState {
    // Typography
    fontFamily: string;
    fontSize: number;
    lineHeight: number;

    // Spacing
    spaceBefore: number;
    spaceAfter: number;
    firstLineIndent: number;

    // Actions
    setFontFamily: (font: string) => void;
    setFontSize: (size: number) => void;
    setLineHeight: (height: number) => void;
    setSpaceBefore: (value: number) => void;
    setSpaceAfter: (value: number) => void;
    setFirstLineIndent: (value: number) => void;
    applyPreset: (preset: 'h1' | 'h2' | 'body' | 'caption') => void;
}

export const useStyleStore = create<StyleState>((set) => ({
    fontFamily: 'Inter',
    fontSize: 14,
    lineHeight: 1.7,
    spaceBefore: 0,
    spaceAfter: 12,
    firstLineIndent: 0,

    setFontFamily: (font) => set({ fontFamily: font }),
    setFontSize: (size) => set({ fontSize: size }),
    setLineHeight: (height) => set({ lineHeight: height }),
    setSpaceBefore: (value) => set({ spaceBefore: value }),
    setSpaceAfter: (value) => set({ spaceAfter: value }),
    setFirstLineIndent: (value) => set({ firstLineIndent: value }),

    applyPreset: (preset) => {
        switch (preset) {
            case 'h1':
                set({ fontSize: 32, lineHeight: 1.2 });
                break;
            case 'h2':
                set({ fontSize: 24, lineHeight: 1.3 });
                break;
            case 'body':
                set({ fontSize: 14, lineHeight: 1.7 });
                break;
            case 'caption':
                set({ fontSize: 12, lineHeight: 1.5 });
                break;
        }
    },
}));
