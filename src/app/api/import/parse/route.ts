/**
 * POST /api/import/parse
 *
 * Server-only route that accepts a PDF/DOCX file via multipart form-data,
 * sends the content to Gemini for AI parsing, and returns a normalized JSON
 * payload (brand + document + requirements).
 *
 * Security: API key never leaves the server. Client calls only this endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import { validateBrand } from '@/lib/brand/extractBrandFromJson';
import { extractBrandFromDocx } from '@/lib/brand/extractBrandFromDocx';
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
// Gemini prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a document parsing and brand compliance engine for government tender proposals.

Given a document file, extract THREE things and return ONLY valid JSON — no markdown fences, no explanation:

{
  "brand": {
    "fontFamily": "<string or null — the exact font name used for body text, e.g. 'Calibri', 'Arial', 'Cambria'>",
    "fontSize": <number or null — body text font size in px (1pt = 1.333px)>,
    "lineHeight": <number or null — line spacing multiplier, e.g. 1.0 for single, 1.15, 1.5>,
    "spaceBefore": <number or null — space before paragraphs/headings in pt>,
    "spaceAfter": <number or null — space after paragraphs/headings in pt>,
    "h1Color": "<hex color like #RRGGBB or null>",
    "h2Color": "<hex color like #RRGGBB or null>",
    "bodyColor": "<hex color like #RRGGBB or null>",
    "h1FontSize": <number or null — H1/title font size in px>,
    "h2FontSize": <number or null — H2/section heading font size in px>
  },
  "document": {
    "type": "doc",
    "content": [
      // TipTap/ProseMirror node array. Use these node types:
      // - {"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"..."}]}
      // - {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"..."}]}
      // - {"type":"paragraph","content":[{"type":"text","text":"..."}]}
      // - {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}]}
      // - {"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"..."}]}]}]}
      // Preserve document structure: headings, paragraphs, lists.
      // For bold text use marks: [{"type":"bold"}]
      // For italic text use marks: [{"type":"italic"}]
    ]
  },
  "requirements": [
    // Extract RFP/tender requirements — sentences containing "shall", "must", "required", "mandatory", etc.
    // Each: { "id": "req-1", "text": "full requirement text", "section": "section name or null", "priority": "mandatory" or "desired" }
    // If the document has no clear requirements, return an empty array [].
  ]
}

Rules:
- Preserve ALL document text content — do not summarize or skip paragraphs
- Maintain heading hierarchy (H1 for major sections, H2 for subsections)
- Extract brand typography if visible in the document formatting
- Use null for any brand field you cannot confidently determine
- Do NOT invent content — only extract what is present`;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
    try {
        // 1. Validate API key
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_api_key_here') {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY not configured. Add it to Vercel Environment Variables or .env.local' },
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
                { error: `Unsupported file type. Accepted: PDF, DOCX` },
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

        // 5. Read file and prepare content for Gemini
        const arrayBuffer = await file.arrayBuffer();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        // Build Gemini request parts — branch by file type:
        // PDF: send as inline_data (Gemini supports natively)
        // DOCX: pre-extract text via mammoth, send as plain text
        // Brand extracted from DOCX styles.xml (set only for DOCX files)
        let docxBrandResult: Awaited<ReturnType<typeof extractBrandFromDocx>> | null = null;
        let contentParts: unknown[];

        if (fileType.label === 'PDF') {
            // PDF — Gemini supports inline_data for application/pdf
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            contentParts = [
                {
                    inline_data: {
                        mime_type: fileType.mime,
                        data: base64,
                    },
                },
                {
                    text: `Parse this PDF document carefully. You MUST extract all three sections: brand, document, and requirements.

BRAND EXTRACTION — CRITICAL:
Visually inspect the PDF and identify the ACTUAL typography used:
1. Font family: Read the exact font name from the PDF (e.g. "Calibri", "Arial", "Helvetica", "Cambria"). Do NOT guess — if you cannot determine it, return null. Never default to "Times New Roman" unless you can confirm it.
2. Body font size: Measure the body/paragraph text size in px (1pt ≈ 1.333px). Common sizes: 11pt=15px, 12pt=16px, 14pt=19px.
3. H1 font size: Measure the largest heading/title size in px.
4. H2 font size: Measure the section heading size in px.
5. Colors: Read the exact hex color (#RRGGBB) of body text, H1 headings, and H2 headings. Black text is #000000 or #1A1A1A. Look for colored headings.
6. Spacing: Estimate space before/after paragraphs in pt, and line height as a multiplier (1.0=single, 1.15, 1.5=1.5x).

Return ONLY the JSON object.`,
                },
            ];
        } else if (fileType.label === 'DOCX') {
            // DOCX — Gemini does NOT support DOCX inline_data
            // 1. Extract HTML with mammoth (preserves headings, bold, italic, lists)
            // 2. Extract brand tokens from styles.xml (font, size, colors)
            const buffer = Buffer.from(arrayBuffer);
            const [mammothResult, docxBrand] = await Promise.all([
                mammoth.convertToHtml({ buffer }),
                extractBrandFromDocx(arrayBuffer),
            ]);
            const extractedHtml = mammothResult.value;

            if (!extractedHtml || extractedHtml.trim().length === 0) {
                return NextResponse.json(
                    { error: 'Could not extract text from DOCX file. The file may be empty or corrupted.' },
                    { status: 400 }
                );
            }

            // Build brand hint for Gemini prompt so it knows the source typography
            const brandHints: string[] = [];
            if (docxBrand.fontFamily) brandHints.push(`Font: ${docxBrand.fontFamily}`);
            if (docxBrand.fontSize) brandHints.push(`Size: ${docxBrand.fontSize}px`);
            if (docxBrand.h1Color) brandHints.push(`H1 color: ${docxBrand.h1Color}`);
            if (docxBrand.h2Color) brandHints.push(`H2 color: ${docxBrand.h2Color}`);
            if (docxBrand.bodyColor) brandHints.push(`Body color: ${docxBrand.bodyColor}`);
            const brandContext = brandHints.length > 0
                ? `\n\nBrand typography detected from DOCX styles.xml:\n${brandHints.join('\n')}\nUse these values in the "brand" section of your response.`
                : '';

            // Store docxBrand on the request context for merging into the response later
            docxBrandResult = docxBrand;

            contentParts = [
                {
                    text: `Parse this DOCX document HTML. The HTML preserves headings (<h1>, <h2>), bold (<strong>), italic (<em>), and lists (<ul>, <ol>). Convert it into a TipTap JSON tree, extract any RFP/tender requirements, and brand typography tokens. Return ONLY the JSON object.${brandContext}\n\n--- DOCUMENT HTML ---\n${extractedHtml.slice(0, 50000)}`,
                },
            ];
        } else {
            return NextResponse.json(
                { error: `Unsupported file type. Accepted: PDF, DOCX` },
                { status: 415 }
            );
        }

        // 6. Call Gemini with prepared content
        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: contentParts,
                }],
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }],
                },
                generationConfig: {
                    responseMimeType: 'application/json',
                    temperature: 0,
                },
            }),
        });

        if (!geminiResponse.ok) {
            const errText = await geminiResponse.text();
            console.error('[import/parse] Gemini API error:', geminiResponse.status, errText);
            return NextResponse.json(
                { error: 'AI service unavailable. Please try again.' },
                { status: 502 }
            );
        }

        const geminiData = await geminiResponse.json();

        // 7. Extract response text
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
            return NextResponse.json(
                { error: 'Empty AI response' },
                { status: 502 }
            );
        }

        // 8. Parse JSON
        let parsed: Record<string, unknown>;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            console.error('[import/parse] Failed to parse Gemini output:', rawText.slice(0, 500));
            return NextResponse.json(
                { error: 'AI returned invalid JSON. Please try again.' },
                { status: 502 }
            );
        }

        // 9. Validate and normalize the payload
        const payload = normalizePayload(parsed);

        // 10. For DOCX: merge deterministic brand from styles.xml (overrides AI guesses)
        if (docxBrandResult) {
            if (docxBrandResult.fontFamily) payload.brand.fontFamily = docxBrandResult.fontFamily;
            if (docxBrandResult.fontSize !== null) payload.brand.fontSize = docxBrandResult.fontSize;
            if (docxBrandResult.lineHeight !== null) payload.brand.lineHeight = docxBrandResult.lineHeight;
            if (docxBrandResult.spaceBefore !== null) payload.brand.spaceBefore = docxBrandResult.spaceBefore;
            if (docxBrandResult.spaceAfter !== null) payload.brand.spaceAfter = docxBrandResult.spaceAfter;
            if (docxBrandResult.h1FontSize !== null) payload.brand.h1FontSize = docxBrandResult.h1FontSize;
            if (docxBrandResult.h2FontSize !== null) payload.brand.h2FontSize = docxBrandResult.h2FontSize;
            if (docxBrandResult.h1Color) payload.brand.h1Color = docxBrandResult.h1Color;
            if (docxBrandResult.h2Color) payload.brand.h2Color = docxBrandResult.h2Color;
            if (docxBrandResult.bodyColor) payload.brand.bodyColor = docxBrandResult.bodyColor;
        }

        return NextResponse.json(payload);
    } catch (err) {
        console.error('[import/parse] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// ---------------------------------------------------------------------------
// Validation / normalization
// ---------------------------------------------------------------------------

/**
 * Coerce whatever Gemini returned for "document" into { type: "doc", content: [...] }.
 * Handles: proper doc node, missing type wrapper, bare content array, plain string.
 */
