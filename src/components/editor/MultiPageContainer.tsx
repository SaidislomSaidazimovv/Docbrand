'use client';

import { useEffect, useRef, useState, ReactNode, cloneElement, isValidElement } from 'react';

// A4 page dimensions
const PAGE_WIDTH = 800; // px
const PAGE_HEIGHT = 1000; // px - visible content area per page
const PAGE_GAP = 40; // px - gap between pages

interface MultiPageContainerProps {
    children: ReactNode;
    onPageCountChange?: (count: number) => void;
}

/**
 * MultiPageContainer - Creates Word-like multi-page layout
 * 
 * Uses a single editor content that is positioned differently in each page
 * to show the appropriate portion. This creates the illusion of separate pages.
 */
export default function MultiPageContainer({ children, onPageCountChange }: MultiPageContainerProps) {
    const [pageCount, setPageCount] = useState(1);
    const [contentHeight, setContentHeight] = useState(0);
    const measureRef = useRef<HTMLDivElement>(null);

    // Calculate page count based on content height
    useEffect(() => {
        const calculatePages = () => {
            if (!measureRef.current) return;

            const proseMirror = measureRef.current.querySelector('.ProseMirror');
            if (!proseMirror) return;

            const height = proseMirror.scrollHeight;
            setContentHeight(height);

            const pages = Math.max(1, Math.ceil(height / PAGE_HEIGHT));

            if (pages !== pageCount) {
                setPageCount(pages);
                onPageCountChange?.(pages);
            }
        };

        // Initial calculation
        const timeout = setTimeout(calculatePages, 100);

        // Observe content changes
        const observer = new MutationObserver(() => {
            setTimeout(calculatePages, 50);
        });

        const resizeObserver = new ResizeObserver(() => {
            calculatePages();
        });

        if (measureRef.current) {
            observer.observe(measureRef.current, {
                childList: true,
                subtree: true,
                characterData: true,
            });
            resizeObserver.observe(measureRef.current);
        }

        return () => {
            clearTimeout(timeout);
            observer.disconnect();
            resizeObserver.disconnect();
        };
    }, [pageCount, onPageCountChange]);

    // Total height including gaps
    const totalHeight = pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP;

    return (
        <div
            className="multi-page-editor relative"
            style={{
                minHeight: `${totalHeight}px`,
            }}
        >
            {/* Page backgrounds with gaps */}
            {Array.from({ length: pageCount }, (_, i) => (
                <div
                    key={`bg-${i}`}
                    className="absolute bg-white rounded-lg shadow-2xl pointer-events-none"
                    style={{
                        width: `${PAGE_WIDTH}px`,
                        height: `${PAGE_HEIGHT}px`,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        top: `${i * (PAGE_HEIGHT + PAGE_GAP)}px`,
                    }}
                >
                    {/* Page number badge */}
                    <div
                        className="absolute top-3 right-4 px-3 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full"
                    >
                        Page {i + 1} of {pageCount}
                    </div>
                </div>
            ))}

            {/* Actual content - positioned absolutely to overlap page backgrounds */}
            <div
                ref={measureRef}
                className="relative z-10"
                style={{
                    width: `${PAGE_WIDTH}px`,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    // Add padding between pages to offset for gaps
                    paddingTop: '0px',
                }}
            >
                {/* Spacers for each page break to push content down */}
                <style jsx global>{`
                    .multi-page-editor .ProseMirror {
                        padding: 2rem 4rem;
                    }
                    
                    /* Add visual page breaks by inserting margin at page boundaries */
                    .multi-page-editor .page-break-spacer {
                        height: ${PAGE_GAP}px;
                        background: transparent;
                        pointer-events: none;
                    }
                `}</style>

                {children}
            </div>
        </div>
    );
}

export { PAGE_HEIGHT, PAGE_WIDTH, PAGE_GAP };
