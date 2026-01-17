/**
 * PDF Parser using pdfjs-dist
 * 
 * Properly configured for Next.js with:
 * - Dynamic import (SSR safe)
 * - Worker from CDN
 * - Instance caching
 * 
 * @see docs/Skills/pdfjs/PDFJS_NextJS_Dynamic_Import.md
 */

export interface ParsedParagraph {
    text: string;
    pageNumber: number;
}

// Cache pdfjs instance to avoid re-importing
let pdfjsLib: typeof import('pdfjs-dist') | null = null;

/**
 * Get pdfjs instance with lazy loading
 * - Only imports in browser (SSR safe)
 * - Caches instance for performance
 */
async function getPdfJs() {
    if (pdfjsLib) return pdfjsLib;

    // SSR guard
    if (typeof window === 'undefined') {
        throw new Error('PDF.js can only run in browser');
    }

    // Dynamic import - never evaluated on server
    pdfjsLib = await import('pdfjs-dist');

    // Set worker from CDN - must match the installed version
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

    return pdfjsLib;
}

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
