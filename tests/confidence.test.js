import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeConfidence } from './helpers.js';

describe('computeConfidence', () => {
    it('should return high score for text with "high confidence" and "consistent"', () => {
        const text = 'Models show high confidence in the ridge building. Ensemble guidance is consistent with the operational runs.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should return a result, not null');
        assert.ok(result.score > 70, `Expected score > 70, got ${result.score}`);
        assert.equal(result.label, 'High');
    });

    it('should return low score for text with "uncertain", "wide range", "tricky"', () => {
        const text = 'The forecast remains uncertain with a wide range of solutions. This is a tricky pattern to forecast.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should return a result, not null');
        assert.ok(result.score < 30, `Expected score < 30, got ${result.score}`);
        assert.equal(result.label, 'Low');
    });

    it('should return null when no signal phrases are found', () => {
        const text = 'Temperatures will be in the mid 70s with sunny skies and light winds.';
        const result = computeConfidence(text);

        assert.equal(result, null, 'Should return null when no confidence signals present');
    });

    it('should return mixed score for text with both certain and uncertain signals', () => {
        const text = 'High confidence in the short term forecast. However, the extended remains uncertain with spread in the ensembles.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should return a result, not null');
        assert.ok(result.score >= 20 && result.score <= 80, `Expected mixed score (20-80), got ${result.score}`);
    });

    it('should weight explicit confidence statements higher', () => {
        // "high confidence" (weight 3) vs single "uncertain" (weight 2)
        const text = 'We have high confidence in this forecast. Timing is somewhat uncertain.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should return a result');
        // high confidence = 3, uncertain = 2, total = 5, certainScore = 3, score = 60%
        assert.ok(result.score >= 50, `Explicit "high confidence" should outweigh single "uncertain"; got ${result.score}`);
    });

    it('should handle repeated uncertainty phrases', () => {
        const text = 'Low confidence in the extended. Uncertainty remains high. The pattern is uncertain and models disagree. Wide range of outcomes possible.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should return a result');
        assert.ok(result.score < 15, `Heavy uncertainty text should score very low, got ${result.score}`);
        assert.equal(result.label, 'Low');
    });

    it('should handle repeated certainty phrases', () => {
        const text = 'High confidence in the forecast. Consistent model guidance. Good agreement between the ensembles. Increasing confidence in this outcome.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should return a result');
        assert.ok(result.score > 90, `Heavy certainty text should score very high, got ${result.score}`);
        assert.equal(result.label, 'High');
    });

    it('should be case-insensitive', () => {
        const text = 'HIGH CONFIDENCE in the ridge. CONSISTENT guidance from models.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should match uppercase phrases');
        assert.ok(result.score > 70, `Should detect uppercase confidence phrases; got ${result.score}`);
    });

    it('should detect "on track" as a certainty signal', () => {
        const text = 'The forecast remains on track for dry weather through midweek.';
        const result = computeConfidence(text);

        assert.ok(result !== null, 'Should detect "on track"');
        assert.ok(result.score > 50, `"on track" should produce a positive score, got ${result.score}`);
    });
});
