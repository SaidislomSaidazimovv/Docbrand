/**
 * POST /api/import/parse
 *
 * Hybrid import pipeline:
 * - LlamaParse for document STRUCTURE (both DOCX and PDF)
 * - JSZip+XML for DOCX BRAND typography (fonts, colors, spacing, margins, pageSize)
 * - Gemini for PDF brand estimation + requirements extraction (both formats)
 *
 * Security: API keys never leave the server. Client calls only this endpoint.
 */

export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { validateBrand } from '@/lib/brand/extractBrandFromJson';
import { extractBrandFromDocx } from '@/lib/brand/extractBrandFromDocx';
import { parseWithLlama } from '@/lib/parsers/llamaParser';
import type { NormalizedImportPayload } from '@/lib/import/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// MIME type helpers
// ---------------------------------------------------------------------------

const ALLOWED_TYPES: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
};

const EXT_TO_MIME: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

function resolveFileType(file: File): { mime: string; label: string } | null {
    // Try MIME type first
    if (file.type && ALLOWED_TYPES[file.type]) {
        return { mime: file.type, label: ALLOWED_TYPES[file.type] };
    }
    // Fallback to extension
    const ext = '.' + file.name.toLowerCase().split('.').pop();
    const mime = EXT_TO_MIME[ext];
    if (mime && ALLOWED_TYPES[mime]) {
        return { mime, label: ALLOWED_TYPES[mime] };
    }
    return null;
}

// ---------------------------------------------------------------------------
// Gemini prompts
// ---------------------------------------------------------------------------

/** Requirements extraction prompt — used for both DOCX and PDF. */
const REQUIREMENTS_PROMPT = `You are an RFP/tender requirements extraction engine.

Given plain text from a document, extract requirements and return ONLY valid JSON — no markdown fences, no explanation:

{
  "requirements": [
    {
      "id": "req-1",
      "text": "full requirement text",
      "section": "section name or null",
      "priority": "mandatory" or "desired"
    }
  ]
}

Rules:
- Extract sentences/clauses containing "shall", "must", "required", "mandatory", "will", "needs to", "is required to", etc.
- Each requirement should be the full sentence or clause — do not summarize
- "section" should be the heading/section the requirement falls under, or null if unclear
- "priority": use "mandatory" for shall/must/required/mandatory, "desired" for should/may/preferred
- If the document has no clear requirements, return { "requirements": [] }
- Do NOT invent requirements — only extract what is present in the text`;

/** PDF brand estimation prompt — Gemini visually inspects the PDF. */
const PDF_BRAND_PROMPT = `You are a document typography analysis engine.

Visually inspect this PDF and extract ONLY the brand typography tokens. Return ONLY valid JSON — no markdown fences, no explanation:

{
  "brand": {
    "fontFamily": "<string or null — the exact font name used for body text, e.g. 'Calibri', 'Arial'>",
    "fontSize": <number or null — body text font size in px (1pt = 1.333px)>,
    "lineHeight": <number or null — line spacing multiplier, e.g. 1.0 for single, 1.15, 1.5>,
    "spaceBefore": <number or null — space before paragraphs in pt>,
    "spaceAfter": <number or null — space after paragraphs in pt>,
    "h1Color": "<hex color like #RRGGBB or null>",
    "h2Color": "<hex color like #RRGGBB or null>",
    "bodyColor": "<hex color like #RRGGBB or null>",
    "h1FontSize": <number or null — H1/title font size in px>,
    "h2FontSize": <number or null — H2/section heading font size in px>,
    "h1SpaceBefore": <number or null — space before H1 in pt>,
    "h1SpaceAfter": <number or null — space after H1 in pt>,
    "h2SpaceBefore": <number or null — space before H2 in pt>,
    "h2SpaceAfter": <number or null — space after H2 in pt>
  }
}

Rules:
- Font family: Read the exact font name from the PDF. Do NOT guess — if you cannot determine it, return null.
- Body font size: Measure body/paragraph text size in px (1pt ≈ 1.333px). Common: 11pt=15px, 12pt=16px.
- H1/H2 font sizes: Measure heading sizes in px.
- Colors: Read exact hex color (#RRGGBB) of body text, H1 headings, H2 headings. Black text is #000000 or #1A1A1A.
- Spacing: Estimate space before/after paragraphs and headings in pt. Line height as a multiplier.
- Use null for any field you cannot confidently determine.`;

