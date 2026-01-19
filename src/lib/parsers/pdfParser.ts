/**
 * PDF Parser using pdfjs-dist
 * 
 * Exactly as specified in docs/Skills/pdfjs/PDFJS_NextJS_Dynamic_Import.md
 * - Dynamic import (SSR safe)
 * - Worker from node_modules via import.meta.url
 * - Instance caching
 * 
 * Enhanced with sentence-level splitting for better block linking.
 */

import { splitParagraphsIntoBlocks, type ParagraphBlock } from '@/lib/utils/sentenceSplitter';

export interface ParsedParagraph {
    text: string;
    pageNumber: number;
}

// ✅ CORRECT - lazy load in browser only
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfJs() {
    if (pdfjsLib) return pdfjsLib;

    if (typeof window === 'undefined') {
        throw new Error('PDF.js can only run in browser');
    }

    // Dynamic import - never evaluated on server
    pdfjsLib = await import('pdfjs-dist');

    // Worker from node_modules (not CDN) - exactly as skill documents
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString();

    return pdfjsLib;
}

/**
 * Parse PDF file into paragraphs (legacy)
 */
export async function parsePDF(file: File): Promise<ParsedParagraph[]> {
    const pdfjs = await getPdfJs();

    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
    });

    const pdf = await loadingTask.promise;
    const paragraphs: ParsedParagraph[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();

        let currentParagraph = '';

        for (const item of textContent.items) {
            if ('str' in item) {
                const text = item.str.trim();
                if (text) {
                    if (currentParagraph && !currentParagraph.endsWith(' ')) {
                        currentParagraph += ' ';
                    }
                    currentParagraph += text;
                }

                if (item.str === '' && currentParagraph) {
                    paragraphs.push({
                        text: currentParagraph.trim(),
                        pageNumber: pageNum,
                    });
                    currentParagraph = '';
                }
            }
        }

        if (currentParagraph.trim()) {
            paragraphs.push({
                text: currentParagraph.trim(),
                pageNumber: pageNum,
            });
        }
    }

    return paragraphs.filter((p) => p.text.length > 20);
}

/**
 * Parse PDF file into sentence-level blocks
 * 
 * Each sentence becomes a separate block with unique ID for requirement linking.
 */
export async function parsePDFToBlocks(file: File): Promise<ParagraphBlock[]> {
    const paragraphs = await parsePDF(file);
    return splitParagraphsIntoBlocks(paragraphs);
}

export { type ParagraphBlock };
