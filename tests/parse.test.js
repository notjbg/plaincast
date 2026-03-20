import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSections, extractTakeaway } from './helpers.js';

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

        assert.ok(sections.length >= 3, `Expected at least 3 sections, got ${sections.length}`);

        const keys = sections.map(s => s.key);
        assert.ok(keys.includes('Synopsis'), `Missing Synopsis section; got: ${keys.join(', ')}`);
        assert.ok(keys.includes('Short Term'), `Missing Short Term section; got: ${keys.join(', ')}`);
        assert.ok(keys.includes('Aviation'), `Missing Aviation section; got: ${keys.join(', ')}`);
    });

    it('should extract section body text correctly', () => {
        const { sections } = parseSections(STANDARD_AFD);
        const synopsis = sections.find(s => s.key === 'Synopsis');

        assert.ok(synopsis, 'Synopsis section should exist');
        assert.ok(synopsis.text.includes('High pressure'), 'Synopsis should contain body text');
        assert.ok(synopsis.text.includes('trough'), 'Synopsis should contain second sentence');
    });

    it('should parse AFD with office prefix headers (e.g. .LOX SYNOPSIS...)', () => {
        const { sections } = parseSections(OFFICE_PREFIX_AFD);

        const keys = sections.map(s => s.key);
        assert.ok(keys.includes('Synopsis'), `Should map LOX SYNOPSIS to Synopsis; got: ${keys.join(', ')}`);
        assert.ok(keys.includes('Short Term'), `Should map LOX SHORT TERM to Short Term; got: ${keys.join(', ')}`);
        assert.ok(keys.includes('Active Alerts'), `Should map LOX WATCHES/WARNINGS/ADVISORIES to Active Alerts; got: ${keys.join(', ')}`);
    });

    it('should return empty sections for empty text', () => {
        const { sections, forecaster } = parseSections('');

        assert.equal(sections.length, 0, 'Empty text should produce no sections');
        assert.equal(forecaster, '', 'Empty text should produce no forecaster');
    });

    it('should extract forecaster name from "Forecaster:" line', () => {
        const { forecaster } = parseSections(STANDARD_AFD);
        assert.equal(forecaster, 'Martinez');
    });

    it('should extract FORECASTER name (uppercase variant)', () => {
        const { forecaster } = parseSections(MULTI_SECTION_AFD);
        assert.equal(forecaster, 'Johnson');
    });

    it('should handle $$ delimiters between sections correctly', () => {
        const { sections } = parseSections(STANDARD_AFD);

        // Each section text should NOT contain $$
        for (const s of sections) {
            assert.ok(!s.text.includes('$$'), `Section "${s.key}" should not contain $$ delimiter`);
        }
    });

    it('should handle && markers within sections', () => {
        const { sections } = parseSections(MULTI_SECTION_AFD);

        for (const s of sections) {
            assert.ok(!s.text.match(/^&&$/m), `Section "${s.key}" should not contain standalone && line`);
        }
    });

    it('should parse sections with NEAR TERM mapping to Short Term', () => {
        const afd = `.NEAR TERM (TONIGHT THROUGH TUESDAY)...
Rain moves in overnight with lows in the 40s.

$$`;
        const { sections } = parseSections(afd);
        assert.ok(sections.some(s => s.key === 'Short Term'), 'NEAR TERM should map to Short Term');
    });

    it('should parse DISCUSSION as Synopsis', () => {
        const afd = `.DISCUSSION...An upper-level trough will deepen over the region.

$$`;
        const { sections } = parseSections(afd);
        assert.ok(sections.some(s => s.key === 'Synopsis'), 'DISCUSSION should map to Synopsis');
    });

    it('should parse EXTENDED as Long Term', () => {
        const afd = `.EXTENDED (FRIDAY THROUGH NEXT WEEK)...
Pattern becomes more active by the weekend.

$$`;
        const { sections } = parseSections(afd);
        assert.ok(sections.some(s => s.key === 'Long Term'), 'EXTENDED should map to Long Term');
    });
});

describe('extractTakeaway', () => {
    it('should extract first 1-2 sentences from synopsis', () => {
        const { sections } = parseSections(STANDARD_AFD);
        const takeaway = extractTakeaway(sections);

        assert.ok(takeaway.length > 0, 'Takeaway should not be empty');
        assert.ok(takeaway.includes('High pressure'), 'Takeaway should include first sentence');
    });

    it('should return empty string when no sections exist', () => {
        const takeaway = extractTakeaway([]);
        assert.equal(takeaway, '');
    });

    it('should fall back to first section if no Synopsis exists', () => {
        const sections = [
            { key: 'Short Term', text: 'Warm and dry through Thursday. Cooling Friday.' }
        ];
        const takeaway = extractTakeaway(sections);
        assert.ok(takeaway.includes('Warm and dry'), 'Should use first section as fallback');
    });
});