function coerceServerDoc(raw: unknown): NormalizedImportPayload['document'] {
    if (!raw) return null;

    if (typeof raw === 'object' && !Array.isArray(raw)) {
        const obj = raw as Record<string, unknown>;

        // { type: "doc", content: [...] }
        if (obj.type === 'doc' && Array.isArray(obj.content) && obj.content.length > 0) {
            return { type: 'doc', content: obj.content };
        }

        // { content: [...] } without type — AI sometimes omits "type":"doc"
        if (Array.isArray(obj.content) && obj.content.length > 0) {
            return { type: 'doc', content: obj.content };
        }
    }

    // Bare array of nodes
    if (Array.isArray(raw) && raw.length > 0) {
        return { type: 'doc', content: raw };
    }

    // Plain text string — wrap into paragraphs
    if (typeof raw === 'string' && raw.trim().length > 0) {
        const paragraphs = raw.split(/\n\s*\n/).filter((p: string) => p.trim());
        return {
            type: 'doc',
            content: paragraphs.map((p: string) => ({
                type: 'paragraph',
                content: [{ type: 'text', text: p.trim() }],
            })),
        };
    }

    return null;
}

function toNumber(v: unknown): number | null {
    if (typeof v === 'number' && isFinite(v)) return v;
    if (typeof v === 'string') { const n = parseFloat(v); if (isFinite(n)) return n; }
    return null;
}

