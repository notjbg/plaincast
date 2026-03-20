// Vercel serverless function: AI translation of AFD sections via Claude Haiku
// Uses AI Gateway for model routing, failover, and cost tracking

import { generateText } from 'ai';

// Rate limiting: per-IP sliding window (defense-in-depth alongside gateway limits)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry) {
        rateLimitMap.set(ip, { timestamps: [now] });
        return true;
    }
    entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (entry.timestamps.length >= RATE_LIMIT_MAX) return false;
    entry.timestamps.push(now);
    return true;
}

// Periodically clean up stale rate limit entries
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (entry.timestamps.length === 0) rateLimitMap.delete(ip);
    }
}, 5 * 60 * 1000);

export default async function handler(req, res) {
    // CORS
    const allowedOrigins = ['https://plaincast.live', 'https://www.plaincast.live'];
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // Rate limiting
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { text, section, office } = req.body;
    if (!text || text.length < 20) return res.status(400).json({ error: 'Text too short' });
    if (text.length > 10000) return res.status(400).json({ error: 'Text too long' });

    const systemPrompt = `You are a weather translator. Convert NWS Area Forecast Discussion text into clear, natural plain English that anyone can understand.

Rules:
- Preserve ALL specific details: dates, temperatures, amounts, locations, timing
- Explain WHY weather is happening, not just what (connect cause and effect)
- Bold key info using **markdown**: days of week, temperatures, rainfall amounts, wind speeds, hazard terms
- Expand all NWS abbreviations naturally
- Convert Zulu times to context (e.g., "early morning", "Tuesday afternoon")
- Keep it concise but complete - no filler, no hedging
- Use short paragraphs (2-3 sentences max each)
- If there are hazards or watches/warnings, lead with those
- Don't add information that isn't in the original
- Don't use bullet points - write in natural prose paragraphs
- Section name for context: ${section || 'Unknown'}
- NWS Office: ${office || 'Unknown'}`;

    try {
        const result = await generateText({
            model: 'anthropic/claude-4.5-haiku',
            system: systemPrompt,
            prompt: text,
            maxTokens: 1024,
            abortSignal: AbortSignal.timeout(15000),
        });

        const translation = result.text || '';

        if (!translation) {
            return res.status(502).json({ error: 'Empty translation' });
        }

        // Check for model refusal (safety filter triggered)
        if (result.finishReason === 'content-filter') {
            return res.status(503).json({ error: 'Translation skipped for this section', reason: 'content-filter' });
        }

        return res.status(200).json({ translation, cached: false });
    } catch (err) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
            return res.status(504).json({ error: 'Translation timed out' });
        }
        console.error('Translation error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}
