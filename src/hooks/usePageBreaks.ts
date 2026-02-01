'use client';

import { useEffect, useState, RefObject } from 'react';

// A4 page height in pixels (at 96 DPI): 297mm = 1123px
// With margins and header/footer, usable content area is approximately 800px
const PAGE_HEIGHT = 800;

interface PageBreak {
    position: number;  // Y position in pixels
    pageNumber: number;
}

/**
 * Hook to track content height and calculate page breaks
 */
export function usePageBreaks(containerRef: RefObject<HTMLElement | null>): PageBreak[] {
    const [pageBreaks, setPageBreaks] = useState<PageBreak[]>([]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const calculatePageBreaks = () => {
            // Find the actual ProseMirror editor element
            const proseMirror = container.querySelector('.ProseMirror');
            if (!proseMirror) {
                console.log('[PageBreaks] ProseMirror not found');
                return;
            }

            // Get all block elements and find the last one's bottom position
            const children = proseMirror.children;
            let contentHeight = 0;

            if (children.length > 0) {
                const containerRect = container.getBoundingClientRect();
                const lastChild = children[children.length - 1];
                const lastChildRect = lastChild.getBoundingClientRect();

                // Calculate content height relative to container
                contentHeight = lastChildRect.bottom - containerRect.top + 50; // +50 for padding
            }

            const breaks: PageBreak[] = [];

            // Calculate how many page breaks we need
            const numPages = Math.ceil(contentHeight / PAGE_HEIGHT);

            // Debug log
            console.log('[PageBreaks] Content height:', Math.round(contentHeight), 'Pages:', numPages);

            for (let i = 1; i < numPages; i++) {
                breaks.push({
                    position: i * PAGE_HEIGHT,
                    pageNumber: i + 1,
                });
            }

            setPageBreaks(breaks);
        };

        // Initial calculation with slight delay for DOM to settle
        const initialTimeout = setTimeout(calculatePageBreaks, 100);

        // Use ResizeObserver to track content changes
        const resizeObserver = new ResizeObserver(() => {
            calculatePageBreaks();
        });

        resizeObserver.observe(container);

        // Also observe ProseMirror if it exists
        const proseMirror = container.querySelector('.ProseMirror');
        if (proseMirror) {
            resizeObserver.observe(proseMirror);
        }

        // Also observe mutations for content changes
        const mutationObserver = new MutationObserver(() => {
            // Debounce mutation callback
            setTimeout(calculatePageBreaks, 50);
        });

        mutationObserver.observe(container, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        return () => {
            clearTimeout(initialTimeout);
            resizeObserver.disconnect();
            mutationObserver.disconnect();
        };
    }, [containerRef]);

    return pageBreaks;
}

export function usePageCount(containerRef: RefObject<HTMLElement | null>): number {
    const pageBreaks = usePageBreaks(containerRef);
    return pageBreaks.length + 1;
}

export { PAGE_HEIGHT };

