'use client';

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// Page dimensions
const PAGE_HEIGHT = 1000;
const PAGE_GAP = 16;

const pageBreakPluginKey = new PluginKey('pageBreakPlugin');

/**
 * PageBreakExtension - Simple page count calculation
 * 
 * Only calculates page count based on content height.
 * Does NOT insert decorations to avoid layout instability.
 */
export const PageBreakExtension = Extension.create({
    name: 'pageBreakExtension',

    addStorage() {
        return {
            pageCount: 1,
        };
    },

    addProseMirrorPlugins() {
        const extensionStorage = this.storage;

        return [
            new Plugin({
                key: pageBreakPluginKey,

                view(editorView) {
                    let lastPageCount = 0; // Start at 0 so first calculation always dispatches

                    const dispatchPageCount = (pageCount: number) => {
                        extensionStorage.pageCount = pageCount;
                        const event = new CustomEvent('pagebreaks-updated', {
                            detail: { pageCount },
                        });
                        document.dispatchEvent(event);
                    };

                    const calculatePageCount = () => {
                        const editorElement = editorView.dom;
                        if (!editorElement) return;

                        const contentHeight = editorElement.scrollHeight;
                        // Minimum page count is 1
                        const pageCount = Math.max(1, Math.ceil(contentHeight / PAGE_HEIGHT));

                        if (lastPageCount !== pageCount) {
                            lastPageCount = pageCount;
                            dispatchPageCount(pageCount);
                        }
                    };

                    let updateTimeout: ReturnType<typeof setTimeout> | null = null;

                    const scheduleUpdate = () => {
                        if (updateTimeout) {
                            clearTimeout(updateTimeout);
                        }
                        updateTimeout = setTimeout(calculatePageCount, 100);
                    };

                    // Initial calculation - dispatch immediately for small content
                    setTimeout(() => {
                        calculatePageCount();
                        // Force dispatch even if pageCount is 1
                        if (lastPageCount === 1) {
                            dispatchPageCount(1);
                        }
                    }, 100);

                    const resizeObserver = new ResizeObserver(() => {
                        scheduleUpdate();
                    });
                    resizeObserver.observe(editorView.dom);

                    return {
                        update() {
                            scheduleUpdate();
                        },
                        destroy() {
                            if (updateTimeout) {
                                clearTimeout(updateTimeout);
                            }
                            resizeObserver.disconnect();
                        },
                    };
                },
            }),
        ];
    },
});

export { PAGE_HEIGHT, PAGE_GAP };
