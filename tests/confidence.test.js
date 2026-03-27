import { describe, it, expect } from 'bun:test';
import { computeConfidence } from './helpers.js';

describe('computeConfidence', () => {
    it('should return high score for text with "high confidence" and "consistent"', () => {
        const text = 'Models show high confidence in the ridge building. Ensemble guidance is consistent with the operational runs.';
        const result = computeConfidence(text);

        expect(result).not.toBeNull();
        expect(result.score).toBeGreaterThan(70);
        expect(result.label).toBe('High');
    });

    it('should return low score for text with "uncertain", "wide range", "tricky"', () => {
        const text = 'The forecast remains uncertain with a wide range of solutions. This is a tricky pattern to forecast.';
        const result = computeConfidence(text);

        expect(result).not.toBeNull();
        expect(result.score).toBeLessThan(30);
        expect(result.label).toBe('Low');
    });

    it('should return null when no signal phrases are found', () => {
        const text = 'Temperatures will be in the mid 70s with sunny skies and light winds.';
        const result = computeConfidence(text);

        expect(result).toBeNull();
    });

    it('should return mixed score for text with both certain and uncertain signals', () => {
        const text = 'High confidence in the short term forecast. However, the extended remains uncertain with spread in the ensembles.';
        const result = computeConfidence(text);

        expect(result).not.toBeNull();
        // Expected mixed score (20-80)
        expect(result.score).toBeGreaterThanOrEqual(20);
        expect(result.score).toBeLessThanOrEqual(80);
    });

    it('should weight explicit confidence statements higher', () => {
        // "high confidence" (weight 3) vs single "uncertain" (weight 2)
        const text = 'We have high confidence in this forecast. Timing is somewhat uncertain.';
        const result = computeConfidence(text);

        expect(result).not.toBeNull();
        // high confidence = 3, uncertain = 2, total = 5, certainScore = 3, score = 60%
        // Explicit "high confidence" should outweigh single "uncertain"
        expect(result.score).toBeGreaterThanOrEqual(50);
    });

    it('should handle repeated uncertainty phrases', () => {
        const text = 'Low confidence in the extended. Uncertainty remains high. The pattern is uncertain and models disagree. Wide range of outcomes possible.';
        const result = computeConfidence(text);

        expect(result).not.toBeNull();
        // Heavy uncertainty text should score very low
        expect(result.score).toBeLessThan(15);
        expect(result.label).toBe('Low');
    });

    it('should handle repeated certainty phrases', () => {
        const text = 'High confidence in the forecast. Consistent model guidance. Good agreement between the ensembles. Increasing confidence in this outcome.';
        const result = computeConfidence(text);

        expect(result).not.toBeNull();
        // Heavy certainty text should score very high
        expect(result.score).toBeGreaterThan(90);
        expect(result.label).toBe('High');
    });

    it('should be case-insensitive', () => {
        const text = 'HIGH CONFIDENCE in the ridge. CONSISTENT guidance from models.';
        const result = computeConfidence(text);

        // Should match uppercase phrases
        expect(result).not.toBeNull();
        expect(result.score).toBeGreaterThan(70);
    });

    it('should detect "on track" as a certainty signal', () => {
        const text = 'The forecast remains on track for dry weather through midweek.';
        const result = computeConfidence(text);

        // Should detect "on track"
        expect(result).not.toBeNull();
        // "on track" should produce a positive score
        expect(result.score).toBeGreaterThan(50);
    });
});