function normalizePayload(raw: Record<string, unknown>): NormalizedImportPayload {
    // Brand
    const rawBrand = (raw.brand && typeof raw.brand === 'object')
        ? (raw.brand as Record<string, unknown>).typography || raw.brand
        : raw.brand;
    const brand = validateBrand(rawBrand);
    // h1FontSize / h2FontSize are not in BrandTypography — extract from raw brand directly
    const rawBrandObj = (rawBrand && typeof rawBrand === 'object') ? rawBrand as Record<string, unknown> : {};
    const h1FontSize = toNumber(rawBrandObj.h1FontSize);
    const h2FontSize = toNumber(rawBrandObj.h2FontSize);

    // Document — handle multiple shapes Gemini may return
    const document = coerceServerDoc(raw.document);

    // Requirements
    const requirements: NormalizedImportPayload['requirements'] = [];
    const rawReqs = raw.requirements;
    if (Array.isArray(rawReqs)) {
        for (const item of rawReqs) {
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
    }

    return {
        brand: {
            fontFamily: brand.fontFamily,
            fontSize: brand.fontSize,
            lineHeight: brand.lineHeight,
            spaceBefore: brand.spaceBefore,
            spaceAfter: brand.spaceAfter,
            h1Color: brand.h1Color,
            h2Color: brand.h2Color,
            bodyColor: brand.bodyColor,
            h1FontSize,
            h2FontSize,
        },
        document,
        requirements,
    };
}

