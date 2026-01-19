/**
 * DOCX Parser using mammoth
 * 
 * Parses DOCX files and extracts text content as paragraphs.
 * Enhanced with sentence-level splitting for better block linking.
 */

import mammoth from 'mammoth';
import { splitParagraphsIntoBlocks, type ParagraphBlock } from '@/lib/utils/sentenceSplitter';

export interface ParsedParagraph {
    text: string;
    pageNumber: number;
}

/**
 * Parse DOCX file into paragraphs (legacy)
 */
export async function parseDOCX(file: File): Promise<ParsedParagraph[]> {
    const arrayBuffer = await file.arrayBuffer();

    // Extract raw text
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;

    // Split into paragraphs
    const paragraphs = text
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 20) // Filter short lines
        .map((text, index) => ({
            text,
            pageNumber: Math.floor(index / 10) + 1, // Estimate page number
        }));

    return paragraphs;
}

/**
 * Parse DOCX file into sentence-level blocks
 * 
 * Each sentence becomes a separate block with unique ID for requirement linking.
 */
export async function parseDOCXToBlocks(file: File): Promise<ParagraphBlock[]> {
    const paragraphs = await parseDOCX(file);
    return splitParagraphsIntoBlocks(paragraphs);
}

export { type ParagraphBlock };
