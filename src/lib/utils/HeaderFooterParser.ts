/**
 * Header/Footer Parser Utility
 * 
 * Detects and separates header/footer sections from pasted text.
 * 
 * Detection patterns:
 * - Header: Date, To, From, Subject lines at start
 * - Footer: Sincerely, Regards, Signature at end
 * - Separators: --- or === lines
 * 
 * NOTE: This is a NEW file - does not modify any existing code
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedDocument {
    header: string[];
    body: string[];
    footer: string[];
}

// =============================================================================
// DETECTION PATTERNS
// =============================================================================

const HEADER_KEYWORDS = [
    /^date:/i,
    /^to:/i,
    /^from:/i,
    /^subject:/i,
    /^re:/i,
    /^cc:/i,
    /^bcc:/i,
    /^attn:/i,
    /^attention:/i,
    /^ref:/i,
    /^reference:/i,
];

const FOOTER_KEYWORDS = [
    /^sincerely,?$/i,
    /^regards,?$/i,
    /^best regards,?$/i,
    /^best,?$/i,
    /^thanks,?$/i,
    /^thank you,?$/i,
    /^yours truly,?$/i,
    /^respectfully,?$/i,
    /^cordially,?$/i,
    /^cheers,?$/i,
];

const SEPARATOR_PATTERN = /^[-=]{3,}$/;

// =============================================================================
// PARSER FUNCTIONS
// =============================================================================

/**
 * Check if a line is a header line
 */
function isHeaderLine(line: string): boolean {
    const trimmed = line.trim();
    return HEADER_KEYWORDS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a line starts a footer section
 */
function isFooterStart(line: string): boolean {
    const trimmed = line.trim();
    return FOOTER_KEYWORDS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a line is a separator
 */
function isSeparator(line: string): boolean {
    return SEPARATOR_PATTERN.test(line.trim());
}

/**
 * Parse document text into header, body, and footer sections
 */
export function parseHeaderFooter(text: string): ParsedDocument {
    const lines = text.split('\n');
    const result: ParsedDocument = {
        header: [],
        body: [],
        footer: [],
    };

    if (lines.length === 0) {
        return result;
    }

    let currentSection: 'header' | 'body' | 'footer' = 'header';
    let headerEnded = false;
    let footerStartIndex = -1;

    // First pass: Find footer start
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines at the end
        if (!trimmed && footerStartIndex === -1) {
            continue;
        }

        // Check if this line starts footer
        if (isFooterStart(trimmed)) {
            footerStartIndex = i;
            break;
        }

        // Check for separator before footer
        if (isSeparator(trimmed) && i < lines.length - 1) {
            // Check if lines after separator look like footer
            const nextNonEmpty = lines.slice(i + 1).find(l => l.trim());
            if (nextNonEmpty && isFooterStart(nextNonEmpty)) {
                footerStartIndex = i;
                break;
            }
        }

        // Stop looking if we go too far back
        if (i < lines.length - 10) break;
    }

    // Second pass: Categorize lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Footer section
        if (footerStartIndex !== -1 && i >= footerStartIndex) {
            result.footer.push(line);
            continue;
        }

        // Header section (at start of document)
        if (!headerEnded && currentSection === 'header') {
            // Check if this is a header line
            if (isHeaderLine(trimmed)) {
                result.header.push(line);
                continue;
            }

            // Check for separator after header
            if (isSeparator(trimmed) && result.header.length > 0) {
                result.header.push(line);
                headerEnded = true;
                currentSection = 'body';
                continue;
            }

            // Empty line might end header
            if (!trimmed && result.header.length > 0) {
                headerEnded = true;
                currentSection = 'body';
            }

            // Non-header line ends header detection
            if (trimmed && !isHeaderLine(trimmed)) {
                headerEnded = true;
                currentSection = 'body';
                result.body.push(line);
                continue;
            }
        }

        // Body section
        result.body.push(line);
    }

    // If no explicit header was found, move everything to body
    if (result.header.length === 0 && result.body.length === 0) {
        result.body = lines;
    }

    return result;
}

/**
 * Check if text contains header/footer sections
 */
export function hasHeaderFooter(text: string): boolean {
    const parsed = parseHeaderFooter(text);
    return parsed.header.length > 0 || parsed.footer.length > 0;
}

/**
 * Get just the body content (without header/footer)
 */
export function getBodyContent(text: string): string {
    const parsed = parseHeaderFooter(text);
    return parsed.body.join('\n');
}

/**
 * Format header/footer with visual separators
 */
export function formatWithSections(parsed: ParsedDocument): string {
    const parts: string[] = [];

    if (parsed.header.length > 0) {
        parts.push('=== HEADER ===');
        parts.push(...parsed.header);
        parts.push('');
    }

    parts.push(...parsed.body);

    if (parsed.footer.length > 0) {
        parts.push('');
        parts.push('=== FOOTER ===');
        parts.push(...parsed.footer);
    }

    return parts.join('\n');
}

export default {
    parseHeaderFooter,
    hasHeaderFooter,
    getBodyContent,
    formatWithSections,
};
