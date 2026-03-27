import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reorderSections } from './helpers.js';
import { computeDiff } from '../docs/js/diff.js';

// ─── Section reordering ──────────────────────────────────────────

describe('reorderSections', () => {
    const makeSections = (...keys) => keys.map(key => ({ key, text: '' }));

    it('should put Synopsis before Short Term and Long Term', () => {
        const sections = makeSections('Long Term', 'Synopsis', 'Short Term');
        const result = reorderSections(sections, 'LOX', false);
        assert.deepEqual(result.map(s => s.key), ['Synopsis', 'Short Term', 'Long Term']);
    });

    it('should put Active Alerts first when alerts exist', () => {
        const sections = makeSections('Synopsis', 'Active Alerts', 'Short Term');
        const result = reorderSections(sections, 'LOX', true);
        assert.equal(result[0].key, 'Active Alerts');
    });

    it('should push Active Alerts to end when no alerts', () => {
        const sections = makeSections('Active Alerts', 'Synopsis', 'Short Term');
        const result = reorderSections(sections, 'LOX', false);
        assert.equal(result[result.length - 1].key, 'Active Alerts');
    });

    it('should elevate Marine for coastal offices', () => {
        const sections = makeSections('Synopsis', 'Short Term', 'Long Term', 'Marine', 'Aviation');
        const result = reorderSections(sections, 'LOX', false);
        const marineIdx = result.findIndex(s => s.key === 'Marine');
        const aviationIdx = result.findIndex(s => s.key === 'Aviation');
        assert.ok(marineIdx < aviationIdx, 'Marine should come before Aviation for coastal office');
    });

    it('should elevate Fire Weather for fire offices', () => {
        const sections = makeSections('Synopsis', 'Short Term', 'Long Term', 'Fire Weather', 'Aviation');
        const result = reorderSections(sections, 'PSR', false);
        const fireIdx = result.findIndex(s => s.key === 'Fire Weather');
        const aviationIdx = result.findIndex(s => s.key === 'Aviation');
        assert.ok(fireIdx < aviationIdx, 'Fire Weather should come before Aviation for fire office');
    });

    it('should not elevate Marine for inland offices', () => {
        const sections = makeSections('Synopsis', 'Short Term', 'Marine');
        const result = reorderSections(sections, 'BOU', false); // Denver — inland
        const marineIdx = result.findIndex(s => s.key === 'Marine');
        assert.equal(marineIdx, 2, 'Marine should stay at end for inland office');
    });
});

// ─── Diff engine ─────────────────────────────────────────────────

describe('computeDiff', () => {
    it('should detect unchanged sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Same text here.' }];
        const curr = [{ key: 'Synopsis', text: 'Same text here.' }];
        const diffs = computeDiff(prev, curr);
        assert.equal(diffs.length, 1);
        assert.equal(diffs[0].status, 'unchanged');
    });

    it('should detect modified sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Old forecast text.' }];
        const curr = [{ key: 'Synopsis', text: 'New forecast text with changes.' }];
        const diffs = computeDiff(prev, curr);
        assert.equal(diffs[0].status, 'changed');
    });

    it('should detect added sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Existing.' }];
        const curr = [{ key: 'Synopsis', text: 'Existing.' }, { key: 'Marine', text: 'New marine section.' }];
        const diffs = computeDiff(prev, curr);
        const marine = diffs.find(d => d.key === 'Marine');
        assert.ok(marine, 'Should have Marine in diff results');
        assert.equal(marine.status, 'added');
    });

    it('should handle empty previous sections', () => {
        const prev = [];
        const curr = [{ key: 'Synopsis', text: 'First forecast.' }];
        const diffs = computeDiff(prev, curr);
        assert.equal(diffs.length, 1);
        assert.equal(diffs[0].status, 'added');
    });

    it('should handle empty current sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Old forecast.' }];
        const curr = [];
        const diffs = computeDiff(prev, curr);
        assert.equal(diffs.length, 1);
        assert.equal(diffs[0].status, 'removed');
    });
});
