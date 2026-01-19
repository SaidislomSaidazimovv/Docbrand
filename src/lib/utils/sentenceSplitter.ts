/**
 * Sentence Splitter Utility
 * 
 * Splits paragraphs into individual sentences for better block-level linking.
 * Handles common abbreviations and edge cases.
 */

/**
 * Common abbreviations that shouldn't trigger sentence split
 */
const ABBREVIATIONS = [
    'Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.',
    'Inc.', 'Ltd.', 'Corp.', 'Co.', 'LLC.',
    'vs.', 'etc.', 'e.g.', 'i.e.', 'et al.',
    'No.', 'Vol.', 'Rev.', 'Ed.',
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.',
];

/**
 * Escape abbreviations to prevent false sentence splits
 */
function escapeAbbreviations(text: string): string {
    let escaped = text;
    ABBREVIATIONS.forEach((abbr, index) => {
        const placeholder = `__ABBR_${index}__`;
        escaped = escaped.replace(new RegExp(abbr.replace('.', '\\.'), 'g'), placeholder);
    });
    return escaped;
}

/**
 * Restore abbreviations after splitting
 */
function restoreAbbreviations(text: string): string {
    let restored = text;
    ABBREVIATIONS.forEach((abbr, index) => {
        const placeholder = `__ABBR_${index}__`;
        restored = restored.replace(new RegExp(placeholder, 'g'), abbr);
    });
    return restored;
}

/**
 * Split text into sentences
 * 
 * @param text - Input paragraph text
 * @param minLength - Minimum sentence length (default: 20 chars)
 * @returns Array of individual sentences
 */
export function splitIntoSentences(text: string, minLength: number = 20): string[] {
    if (!text || text.length < minLength) {
        return text ? [text.trim()] : [];
    }

    // Escape abbreviations
    const escaped = escapeAbbreviations(text);

    // Split on sentence-ending punctuation followed by space or end
    const sentences = escaped
        .split(/(?<=[.!?])\s+/)
        .map(s => restoreAbbreviations(s.trim()))
        .filter(s => s.length >= minLength);

    // If no sentences found, return original text as single block
    if (sentences.length === 0 && text.trim().length > 0) {
        return [text.trim()];
    }

    return sentences;
}

/**
 * Split a paragraph into blocks (sentences)
 * 
 * @param paragraph - Input paragraph object with text and metadata
 * @returns Array of block objects with sentence text and metadata
 */
export interface ParagraphBlock {
    text: string;
    pageNumber: number;
    paragraphIndex: number;
    sentenceIndex: number;
    blockId: string;
}

export interface InputParagraph {
    text: string;
    pageNumber: number;
}

/**
 * Generate a stable block ID using FNV-1a hash
 */
function generateBlockId(text: string, pageNumber: number, index: number): string {
    const input = `${pageNumber}-${index}-${text.substring(0, 50)}`;
    let hash = 2166136261; // FNV offset basis

    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit
    }

    return `block-${hash.toString(16).padStart(8, '0')}`;
}

/**
 * Split paragraphs into sentence-level blocks
 * 
 * @param paragraphs - Array of parsed paragraphs
 * @returns Array of blocks (one per sentence)
 */
export function splitParagraphsIntoBlocks(paragraphs: InputParagraph[]): ParagraphBlock[] {
    const blocks: ParagraphBlock[] = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
        const sentences = splitIntoSentences(paragraph.text);

        sentences.forEach((sentence, sentenceIndex) => {
            blocks.push({
                text: sentence,
                pageNumber: paragraph.pageNumber,
                paragraphIndex,
                sentenceIndex,
                blockId: generateBlockId(sentence, paragraph.pageNumber, blocks.length),
            });
        });
    });

    return blocks;
}

export default splitIntoSentences;
