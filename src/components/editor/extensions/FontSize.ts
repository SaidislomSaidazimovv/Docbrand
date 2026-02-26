'use client';

import { Extension } from '@tiptap/core';
import '@tiptap/extension-text-style';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (size: string) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

export const FontSize = Extension.create({
    name: 'fontSize',

    addOptions() {
        return {
            types: ['textStyle'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    fontSize: {
                        default: null,
                        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
                        renderHTML: (attributes: Record<string, string>) => {
                            if (!attributes.fontSize) return {};
                            return { style: `font-size: ${attributes.fontSize}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize:
                (fontSize: string) =>
                ({ chain, editor }) => {
                    // GovCon compliance: min 8pt inside table cells
                    const inTable = editor.isActive('table');
                    if (inTable) {
                        const num = parseFloat(fontSize);
                        if (!isNaN(num)) {
                            const unit = fontSize.replace(String(num), '').trim() || 'px';
                            const ptSize = unit === 'pt' ? num : num * 0.75; // px→pt
                            if (ptSize < 8) {
                                const minPx = unit === 'pt' ? '8pt' : `${Math.ceil(8 / 0.75)}px`;
                                fontSize = minPx;
                            }
                        }
                    }
                    return chain().setMark('textStyle', { fontSize }).run();
                },
            unsetFontSize:
                () =>
                ({ chain }) => {
                    return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
                },
        };
    },
});
