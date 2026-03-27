// Vercel serverless function: AI translation of AFD sections via Claude Haiku
// Uses AI Gateway for model routing, failover, and cost tracking

import { generateText } from 'ai';
import { OFFICE_TIMEZONES } from '../docs/js/offices.js';

// Translation cache: keyed on hash(text + section + office), 4-hour TTL
// Fluid Compute shares instances across concurrent requests, so this persists
const translationCache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours (NWS issues AFDs ~3-4x daily)
const CACHE_MAX = 500; // max entries to prevent unbounded growth

function cacheKey(text, section, office, issuanceTime) {
    let hash = 0;
    const str = `${text}|${section}|${office}|${issuanceTime || ''}`;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

function getCachedTranslation(text, section, office, issuanceTime) {
    const key = cacheKey(text, section, office, issuanceTime);
    const entry = translationCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.time > CACHE_TTL) {
        translationCache.delete(key);
        return null;
    }
    return entry.translation;
}

function setCachedTranslation(text, section, office, issuanceTime, translation) {
    // Evict oldest entries if at capacity
    if (translationCache.size >= CACHE_MAX) {
        const oldest = translationCache.keys().next().value;
        translationCache.delete(oldest);
    }
    const key = cacheKey(text, section, office, issuanceTime);
    translationCache.set(key, { translation, time: Date.now() });
}

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

// Periodically clean up stale rate limit entries without pinning the event loop
const rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
        if (entry.timestamps.length === 0) rateLimitMap.delete(ip);
    }
}, 5 * 60 * 1000);
rateLimitCleanupTimer.unref?.();

function ordinal(day) {
    const mod100 = day % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
    const mod10 = day % 10;
    if (mod10 === 1) return `${day}st`;
    if (mod10 === 2) return `${day}nd`;
    if (mod10 === 3) return `${day}rd`;
    return `${day}th`;
}

function getSafeIssueDate(issuanceTime) {
    const parsed = issuanceTime ? new Date(issuanceTime) : new Date();
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function getLocalDateParts(issueDate, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).formatToParts(issueDate);

    return {
        year: Number(parts.find(part => part.type === 'year')?.value),
        monthName: parts.find(part => part.type === 'month')?.value || 'January',
        day: Number(parts.find(part => part.type === 'day')?.value),
    };
}

export function getTranslationCalendarContext(office, issuanceTime) {
    const timeZone = OFFICE_TIMEZONES[office] || 'America/Los_Angeles';
    const issueDate = getSafeIssueDate(issuanceTime);
    const localIssueTime = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone,
        timeZoneName: 'short',
    }).format(issueDate);

    const { year, monthName, day } = getLocalDateParts(issueDate, timeZone);
    const monthIndex = new Date(`${monthName} 1, ${year}`).getMonth();
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
    const nextMonthName = new Intl.DateTimeFormat('en-US', { month: 'long' })
        .format(new Date(year, monthIndex + 1, 1));

    return {
        timeZone,
        localIssueTime,
        localDateLabel: `${monthName} ${day}, ${year}`,
        monthBoundaryExample: `If the source says "${ordinal(lastDayOfMonth)} and 1st", that means ${monthName} ${lastDayOfMonth} and ${nextMonthName} 1 for this forecast.`,
    };
}

export function buildSystemPrompt({ section, office, issuanceTime }) {
    const calendarContext = getTranslationCalendarContext(office, issuanceTime);

    return `You are a weather translator. Convert NWS Area Forecast Discussion text into clear, natural plain English that anyone can understand.

Calendar context:
- AFD issuance time in the local office timezone: ${calendarContext.localIssueTime}
- Office timezone: ${calendarContext.timeZone}
- Interpret relative dates from that issuance time: "today", "tonight", "tomorrow", "this weekend", "this month", and "next month"
- Resolve bare day-of-month references relative to that issuance date and forecast window
- ${calendarContext.monthBoundaryExample}
- If a day number is still genuinely ambiguous, keep the original day number instead of inventing a month

Rules:
- Preserve ALL specific details: dates, temperatures, amounts, locations, timing
- Never introduce a different month, year, or season than the source supports
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
- NWS Office: ${office || 'Unknown'}
- Local issue date for calendar references: ${calendarContext.localDateLabel}`;
}

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

    const { text, section, office, issuanceTime } = req.body;
    if (!text || text.length < 20) return res.status(400).json({ error: 'Text too short' });
    if (text.length > 10000) return res.status(400).json({ error: 'Text too long' });

    // Check translation cache first
    const cached = getCachedTranslation(text, section, office, issuanceTime);
    if (cached) {
        return res.status(200).json({ translation: cached, cached: true });
    }

    const systemPrompt = buildSystemPrompt({ section, office, issuanceTime });

    try {
        const result = await generateText({
            model: 'anthropic/claude-haiku-4.5',
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

        // Cache successful translation for future requests
        setCachedTranslation(text, section, office, issuanceTime, translation);

        return res.status(200).json({ translation, cached: false });
    } catch (err) {
        if (err.name === 'AbortError' || err.name === 'TimeoutError') {
            return res.status(504).json({ error: 'Translation timed out' });
        }
        console.error('Translation error:', err);
        return res.status(500).json({ error: 'Internal error' });
    }
}
