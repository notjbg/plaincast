import { describe, it, expect } from 'bun:test';
import { parseSections, extractTakeaway, stripAIArtifacts } from './helpers.js';

// ─── Realistic AFD fixture ──────────────────────────────────────────
const STANDARD_AFD = `.SYNOPSIS...High pressure will maintain dry and warm conditions through midweek.
A trough will bring cooling and a chance of showers by Friday.

$$

.SHORT TERM (TODAY THROUGH THURSDAY)...
Temps will be 5-10 degrees above normal through Wednesday.
Onshore flow increases Thursday.

$$

.AVIATION (06Z TAF THROUGH 06Z FRIDAY)...
VFR conditions expected through the period. Some MVFR possible
late Thursday in marine layer.

Forecaster: Martinez`;

const OFFICE_PREFIX_AFD = `.LOX SYNOPSIS...Offshore flow event will bring warm and dry conditions
through the weekend. Santa Ana winds possible Monday.

$$

.LOX SHORT TERM (SAT THROUGH MON)...
High temps will reach 85-95 in valleys. Elevated fire weather
conditions expected.

$$

.LOX WATCHES/WARNINGS/ADVISORIES...
Red Flag Warning in effect Monday through Tuesday.`;

const MULTI_SECTION_AFD = `.SYNOPSIS...A pattern change is underway.

$$

.SHORT TERM (TODAY THROUGH WEDNESDAY)...
Cooling trend begins.

&&

.LONG TERM (THURSDAY THROUGH MONDAY)...
Active weather pattern with multiple disturbances.

$$

.AVIATION (18Z TAF THROUGH 18Z WEDNESDAY)...
MVFR cigs and vsby in morning fog.

$$

.MARINE...
Small craft advisory winds expected.

FORECASTER: Johnson`;

describe('parseSections', () => {
    it('should parse a standard AFD with multiple sections', () => {
        const { sections, forecaster } = parseSections(STANDARD_AFD);

        // Expected at least 3 sections
        expect(sections.length).toBeGreaterThanOrEqual(3);

        const keys = sections.map(s => s.key);
        // Missing Synopsis section
        expect(keys).toContain('Synopsis');
        // Missing Short Term section
        expect(keys).toContain('Short Term');
        // Missing Aviation section
        expect(keys).toContain('Aviation');
    });

    it('should extract section body text correctly', () => {
        const { sections } = parseSections(STANDARD_AFD);
        const synopsis = sections.find(s => s.key === 'Synopsis');

        // Synopsis section should exist
        expect(synopsis).toBeTruthy();
        // Synopsis should contain body text
        expect(synopsis.text).toContain('High pressure');
        // Synopsis should contain second sentence
        expect(synopsis.text).toContain('trough');
    });

    it('should parse AFD with office prefix headers (e.g. .LOX SYNOPSIS...)', () => {
        const { sections } = parseSections(OFFICE_PREFIX_AFD);

        const keys = sections.map(s => s.key);
        // Should map LOX SYNOPSIS to Synopsis
        expect(keys).toContain('Synopsis');
        // Should map LOX SHORT TERM to Short Term
        expect(keys).toContain('Short Term');
        // Should map LOX WATCHES/WARNINGS/ADVISORIES to Active Alerts
        expect(keys).toContain('Active Alerts');
    });

    it('should return empty sections for empty text', () => {
        const { sections, forecaster } = parseSections('');

        expect(sections.length).toBe(0);
        expect(forecaster).toBe('');
    });

    it('should extract forecaster name from "Forecaster:" line', () => {
        const { forecaster } = parseSections(STANDARD_AFD);
        expect(forecaster).toBe('Martinez');
    });

    it('should extract FORECASTER name (uppercase variant)', () => {
        const { forecaster } = parseSections(MULTI_SECTION_AFD);
        expect(forecaster).toBe('Johnson');
    });

    it('should handle $$ delimiters between sections correctly', () => {
        const { sections } = parseSections(STANDARD_AFD);

        // Each section text should NOT contain $$
        for (const s of sections) {
            expect(s.text).not.toContain('$$');
        }
    });

    it('should handle && markers within sections', () => {
        const { sections } = parseSections(MULTI_SECTION_AFD);

        for (const s of sections) {
            // Section should not contain standalone && line
            expect(s.text.match(/^&&$/m)).toBeNull();
        }
    });

    it('should parse sections with NEAR TERM mapping to Short Term', () => {
        const afd = `.NEAR TERM (TONIGHT THROUGH TUESDAY)...
Rain moves in overnight with lows in the 40s.

$$`;
        const { sections } = parseSections(afd);
        expect(sections.some(s => s.key === 'Short Term')).toBe(true);
    });

    it('should parse DISCUSSION as Synopsis', () => {
        const afd = `.DISCUSSION...An upper-level trough will deepen over the region.

$$`;
        const { sections } = parseSections(afd);
        expect(sections.some(s => s.key === 'Synopsis')).toBe(true);
    });

    it('should parse EXTENDED as Long Term', () => {
        const afd = `.EXTENDED (FRIDAY THROUGH NEXT WEEK)...
Pattern becomes more active by the weekend.

$$`;
        const { sections } = parseSections(afd);
        expect(sections.some(s => s.key === 'Long Term')).toBe(true);
    });
});

