'use client';

import { useStyleStore } from '@/store/styleStore';

/**
 * MarginGuide — renders 4 dashed lines at the margin boundaries.
 * Absolutely positioned inside the editor container.
 * pointer-events: none so it doesn't interfere with editing.
 * Hidden in print via @media print.
 */
export default function MarginGuide() {
    const { marginTop, marginBottom, marginLeft, marginRight, showMarginGuides } = useStyleStore();

    if (!showMarginGuides) return null;

    const lineStyle = '1px dashed #D1D5DB';

    return (
        <div className="absolute inset-0 pointer-events-none z-10 print:hidden">
            {/* Top margin line */}
            <div
                className="absolute left-0 right-0"
                style={{ top: `${marginTop}px`, borderBottom: lineStyle }}
            />
            {/* Bottom margin line */}
            <div
                className="absolute left-0 right-0"
                style={{ bottom: `${marginBottom}px`, borderTop: lineStyle }}
            />
            {/* Left margin line */}
            <div
                className="absolute top-0 bottom-0"
                style={{ left: `${marginLeft}px`, borderRight: lineStyle }}
            />
            {/* Right margin line */}
            <div
                className="absolute top-0 bottom-0"
                style={{ right: `${marginRight}px`, borderLeft: lineStyle }}
            />
        </div>
    );
}
