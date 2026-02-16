// Vercel serverless function: AI translation of AFD sections via Claude Haiku
// Caches responses in-memory (covers warm instances) + client caches in sessionStorage

const cache = new Map();
const CACHE_TTL = 3600 * 1000; // 1 hour

function hashText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const chr = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash.toString(36);
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { text, section, office } = req.body;
    if (!text || text.length < 20) return res.status(400).json({ error: 'Text too short' });
    if (text.length > 10000) return res.status(400).json({ error: 'Text too long' });

    // Check cache
    const key = hashText(text);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return res.status(200).json({ translation: cached.translation, cached: true });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

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
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-haiku-latest',
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: text }]
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Anthropic API error:', response.status, err);
            return res.status(502).json({ error: 'Translation service error', status: response.status, detail: err.substring(0, 200) });
        }

        const data = await response.json();
        const translation = data.content?.[0]?.text || '';

        if (!translation) {
            return res.status(502).json({ error: 'Empty translation' });
        }

        // Cache it
        cache.set(key, { translation, time: Date.now() });

        // Prune old cache entries if it gets big
        if (cache.size > 500) {
            const now = Date.now();
            for (const [k, v] of cache) {
                if (now - v.time > CACHE_TTL) cache.delete(k);
            }
        }

        return res.status(200).json({ translation, cached: false });
    } catch (err) {
        console.error('Translation error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}
