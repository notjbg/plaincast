import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FULL_ABBREVIATIONS } from '../docs/js/abbreviations.js';
import { GLOSSARY, GLOSSARY_COMPILED } from '../docs/js/glossary.js';
import { OFFICE_TIMEZONES } from '../docs/js/offices.js';

function loadProductionFormatters() {
    const source = readFileSync('docs/js/app.js', 'utf8');
    const start = source.indexOf('function escapeHTML');
    const end = source.indexOf('// ─── AI Translation');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error('Could not locate formatter source in docs/js/app.js');
    }

    const context = {
        console,
        Date,
        Intl,
        GLOSSARY,
        GLOSSARY_COMPILED,
        FULL_ABBREVIATIONS,
        OFFICE_TIMEZONES,
        document: { addEventListener() {} },
        module: { exports: {} },
    };
    vm.createContext(context);
    vm.runInContext(`
        let currentOffice = 'LOX';
        ${source.slice(start, end)}
        module.exports = { translateToPlainEnglish, formatAlerts };
    `, context);
    return context.module.exports;
}

describe('production forecast formatters', () => {
    it('escapes raw HTML in the production plain-English renderer', () => {
        const { translateToPlainEnglish } = loadProductionFormatters();
        const html = translateToPlainEnglish('Rain likely <script>alert("x")</script> on Tuesday.');

        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
        expect(html).toContain('<strong>Tuesday</strong>');
    });

    it('escapes alert text before rendering alert HTML', () => {
        const { formatAlerts } = loadProductionFormatters();
        const html = formatAlerts('Small Craft Advisory <img src=x onerror=alert(1)> in effect.', {});

        expect(html).toContain('&lt;img');
        expect(html).not.toContain('<img');
        expect(html).toContain('Small Craft Advisory');
    });
});
