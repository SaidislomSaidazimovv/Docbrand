import { NextRequest } from 'next/server';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });

    const { messages, proposalText, requirements } = await req.json().catch(() => ({ messages: [], proposalText: '', requirements: [] }));

    const systemPrompt = `You are an AI assistant helping write a winning RFP proposal.

Current proposal text:
${(proposalText || '').slice(0, 20000)}

RFP Requirements:
${JSON.stringify((requirements || []).slice(0, 30))}

Help the user write, improve, and analyze their proposal. Be concise and practical.`;

    const contents = (messages || []).map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }));

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 1024,
            },
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('[chat] Gemini error:', err);
        return Response.json({ error: 'AI error' }, { status: 502 });
    }

    const raw = await response.json().catch(() => ({}));
    const text = raw.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    return Response.json({ message: text });
}
