import { describe, it, expect } from 'bun:test';
import { reorderSections } from './helpers.js';
import { computeDiff } from '../docs/js/diff.js';

// ─── Section reordering ──────────────────────────────────────────

describe('reorderSections', () => {
    const makeSections = (...keys) => keys.map(key => ({ key, text: '' }));

    it('should put Synopsis before Short Term and Long Term', () => {
        const sections = makeSections('Long Term', 'Synopsis', 'Short Term');
        const result = reorderSections(sections, 'LOX', false);
        expect(result.map(s => s.key)).toStrictEqual(['Synopsis', 'Short Term', 'Long Term']);
    });

    it('should put Active Alerts first when alerts exist', () => {
        const sections = makeSections('Synopsis', 'Active Alerts', 'Short Term');
        const result = reorderSections(sections, 'LOX', true);
        expect(result[0].key).toBe('Active Alerts');
    });

    it('should push Active Alerts to end when no alerts', () => {
        const sections = makeSections('Active Alerts', 'Synopsis', 'Short Term');
        const result = reorderSections(sections, 'LOX', false);
        expect(result[result.length - 1].key).toBe('Active Alerts');
    });

    it('should elevate Marine for coastal offices', () => {
        const sections = makeSections('Synopsis', 'Short Term', 'Long Term', 'Marine', 'Aviation');
        const result = reorderSections(sections, 'LOX', false);
        const marineIdx = result.findIndex(s => s.key === 'Marine');
        const aviationIdx = result.findIndex(s => s.key === 'Aviation');
        // Marine should come before Aviation for coastal office
        expect(marineIdx).toBeLessThan(aviationIdx);
    });

    it('should elevate Fire Weather for fire offices', () => {
        const sections = makeSections('Synopsis', 'Short Term', 'Long Term', 'Fire Weather', 'Aviation');
        const result = reorderSections(sections, 'PSR', false);
        const fireIdx = result.findIndex(s => s.key === 'Fire Weather');
        const aviationIdx = result.findIndex(s => s.key === 'Aviation');
        // Fire Weather should come before Aviation for fire office
        expect(fireIdx).toBeLessThan(aviationIdx);
    });

    it('should order Key Messages format: Messages before Discussion', () => {
        const sections = makeSections('Discussion', 'Messages', 'Update', 'Active Alerts', 'Aviation');
        const result = reorderSections(sections, 'LOT', true);
        const keys = result.map(s => s.key);
        expect(keys.indexOf('Active Alerts')).toBeLessThan(keys.indexOf('Messages'));
        expect(keys.indexOf('Messages')).toBeLessThan(keys.indexOf('Discussion'));
        expect(keys.indexOf('Discussion')).toBeLessThan(keys.indexOf('Aviation'));
    });

    it('should order What has changed after Messages', () => {
        const sections = makeSections('Discussion', 'What has changed', 'Messages', 'Active Alerts');
        const result = reorderSections(sections, 'GSP', true);
        const keys = result.map(s => s.key);
        expect(keys.indexOf('Messages')).toBeLessThan(keys.indexOf('What has changed'));
        expect(keys.indexOf('What has changed')).toBeLessThan(keys.indexOf('Discussion'));
    });

    it('should not elevate Marine for inland offices', () => {
        const sections = makeSections('Synopsis', 'Short Term', 'Marine');
        const result = reorderSections(sections, 'BOU', false); // Denver — inland
        const marineIdx = result.findIndex(s => s.key === 'Marine');
        // Marine should stay at end for inland office
        expect(marineIdx).toBe(2);
    });
});

// ─── Diff engine ─────────────────────────────────────────────────

describe('computeDiff', () => {
    it('should detect unchanged sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Same text here.' }];
        const curr = [{ key: 'Synopsis', text: 'Same text here.' }];
        const diffs = computeDiff(prev, curr);
        expect(diffs.length).toBe(1);
        expect(diffs[0].status).toBe('unchanged');
    });

    it('should detect modified sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Old forecast text.' }];
        const curr = [{ key: 'Synopsis', text: 'New forecast text with changes.' }];
        const diffs = computeDiff(prev, curr);
        expect(diffs[0].status).toBe('changed');
    });

    it('should detect added sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Existing.' }];
        const curr = [{ key: 'Synopsis', text: 'Existing.' }, { key: 'Marine', text: 'New marine section.' }];
        const diffs = computeDiff(prev, curr);
        const marine = diffs.find(d => d.key === 'Marine');
        expect(marine).toBeTruthy();
        expect(marine.status).toBe('added');
    });

    it('should match Synopsis↔Discussion as equivalent keys', () => {
        const prev = [{ key: 'Synopsis', text: 'Same discussion text.' }];
        const curr = [{ key: 'Discussion', text: 'Same discussion text.' }];
        const diffs = computeDiff(prev, curr);
        expect(diffs.length).toBe(1);
        expect(diffs[0].status).toBe('unchanged');
    });

    it('should handle empty previous sections', () => {
        const prev = [];
        const curr = [{ key: 'Synopsis', text: 'First forecast.' }];
        const diffs = computeDiff(prev, curr);
        expect(diffs.length).toBe(1);
        expect(diffs[0].status).toBe('added');
    });

    it('should handle empty current sections', () => {
        const prev = [{ key: 'Synopsis', text: 'Old forecast.' }];
        const curr = [];
        const diffs = computeDiff(prev, curr);
        expect(diffs.length).toBe(1);
        expect(diffs[0].status).toBe('removed');
    });
});