// ─── Jan 2026 Key Messages format (real GSP structure) ──────────────
const KEY_MESSAGES_AFD = `.WHAT HAS CHANGED...
Adjusted tonight's forecast based on latest trends.

&&

.KEY MESSAGES...
1. Well above normal and humid with isolated showers possible through Saturday.
2. Cold front Sunday will bring best chance for rainfall.

&&

.DISCUSSION...
Bermuda high lingers over the region through Saturday.

&&

.AVIATION /00Z SATURDAY THROUGH WEDNESDAY/...
VFR conditions expected through the period.

&&

.GSP WATCHES/WARNINGS/ADVISORIES...
None.

&&

$$`;

describe('parseSections — Jan 2026 Key Messages format', () => {
    it('should parse .KEY MESSAGES... as Messages section', () => {
        const { sections } = parseSections(KEY_MESSAGES_AFD);
        expect(sections.some(s => s.key === 'Messages')).toBe(true);
    });

    it('should parse .WHAT HAS CHANGED... section', () => {
        const { sections } = parseSections(KEY_MESSAGES_AFD);
        expect(sections.some(s => s.key === 'What has changed')).toBe(true);
    });

    it('should parse .DISCUSSION... as Synopsis', () => {
        const { sections } = parseSections(KEY_MESSAGES_AFD);
        expect(sections.some(s => s.key === 'Synopsis')).toBe(true);
        const syn = sections.find(s => s.key === 'Synopsis');
        expect(syn.text).toContain('Bermuda high');
    });

    it('should parse .MESSAGES... as Messages section', () => {
        const afd = `.MESSAGES...
Heavy snow expected above 5000 ft.

$$`;
        const { sections } = parseSections(afd);
        expect(sections.some(s => s.key === 'Messages')).toBe(true);
    });
});

describe('extractTakeaway', () => {
    it('should extract first 1-2 sentences from synopsis', () => {
        const { sections } = parseSections(STANDARD_AFD);
        const takeaway = extractTakeaway(sections);

        expect(takeaway.length).toBeGreaterThan(0);
        expect(takeaway).toContain('High pressure');
    });

    it('should return empty string when no sections exist', () => {
        const takeaway = extractTakeaway([]);
        expect(takeaway).toBe('');
    });

    it('should fall back to first section if no Synopsis exists', () => {
        const sections = [
            { key: 'Short Term', text: 'Warm and dry through Thursday. Cooling Friday.' }
        ];
        const takeaway = extractTakeaway(sections);
        expect(takeaway).toContain('Warm and dry');
    });

    it('should prefer Messages section over Synopsis for takeaway', () => {
        const { sections } = parseSections(KEY_MESSAGES_AFD);
        const takeaway = extractTakeaway(sections);
        expect(takeaway).toContain('above normal');
        expect(takeaway).not.toContain('Bermuda high');
    });

    it('should strip "Issued at..." timestamp from Synopsis fallback', () => {
        const sections = [
            { key: 'Synopsis', text: 'Issued at 225 PM CDT Fri Apr 3 2026\nPrimary concern is heavy rain. Cold front approaching.' }
        ];
        const takeaway = extractTakeaway(sections);
        expect(takeaway).not.toContain('Issued at');
        expect(takeaway).toContain('Primary concern');
    });
});

describe('parseSections — bare forecaster name', () => {
    it('should strip bare forecaster name at end of section', () => {
        const afd = `.UPDATE...\nHeavy rain expected tonight.\n\nDoom\n\n&&\n\n$$`;
        const { sections, forecaster } = parseSections(afd);
        expect(sections[0].text).not.toContain('Doom');
        expect(forecaster).toBe('Doom');
    });

    it('should not strip long lines that look like content', () => {
        const afd = `.UPDATE...\nDoom and gloom forecast for the weekend ahead.\n\n$$`;
        const { sections } = parseSections(afd);
        expect(sections[0].text).toContain('Doom and gloom');
    });
});

describe('extractTakeaway + stripAIArtifacts', () => {
    it('should strip KEY Message prefix from takeaway output', () => {
        const sections = [
            { key: 'Synopsis', text: 'KEY Message 1. A warm front is advancing north. Showers likely tonight.' }
        ];
        const takeaway = extractTakeaway(sections);
        const stripped = stripAIArtifacts(takeaway);
        expect(stripped).not.toContain('KEY Message');
        expect(stripped).toContain('warm front');
    });
});
