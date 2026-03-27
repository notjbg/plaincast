import { describe, it, expect } from 'bun:test';
import { buildSystemPrompt, getTranslationCalendarContext } from '../api/translate.js';

describe('translate prompt calendar context', () => {
    it('anchors ambiguous day references to the product issuance month', () => {
        const context = getTranslationCalendarContext('LOX', '2026-03-24T18:25:00+00:00');

        expect(context.timeZone).toBe('America/Los_Angeles');
        expect(context.localDateLabel).toBe('March 24, 2026');
        expect(context.localIssueTime).toMatch(/Tuesday, March 24, 2026.*11:25 AM PDT/);
        expect(context.monthBoundaryExample).toMatch(/"31st and 1st".*March 31.*April 1/i);
    });

    it('handles month-boundary examples that roll into a new year', () => {
        const context = getTranslationCalendarContext('LOX', '2026-12-20T18:25:00+00:00');

        expect(context.monthBoundaryExample).toMatch(/"31st and 1st".*December 31.*January 1/i);
    });

    it('tells the model not to invent months when the source is ambiguous', () => {
        const prompt = buildSystemPrompt({
            section: 'Long Term',
            office: 'LOX',
            issuanceTime: '2026-03-24T18:25:00+00:00',
        });

        expect(prompt).toMatch(/Resolve bare day-of-month references relative to that issuance date/i);
        expect(prompt).toMatch(/keep the original day number instead of inventing a month/i);
        expect(prompt).toMatch(/Never introduce a different month, year, or season than the source supports/i);
    });
});
