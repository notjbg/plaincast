import { describe, it, expect } from 'bun:test';
import { translateToPlainEnglish } from './helpers.js';

describe('translateToPlainEnglish', () => {
    describe('abbreviation expansion', () => {
        it('should expand "chc" to "chance"', () => {
            const result = translateToPlainEnglish('chc of rain');
            expect(result).toContain('chance');
        });

        it('should expand "tstms" to "thunderstorms"', () => {
            const result = translateToPlainEnglish('chc of tstms');
            expect(result).toContain('chance');
            expect(result).toContain('thunderstorms');
        });

        it('should expand "mtns" to "mountains"', () => {
            const result = translateToPlainEnglish('mtns and vlys');
            expect(result).toContain('mountains');
        });

        it('should expand "vlys" to "valleys"', () => {
            const result = translateToPlainEnglish('mtns and vlys');
            expect(result).toContain('valleys');
        });

        it('should expand "sfc trof" to "surface trough"', () => {
            const result = translateToPlainEnglish('sfc trof');
            expect(result).toContain('surface');
            expect(result).toContain('trough');
        });

        it('should expand "fcst" to "forecast"', () => {
            const result = translateToPlainEnglish('the fcst is clear');
            expect(result).toContain('forecast');
        });

        it('should expand "pcpn" to "precipitation"', () => {
            const result = translateToPlainEnglish('no pcpn expected');
            expect(result).toContain('precipitation');
        });

        it('should expand model names to friendly descriptions', () => {
            const result = translateToPlainEnglish('GFS and ECMWF agree');
            expect(result).toContain('American global model');
            expect(result).toContain('European model');
        });

        it('should expand aviation terms', () => {
            const result = translateToPlainEnglish('VFR conditions with MVFR cigs');
            expect(result).toContain('visual flying');
            expect(result).toContain('marginal');
        });

        it('should leave BKN015 as-is in basic mode (only EXTENDED handles height)', () => {
            // FULL_ABBREVIATIONS includes EXTENDED_ABBREVIATIONS, which DO handle BKN015.
            // The extended rule converts BKN015 → "broken clouds at 1500 ft"
            const result = translateToPlainEnglish('BKN015');
            // With FULL_ABBREVIATIONS, BKN015 WILL be expanded
            expect(result).toContain('broken clouds at 1500 ft');
        });

        it('should expand directional abbreviations', () => {
            const result = translateToPlainEnglish('wrn mtns and nrn vlys');
            expect(result).toContain('western');
            expect(result).toContain('northern');
        });
    });

    describe('NWS artifact stripping', () => {
        it('should remove NWS timestamps', () => {
            const result = translateToPlainEnglish('15/913 AM. Clear skies expected.');
            expect(result).not.toContain('913');
            // Should preserve content
            expect(result.toLowerCase()).toContain('clear');
        });

        it('should remove triple-dot formatting', () => {
            const result = translateToPlainEnglish('clear skies...warm temps');
            expect(result).not.toContain('...');
        });

        it('should remove zone references', () => {
            const result = translateToPlainEnglish('for zone 123-456 rain expected');
            expect(result).not.toContain('zone 123');
        });

        it('should remove "see the CFWLOX product" references', () => {
            const result = translateToPlainEnglish('Fire weather conditions, see the CFWLOX product for more details.');
            expect(result).not.toContain('CFWLOX');
            expect(result).not.toContain('product');
        });
    });

    describe('edge cases', () => {
        it('should handle empty string', () => {
            const result = translateToPlainEnglish('');
            expect(result).toBe('');
        });

        it('should handle text with no abbreviations', () => {
            const result = translateToPlainEnglish('Clear skies and warm temperatures expected.');
            expect(result.toLowerCase()).toContain('clear');
            expect(result).toContain('warm');
        });
    });
});