// ---------------------------------------------------------------------------
// Gemini helpers
// ---------------------------------------------------------------------------

function geminiUrl(apiKey: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

async function callGemini(
    apiKey: string,
    systemPrompt: string,
    contentParts: unknown[],
): Promise<Record<string, unknown>> {
    const res = await fetch(geminiUrl(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: contentParts }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0,
            },
        }),
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error('[import/parse] Gemini API error:', res.status, errText);
        throw new Error(`Gemini API error (${res.status})`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty Gemini response');

    return JSON.parse(rawText);
}

/** Extract requirements from plain text via Gemini. */
async function extractRequirementsWithGemini(
    apiKey: string,
    plainText: string,
): Promise<NormalizedImportPayload['requirements']> {
    if (!plainText.trim()) return [];

    try {
        const parsed = await callGemini(apiKey, REQUIREMENTS_PROMPT, [
            { text: `Extract RFP/tender requirements from this document text.\n\n--- DOCUMENT TEXT ---\n${plainText.slice(0, 50000)}` },
        ]);
        return normalizeRequirements(parsed.requirements);
    } catch (err) {
        console.error('[import/parse] Requirements extraction failed:', err);
        return [];
    }
}

/** Estimate brand typography from a PDF via Gemini visual inspection. */
async function estimatePdfBrand(
    apiKey: string,
    arrayBuffer: ArrayBuffer,
    mimeType: string,
): Promise<NormalizedImportPayload['brand']> {
    try {
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const parsed = await callGemini(apiKey, PDF_BRAND_PROMPT, [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: 'Analyze the typography of this PDF document. Return ONLY the JSON object.' },
        ]);
        return normalizeBrand(parsed.brand);
    } catch (err) {
        console.error('[import/parse] PDF brand estimation failed:', err);
        return emptyBrand();
    }
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

function toNumber(v: unknown): number | null {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') { const n = parseFloat(v); if (isFinite(n)) return n; }
    return null;
}

function emptyBrand(): NormalizedImportPayload['brand'] {
    return {
        fontFamily: null, fontSize: null, lineHeight: null,
        spaceBefore: null, spaceAfter: null,
        h1Color: null, h2Color: null, bodyColor: null,
        h1FontSize: null, h2FontSize: null,
        h1SpaceBefore: null, h1SpaceAfter: null,
        h2SpaceBefore: null, h2SpaceAfter: null,
        h3Color: null, h3FontSize: null,
        h3SpaceBefore: null, h3SpaceAfter: null,
    };
}

function normalizeBrand(raw: unknown): NormalizedImportPayload['brand'] {
    if (!raw || typeof raw !== 'object') return emptyBrand();

    const brand = validateBrand(raw);
    const obj = raw as Record<string, unknown>;

    return {
        fontFamily: brand.fontFamily,
        fontSize: brand.fontSize,
        lineHeight: brand.lineHeight,
        spaceBefore: brand.spaceBefore,
        spaceAfter: brand.spaceAfter,
        h1Color: brand.h1Color,
        h2Color: brand.h2Color,
        bodyColor: brand.bodyColor,
        h1FontSize: toNumber(obj.h1FontSize),
        h2FontSize: toNumber(obj.h2FontSize),
        h1SpaceBefore: toNumber(obj.h1SpaceBefore),
        h1SpaceAfter: toNumber(obj.h1SpaceAfter),
        h2SpaceBefore: toNumber(obj.h2SpaceBefore),
        h2SpaceAfter: toNumber(obj.h2SpaceAfter),
        h3Color: typeof obj.h3Color === 'string' ? obj.h3Color : null,
        h3FontSize: toNumber(obj.h3FontSize),
        h3SpaceBefore: toNumber(obj.h3SpaceBefore),
        h3SpaceAfter: toNumber(obj.h3SpaceAfter),
    };
}

