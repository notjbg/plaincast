import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock the `ai` package before importing the handler. Tests override
// `mockGenerateText` to control behavior per case.
let mockGenerateText = async () => ({ text: 'translated', finishReason: 'stop' });
mock.module('ai', () => ({
    generateText: (...args) => mockGenerateText(...args),
}));

const { default: handler } = await import('../api/translate.js');

function createRes() {
    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        ended: false,
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; this.ended = true; return this; },
        send(data) { this.body = data; this.ended = true; return this; },
        end() { this.ended = true; return this; },
        redirect(code, url) { this.statusCode = code; this.headers.location = url; this.ended = true; return this; },
    };
    return res;
}

let ipCounter = 0;
function uniqueIp() {
    ipCounter += 1;
    return `10.42.${Math.floor(ipCounter / 255)}.${ipCounter % 255}`;
}

function createReq(overrides = {}) {
    return {
        method: 'POST',
        headers: { 'x-forwarded-for': uniqueIp() },
        body: {},
        socket: { remoteAddress: '127.0.0.1' },
        query: {},
        ...overrides,
    };
}

const validBody = () => ({
    text: 'A dry pattern holds through the weekend with highs in the low 80s across the valleys and mountains through Tuesday afternoon.',
    section: 'Synopsis',
    office: 'LOX',
    issuanceTime: '2026-03-24T18:25:00+00:00',
});

describe('POST /api/translate — method & CORS', () => {
    it('returns 405 for GET', async () => {
        const req = createReq({ method: 'GET' });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(405);
    });

    it('returns 200 with no body for OPTIONS preflight', async () => {
        const req = createReq({ method: 'OPTIONS' });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res.ended).toBe(true);
    });

    it('echoes allowed Origin back when matched', async () => {
        mockGenerateText = async () => ({ text: 'ok', finishReason: 'stop' });
        const req = createReq({
            body: validBody(),
            headers: { 'x-forwarded-for': uniqueIp(), origin: 'https://plaincast.live' },
        });
        const res = createRes();
        await handler(req, res);
        expect(res.headers['access-control-allow-origin']).toBe('https://plaincast.live');
    });

    it('does not echo Origin when unmatched', async () => {
        mockGenerateText = async () => ({ text: 'ok', finishReason: 'stop' });
        const req = createReq({
            body: validBody(),
            headers: { 'x-forwarded-for': uniqueIp(), origin: 'https://evil.example' },
        });
        const res = createRes();
        await handler(req, res);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
});

describe('POST /api/translate — body validation', () => {
    beforeEach(() => {
        mockGenerateText = async () => ({ text: 'translated', finishReason: 'stop' });
    });

    it('returns 400 when text is missing', async () => {
        const req = createReq({ body: { section: 'Synopsis', office: 'LOX' } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
    });

    it('returns 400 when text is too short', async () => {
        const req = createReq({ body: { ...validBody(), text: 'short' } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/too short/i);
    });

    it('returns 400 when text is too long', async () => {
        const req = createReq({ body: { ...validBody(), text: 'a'.repeat(10_001) } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/too long/i);
    });

    it('returns 400 for invalid office code', async () => {
        const req = createReq({ body: { ...validBody(), office: 'XXX' } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/office/i);
    });

    it('returns 400 for section exceeding length cap', async () => {
        const req = createReq({ body: { ...validBody(), section: 'x'.repeat(101) } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
    });

    it('returns 400 for non-string issuanceTime', async () => {
        const req = createReq({ body: { ...validBody(), issuanceTime: 12345 } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(400);
    });
});

describe('POST /api/translate — happy path & cache', () => {
    beforeEach(() => {
        mockGenerateText = async () => ({ text: 'sunny and warm through Tuesday', finishReason: 'stop' });
    });

    it('returns 200 with the translation on first call', async () => {
        const body = { ...validBody(), text: validBody().text + ' happy-' + Math.random() };
        const req = createReq({ body });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.translation).toBe('sunny and warm through Tuesday');
        expect(res.body.cached).toBe(false);
    });

    it('returns cached:true on second identical call', async () => {
        const body = validBody();
        body.text += ' unique-cache-test-marker-' + Math.random();

        const first = createRes();
        await handler(createReq({ body }), first);
        expect(first.body.cached).toBe(false);

        // Second call — even if the AI impl changes, the cache should intercept.
        mockGenerateText = async () => { throw new Error('should not be called'); };
        const second = createRes();
        await handler(createReq({ body }), second);
        expect(second.statusCode).toBe(200);
        expect(second.body.cached).toBe(true);
        expect(second.body.translation).toBe('sunny and warm through Tuesday');
    });
});

describe('POST /api/translate — AI failure paths', () => {
    it('returns 503 when the model trips the content filter', async () => {
        mockGenerateText = async () => ({ text: 'redacted', finishReason: 'content-filter' });
        const req = createReq({ body: { ...validBody(), text: validBody().text + ' content-filter-' + Math.random() } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(503);
        expect(res.body.reason).toBe('content-filter');
    });

    it('returns 503 (not 502) when content-filter also empties the text', async () => {
        mockGenerateText = async () => ({ text: '', finishReason: 'content-filter' });
        const req = createReq({ body: { ...validBody(), text: validBody().text + ' cf-empty-' + Math.random() } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(503);
        expect(res.body.reason).toBe('content-filter');
    });

    it('returns 502 when the model returns empty text', async () => {
        mockGenerateText = async () => ({ text: '', finishReason: 'stop' });
        const req = createReq({ body: { ...validBody(), text: validBody().text + ' empty-' + Math.random() } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(502);
    });

    it('returns 504 when the model aborts via AbortError', async () => {
        mockGenerateText = async () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            throw err;
        };
        const req = createReq({ body: { ...validBody(), text: validBody().text + ' abort-' + Math.random() } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(504);
    });

    it('returns 504 when the model times out via TimeoutError', async () => {
        mockGenerateText = async () => {
            const err = new Error('timed out');
            err.name = 'TimeoutError';
            throw err;
        };
        const req = createReq({ body: { ...validBody(), text: validBody().text + ' timeout-' + Math.random() } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(504);
    });

    it('returns 500 on unexpected errors', async () => {
        mockGenerateText = async () => { throw new Error('boom'); };
        const req = createReq({ body: { ...validBody(), text: validBody().text + ' boom-' + Math.random() } });
        const res = createRes();
        await handler(req, res);
        expect(res.statusCode).toBe(500);
    });
});

describe('POST /api/translate — rate limiting', () => {
    it('returns 429 after exceeding the per-IP limit', async () => {
        mockGenerateText = async () => ({ text: 'ok', finishReason: 'stop' });
        const ip = uniqueIp();
        // 30 is the cap; 31st request should 429.
        let lastStatus = 0;
        for (let i = 0; i < 31; i++) {
            const req = createReq({
                body: { ...validBody(), text: validBody().text + ` rl-${i}-${Math.random()}` },
                headers: { 'x-forwarded-for': ip },
            });
            const res = createRes();
            await handler(req, res);
            lastStatus = res.statusCode;
        }
        expect(lastStatus).toBe(429);
    });
});
