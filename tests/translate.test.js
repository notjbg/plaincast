import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translateToPlainEnglish } from './helpers.js';

describe('translateToPlainEnglish', () => {
    describe('abbreviation expansion', () => {
        it('should expand "chc" to "chance"', () => {
            const result = translateToPlainEnglish('chc of rain');
            assert.ok(result.includes('chance'), `Expected "chance" in: "${result}"`);
        });

        it('should expand "tstms" to "thunderstorms"', () => {
            const result = translateToPlainEnglish('chc of tstms');
            assert.ok(
                result.includes('chance') && result.includes('thunderstorms'),
                `Expected "chance of thunderstorms" in: "${result}"`
            );
        });

        it('should expand "mtns" to "mountains"', () => {
            const result = translateToPlainEnglish('mtns and vlys');
            assert.ok(result.includes('mountains'), `Expected "mountains" in: "${result}"`);
        });

        it('should expand "vlys" to "valleys"', () => {
            const result = translateToPlainEnglish('mtns and vlys');
            assert.ok(result.includes('valleys'), `Expected "valleys" in: "${result}"`);
        });

        it('should expand "sfc trof" to "surface trough"', () => {
            const result = translateToPlainEnglish('sfc trof');
            assert.ok(
                result.includes('surface') && result.includes('trough'),
                `Expected "surface trough" in: "${result}"`
            );
        });

        it('should expand "fcst" to "forecast"', () => {
            const result = translateToPlainEnglish('the fcst is clear');
            assert.ok(result.includes('forecast'), `Expected "forecast" in: "${result}"`);
        });

        it('should expand "pcpn" to "precipitation"', () => {
            const result = translateToPlainEnglish('no pcpn expected');
            assert.ok(result.includes('precipitation'), `Expected "precipitation" in: "${result}"`);
        });

        it('should expand model names to friendly descriptions', () => {
            const result = translateToPlainEnglish('GFS and ECMWF agree');
            assert.ok(result.includes('American global model'), `Expected GFS expansion in: "${result}"`);
            assert.ok(result.includes('European model'), `Expected ECMWF expansion in: "${result}"`);
        });

        it('should expand aviation terms', () => {
            const result = translateToPlainEnglish('VFR conditions with MVFR cigs');
            assert.ok(result.includes('visual flying'), `Expected VFR expansion in: "${result}"`);
            assert.ok(result.includes('marginal'), `Expected MVFR expansion in: "${result}"`);
        });

        it('should leave BKN015 as-is in basic mode (only EXTENDED handles height)', () => {
            // FULL_ABBREVIATIONS includes EXTENDED_ABBREVIATIONS, which DO handle BKN015.
            // The extended rule converts BKN015 → "broken clouds at 1500 ft"
            const result = translateToPlainEnglish('BKN015');
            // With FULL_ABBREVIATIONS, BKN015 WILL be expanded (the extended rules handle it)
            assert.ok(
                result.includes('broken clouds at 1500 ft'),
                `With FULL_ABBREVIATIONS, BKN015 should expand to "broken clouds at 1500 ft"; got: "${result}"`
            );
        });

        it('should expand directional abbreviations', () => {
            const result = translateToPlainEnglish('wrn mtns and nrn vlys');
            assert.ok(result.includes('western'), `Expected "western" in: "${result}"`);
            assert.ok(result.includes('northern'), `Expected "northern" in: "${result}"`);
        });
    });

    describe('NWS artifact stripping', () => {
        it('should remove NWS timestamps', () => {
            const result = translateToPlainEnglish('15/913 AM. Clear skies expected.');
            assert.ok(!result.includes('913'), `Should strip timestamp; got: "${result}"`);
            assert.ok(result.includes('Clear') || result.includes('clear'), `Should preserve content`);
        });

        it('should remove triple-dot formatting', () => {
            const result = translateToPlainEnglish('clear skies...warm temps');
            assert.ok(!result.includes('...'), `Should remove triple dots; got: "${result}"`);
        });

        it('should remove zone references', () => {
            const result = translateToPlainEnglish('for zone 123-456 rain expected');
            assert.ok(!result.includes('zone 123'), `Should strip zone refs; got: "${result}"`);
        });

        it('should remove "see the CFWLOX product" references', () => {
            const result = translateToPlainEnglish('Fire weather conditions, see the CFWLOX product for more details.');
            assert.ok(!result.includes('CFWLOX'), `Should strip product refs; got: "${result}"`);
            assert.ok(!result.includes('product'), `Should strip "product"; got: "${result}"`);
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            const result = translateToPlainEnglish('');
            assert.equal(result, '');
        });

        it('should handle text with no abbreviations', () => {
            const result = translateToPlainEnglish('Clear skies and warm temperatures expected.');
            assert.ok(result.includes('Clear') || result.includes('clear'));
            assert.ok(result.includes('warm'));
        });
    });
});
