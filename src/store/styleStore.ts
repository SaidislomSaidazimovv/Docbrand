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
    fontFamily: 'Times New Roman',
    fontSize: 16,
    lineHeight: 1,
    spaceBefore: 0,
    spaceAfter: 0,
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
}));
