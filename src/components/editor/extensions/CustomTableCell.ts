import { TableCell } from '@tiptap/extension-table-cell';

/**
 * Extends stock TableCell with a `basisOfEstimate` attribute
 * for GovCon audit trail metadata per cell.
 *
 * Stored as data-boe in HTML, available via getAttributes('tableCell').
 */
export const CustomTableCell = TableCell.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            basisOfEstimate: {
                default: null,
                parseHTML: (element: HTMLElement) =>
                    element.getAttribute('data-boe') || null,
                renderHTML: (attributes: Record<string, unknown>) => {
                    if (!attributes.basisOfEstimate) return {};
                    return { 'data-boe': attributes.basisOfEstimate as string };
                },
            },
        };
    },
});
