/**
 * POST /api/brand-detect
 *
 * Server-only route that calls Gemini 2.5 Flash to extract brand typography
 * tokens from a raw JSON string. The API key never leaves the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateBrand, type BrandTypography } from '@/lib/brand/extractBrandFromJson';

const GEMINI_MODEL = 'gemini-2.5-flash';

const SYSTEM_PROMPT = `You are a brand-compliance extraction engine.
Given a JSON document, extract company typography rules and return ONLY valid JSON matching this exact schema — no markdown, no explanation:

{
  "fontFamily": "<string or null>",
  "fontSize": <number or null>,
  "lineHeight": <number or null>,
  "spaceBefore": <number or null>,
  "spaceAfter": <number or null>,
  "h1Color": "<hex color or null>",
  "h2Color": "<hex color or null>",
  "bodyColor": "<hex color or null>"
}

Rules:
- fontFamily: the primary body/paragraph font (e.g. "Arial", "Times New Roman")
- fontSize: base body font size in px or pt (just the number)
- lineHeight: as a multiplier (e.g. 1.5) or raw value
- spaceBefore/spaceAfter: paragraph spacing in px or pt
- h1Color/h2Color/bodyColor: hex colors only (#RRGGBB)
- Use null for any field you cannot confidently determine
- Do NOT invent values — only extract what is clearly present`;

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === 'your_api_key_here') {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY not configured' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const jsonContent = typeof body?.jsonContent === 'string'
            ? body.jsonContent.slice(0, 20000)
            : '';

        if (!jsonContent) {
            return NextResponse.json(
                { error: 'Missing jsonContent in request body' },
                { status: 400 }
            );
        }

        // Call Gemini REST API (server-side only)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        const geminiResponse = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Extract brand typography from this JSON:\n\n${jsonContent}`,
                    }],
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
            console.error('[brand-detect] Gemini API error:', geminiResponse.status, errText);
            return NextResponse.json(
                { error: 'AI service unavailable' },
                { status: 502 }
            );
        }

        const geminiData = await geminiResponse.json();

        // Extract text from Gemini response
        const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
            return NextResponse.json(
                { error: 'Empty AI response' },
                { status: 502 }
            );
        }

        // Parse and validate
        let parsed: unknown;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            console.error('[brand-detect] Failed to parse Gemini output:', rawText);
            return NextResponse.json(
                { error: 'Invalid AI response format' },
                { status: 502 }
            );
        }

        const validated: BrandTypography = validateBrand(parsed);

        return NextResponse.json(validated);
    } catch (err) {
        console.error('[brand-detect] Unexpected error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
