'use client';

import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        lineHeight: {
            setLineHeight: (lineHeight: string) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

export const LineHeight = Extension.create({
    name: 'lineHeight',

    addOptions() {
        return {
            types: ['paragraph', 'heading'],
        };
    },

    addGlobalAttributes() {
        return [
            {
                types: this.options.types,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: (element: HTMLElement) => element.style.lineHeight || null,
                        renderHTML: (attributes: Record<string, string>) => {
                            if (!attributes.lineHeight) return {};
                            return { style: `line-height: ${attributes.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setLineHeight:
                (lineHeight: string) =>
                ({ commands }) => {
                    return this.options.types.every((type: string) =>
                        commands.updateAttributes(type, { lineHeight })
                    );
                },
            unsetLineHeight:
                () =>
                ({ commands }) => {
                    return this.options.types.every((type: string) =>
                        commands.resetAttributes(type, 'lineHeight')
                    );
                },
        };
    },
});
