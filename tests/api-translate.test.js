import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, getTranslationCalendarContext } from '../api/translate.js';

describe('translate prompt calendar context', () => {
    it('anchors ambiguous day references to the product issuance month', () => {
        const context = getTranslationCalendarContext('LOX', '2026-03-24T18:25:00+00:00');

        assert.equal(context.timeZone, 'America/Los_Angeles');
        assert.equal(context.localDateLabel, 'March 24, 2026');
        assert.match(context.localIssueTime, /Tuesday, March 24, 2026.*11:25 AM PDT/);
        assert.match(context.monthBoundaryExample, /"31st and 1st".*March 31.*April 1/i);
    });

    it('handles month-boundary examples that roll into a new year', () => {
        const context = getTranslationCalendarContext('LOX', '2026-12-20T18:25:00+00:00');

        assert.match(context.monthBoundaryExample, /"31st and 1st".*December 31.*January 1/i);
    });

    it('tells the model not to invent months when the source is ambiguous', () => {
        const prompt = buildSystemPrompt({
            section: 'Long Term',
            office: 'LOX',
            issuanceTime: '2026-03-24T18:25:00+00:00',
        });

        assert.match(prompt, /Resolve bare day-of-month references relative to that issuance date/i);
        assert.match(prompt, /keep the original day number instead of inventing a month/i);
        assert.match(prompt, /Never introduce a different month, year, or season than the source supports/i);
    });
});
