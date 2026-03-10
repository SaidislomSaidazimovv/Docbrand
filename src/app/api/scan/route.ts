import { NextRequest } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });

    const { proposalText, requirements } = await req.json().catch(() => ({ proposalText: '', requirements: [] }));

    const prompt = `Analyze this proposal against the RFP requirements and return ONLY valid JSON, no markdown:

{
  "score": number (0-100),
  "rfp_coverage": [
    { "id": "req-id", "covered": true or false, "reason": "short reason" }
  ],
  "quality_issues": [
    { "type": "success" or "warning" or "error", "message": "description" }
  ]
}

Scoring rules:
- Start at 100
- Each uncovered mandatory requirement: -15
- Each uncovered desired requirement: -5
- Each quality error issue: -10
- Each quality warning issue: -3
- Final score minimum is 0, never negative

RFP Coverage rules:
- covered: true only if proposal clearly addresses the requirement
- covered: false if missing or only vaguely mentioned

Quality issue rules:
- Phone number found → error: "Phone number detected - remove before submission"
- http:// URL found → error: "Insecure URL detected - use https://"
- Words like guarantee/100%/never fails found → warning: "Unverified claim - add evidence"
- Executive summary present → success / missing → error
- Technical approach present → success / missing → warning

RFP Requirements:
${JSON.stringify(requirements)}

Proposal Text:
${(proposalText || '').slice(0, 40000)}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: 'You are a proposal quality analyzer. Return ONLY valid JSON.' }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0,
                maxOutputTokens: 8192,
            },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('[scan] Gemini error:', err);
        return Response.json({ error: 'Gemini API error' }, { status: 502 });
    }

    const raw = await response.json().catch(() => ({}));
    console.log('[scan] Gemini status:', response.status);
    console.log('[scan] Gemini raw:', JSON.stringify(raw).slice(0, 500));
    const text = raw.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    try {
        return Response.json(JSON.parse(text));
    } catch {
        return Response.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }
}
