/**
 * Normalized Import Payload
 *
 * The canonical shape returned by the server parse route and consumed by
 * the client apply function. Both JSON import and PDF/DOCX/XLSX import
 * converge on this shape before applying to stores.
 */

export interface NormalizedImportPayload {
    brand: {
        fontFamily: string | null;
        fontSize: number | null;
        lineHeight: number | null;
        spaceBefore: number | null;
        spaceAfter: number | null;
        h1Color: string | null;
        h2Color: string | null;
        bodyColor: string | null;
        h1FontSize: number | null;
        h2FontSize: number | null;
        h1SpaceBefore: number | null;
        h1SpaceAfter: number | null;
        h2SpaceBefore: number | null;
        h2SpaceAfter: number | null;
        h3Color: string | null;
        h3FontSize: number | null;
        h3SpaceBefore: number | null;
        h3SpaceAfter: number | null;
    };
    document: {
        type: 'doc';
        content: unknown[];
    } | null;
    requirements: Array<{
        id?: string;
        text: string;
        section?: string | null;
        priority?: string | null;
    }>;
    margins: { top: number; bottom: number; left: number; right: number } | null;
    pageSize: { width: number; height: number; orientation: 'portrait' | 'landscape' } | null;
}

/** Result summary returned after applying the payload */
export interface ImportApplyResult {
    brandFields: string[];
    documentLoaded: boolean;
    requirementsCount: number;
}
