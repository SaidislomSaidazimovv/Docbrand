/**
 * DOCX Parser using mammoth
 * 
 * Parses DOCX files and extracts text content as paragraphs.
 */

import mammoth from 'mammoth';

export interface ParsedParagraph {
    text: string;
    pageNumber: number;
}

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
