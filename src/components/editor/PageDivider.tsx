'use client';

interface PageDividerProps {
    position: number;
    pageNumber: number;
}

/**
 * Visual page break indicator - shows where page breaks occur
 * Content flows continuously, this is just a visual marker
 */
export default function PageDivider({ position, pageNumber }: PageDividerProps) {
    return (
        <div
            className="page-divider absolute left-0 right-0 pointer-events-none"
            style={{
                top: `${position}px`,
                zIndex: 10,
            }}
        >
            {/* Visible page break line */}
            <div className="relative w-full h-0">
                {/* Border line */}
                <div
                    className="absolute left-0 right-0 border-t-2 border-dashed"
                    style={{ borderColor: '#3b82f6' }}
                />

                {/* Page number badge on right side */}
                <div
                    className="absolute right-0 -top-3 px-3 py-1 rounded-full text-xs font-medium shadow-sm"
                    style={{
                        backgroundColor: '#3b82f6',
                        color: 'white',
                    }}
                >
                    Page {pageNumber}
                </div>
            </div>
        </div>
    );
}
