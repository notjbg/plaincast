import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OFFICE_NAMES } from '../docs/js/offices.js';
import { renderOfficePage, renderSitemap } from '../scripts/build-offices.mjs';

const DOCS = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const template = readFileSync(join(DOCS, 'index.html'), 'utf8');
const codes = Object.keys(OFFICE_NAMES);

function read(code) {
    try { return readFileSync(join(DOCS, 'o', code, 'index.html'), 'utf8'); } catch (e) { return null; }
}

describe('per-office SEO pages stay in sync with docs/index.html', () => {
    it('every committed office page matches the generator (else run `bun scripts/build-offices.mjs`)', () => {
        const drifted = codes.filter(code => read(code) !== renderOfficePage(template, code, OFFICE_NAMES[code]));
        expect(drifted).toEqual([]);
    });

    it('sitemap.xml matches the generator', () => {
        expect(readFileSync(join(DOCS, 'sitemap.xml'), 'utf8')).toBe(renderSitemap(codes));
    });

    it('each page is self-canonical, de-genericized, and uses absolute asset paths', () => {
        for (const code of codes) {
            const html = read(code);
            expect(html).toContain(`<link rel="canonical" href="https://plaincast.live/o/${code}/">`);
            expect(html).not.toContain('<title>Plaincast - What the forecast actually says</title>');
            expect(html).toContain('href="/styles.css"');
            expect(html).toContain('src="/js/app.js"');
            expect(html).toContain(`href="/api/feed?office=${code}"`);
        }
    });
});