function normalizeRequirements(raw: unknown): NormalizedImportPayload['requirements'] {
    const requirements: NormalizedImportPayload['requirements'] = [];
    if (!Array.isArray(raw)) return requirements;

    for (const item of raw) {
        if (typeof item === 'string' && item.trim()) {
            requirements.push({ text: item.trim() });
        } else if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            const text = (obj.text || obj.description || obj.requirement) as string | undefined;
            if (typeof text === 'string' && text.trim()) {
                requirements.push({
                    id: typeof obj.id === 'string' ? obj.id : undefined,
                    text: text.trim(),
                    section: typeof obj.section === 'string' ? obj.section : null,
                    priority: typeof obj.priority === 'string' ? obj.priority : null,
                });
            }
        }
    }

    return requirements;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        // 1. Validate API keys
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey || geminiKey === 'your_api_key_here') {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY not configured. Add it to Vercel Environment Variables or .env.local' },
                { status: 503 }
            );
        }

        const llamaKey = process.env.LLAMA_CLOUD_API_KEY;
        if (!llamaKey) {
            return NextResponse.json(
                { error: 'LLAMA_CLOUD_API_KEY not configured. Add it to .env.local' },
                { status: 503 }
            );
        }

        // 2. Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // 3. Validate file type
        const fileType = resolveFileType(file);
        if (!fileType) {
            return NextResponse.json(
                { error: 'Unsupported file type. Accepted: PDF, DOCX' },
                { status: 400 }
            );
        }

        // 4. Validate file size
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
                { status: 400 }
            );
        }

        // 5. Read file buffer
        const arrayBuffer = await file.arrayBuffer();

        // 6. Parse document structure with LlamaParse (both DOCX and PDF)
        let document: NormalizedImportPayload['document'];
        let plainText: string;

        try {
            const llamaResult = await parseWithLlama(arrayBuffer, file.name, fileType.mime);
            document = llamaResult.document;
            plainText = llamaResult.plainText;
        } catch (err) {
            console.error('[import/parse] LlamaParse failed:', err);
            return NextResponse.json(
                { error: 'Document parsing failed. Please try again or use a different file.' },
                { status: 502 }
            );
        }

        if (!document || !document.content || document.content.length === 0) {
            return NextResponse.json(
                { error: 'Could not extract content from file. The file may be empty or corrupted.' },
                { status: 400 }
            );
        }

        // 7. Extract brand + margins/pageSize (different per file type)
        // 8. Extract requirements with Gemini
        // Run brand and requirements in parallel for speed

        let brand: NormalizedImportPayload['brand'];
        let margins: NormalizedImportPayload['margins'] = null;
        let pageSize: NormalizedImportPayload['pageSize'] = null;
        let requirements: NormalizedImportPayload['requirements'];

        if (fileType.label === 'DOCX') {
            // DOCX: deterministic brand from styles.xml + Gemini for requirements
            const [docxBrand, reqs] = await Promise.all([
                extractBrandFromDocx(arrayBuffer),
                extractRequirementsWithGemini(geminiKey, plainText),
            ]);

            brand = {
                fontFamily: docxBrand.fontFamily,
                fontSize: docxBrand.fontSize,
                lineHeight: docxBrand.lineHeight,
                spaceBefore: docxBrand.spaceBefore,
                spaceAfter: docxBrand.spaceAfter,
                h1Color: docxBrand.h1Color,
                h2Color: docxBrand.h2Color,
                bodyColor: docxBrand.bodyColor,
                h1FontSize: docxBrand.h1FontSize,
                h2FontSize: docxBrand.h2FontSize,
                h1SpaceBefore: docxBrand.h1SpaceBefore,
                h1SpaceAfter: docxBrand.h1SpaceAfter,
                h2SpaceBefore: docxBrand.h2SpaceBefore,
                h2SpaceAfter: docxBrand.h2SpaceAfter,
                h3Color: docxBrand.h3Color,
                h3FontSize: docxBrand.h3FontSize,
                h3SpaceBefore: docxBrand.h3SpaceBefore,
                h3SpaceAfter: docxBrand.h3SpaceAfter,
            };
            margins = docxBrand.margins;
            pageSize = docxBrand.pageSize;
            requirements = reqs;
        } else {
            // PDF: Gemini for brand estimation + requirements (parallel)
            const [pdfBrand, reqs] = await Promise.all([
                estimatePdfBrand(geminiKey, arrayBuffer, fileType.mime),
                extractRequirementsWithGemini(geminiKey, plainText),
            ]);

            brand = pdfBrand;
            requirements = reqs;
        }

        // 9. Return normalized payload
        const payload: NormalizedImportPayload = {
            brand,
            document,
            requirements,
            margins,
            pageSize,
        };

        return NextResponse.json(payload);
    } catch (err) {
        console.error('[import/parse] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
