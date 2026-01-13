/**
 * PDF Parser using pdfjs-dist
 * 
 * Properly configured for Next.js with worker from CDN
 */

export interface ParsedParagraph {
    text: string;
    pageNumber: number;
}

export async function parsePDF(file: File): Promise<ParsedParagraph[]> {
    // Dynamic import
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker from CDN - must match the installed version
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjsLib.getDocument({
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
