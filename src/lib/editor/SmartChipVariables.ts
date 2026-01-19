/**
 * Smart Chip Variable System
 * 
 * Dynamic variables for Header/Footer that auto-update:
 * - {page} - Current page number
 * - {pages} - Total page count
 * - {date} - Current date
 * - {title} - Document title
 * - {company} - Company name
 * - {author} - Author name
 */

export interface SmartChipVariable {
    id: string;
    name: string;
    token: string;  // e.g., "{page}"
    description: string;
    getValue: (context: VariableContext) => string;
}

export interface VariableContext {
    currentPage: number;
    totalPages: number;
    documentTitle: string;
    companyName: string;
    authorName: string;
    dateFormat: 'short' | 'long' | 'iso';
}

/**
 * Format date based on format type
 */
function formatDate(format: 'short' | 'long' | 'iso'): string {
    const now = new Date();
    switch (format) {
        case 'short':
            return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        case 'long':
            return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        case 'iso':
            return now.toISOString().split('T')[0];
        default:
            return now.toLocaleDateString();
    }
}

/**
 * Built-in Smart Chip Variables
 */
export const SMART_CHIPS: SmartChipVariable[] = [
    {
        id: 'page',
        name: 'Page Number',
        token: '{page}',
        description: 'Current page number',
        getValue: (ctx) => String(ctx.currentPage),
    },
    {
        id: 'pages',
        name: 'Total Pages',
        token: '{pages}',
        description: 'Total number of pages',
        getValue: (ctx) => String(ctx.totalPages),
    },
    {
        id: 'page_of_pages',
        name: 'Page X of Y',
        token: '{page} of {pages}',
        description: 'Page number with total',
        getValue: (ctx) => `Page ${ctx.currentPage} of ${ctx.totalPages}`,
    },
    {
        id: 'date',
        name: 'Date',
        token: '{date}',
        description: 'Current date',
        getValue: (ctx) => formatDate(ctx.dateFormat),
    },
    {
        id: 'title',
        name: 'Document Title',
        token: '{title}',
        description: 'Document title',
        getValue: (ctx) => ctx.documentTitle || 'Untitled',
    },
    {
        id: 'company',
        name: 'Company Name',
        token: '{company}',
        description: 'Company name from settings',
        getValue: (ctx) => ctx.companyName || 'Company',
    },
    {
        id: 'author',
        name: 'Author',
        token: '{author}',
        description: 'Document author',
        getValue: (ctx) => ctx.authorName || 'Author',
    },
    {
        id: 'year',
        name: 'Year',
        token: '{year}',
        description: 'Current year',
        getValue: () => String(new Date().getFullYear()),
    },
];

/**
 * Replace all variable tokens in a string with their values
 */
export function resolveVariables(text: string, context: VariableContext): string {
    let result = text;

    for (const chip of SMART_CHIPS) {
        // Handle composite tokens like "{page} of {pages}"
        if (chip.token.includes(' ')) continue;

        const regex = new RegExp(chip.token.replace(/[{}]/g, '\\$&'), 'g');
        result = result.replace(regex, chip.getValue(context));
    }

    return result;
}

/**
 * Find all variable tokens in a string
 */
export function findVariables(text: string): string[] {
    const matches = text.match(/\{[a-z_]+\}/gi);
    return matches || [];
}

/**
 * Check if text contains any variables
 */
export function hasVariables(text: string): boolean {
    return /\{[a-z_]+\}/i.test(text);
}

export default SMART_CHIPS;
