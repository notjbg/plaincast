// ─── Forecast Diff Engine ─────────────────────────────────────────
// Paragraph-level comparison between two AFD versions.
//
// DIFF FLOW:
//   oldSections ──► match by key ──► split paragraphs ──► LCS compare
//   newSections ──►                                    ──► diff result
//
// Each section gets: unchanged | changed | added | removed

/**
 * Compute the longest common subsequence table for two arrays.
 * Returns a 2D table where lcs[i][j] is the LCS length of a[0..i-1] and b[0..j-1].
 */
function lcsTable(a, b) {
    const m = a.length;
    const n = b.length;
    // Build (m+1) x (n+1) table
    const table = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                table[i][j] = table[i - 1][j - 1] + 1;
            } else {
                table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
            }
        }
    }
    return table;
}

/**
 * Backtrack through the LCS table to produce a paragraph-level diff.
 * Returns array of { type: 'added'|'removed'|'unchanged', text }.
 */
function lcsDiff(oldParagraphs, newParagraphs) {
    const table = lcsTable(oldParagraphs, newParagraphs);
    const result = [];
    let i = oldParagraphs.length;
    let j = newParagraphs.length;

    // Backtrack from bottom-right to top-left
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && oldParagraphs[i - 1] === newParagraphs[j - 1]) {
            result.push({ type: 'unchanged', text: oldParagraphs[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
            result.push({ type: 'added', text: newParagraphs[j - 1] });
            j--;
        } else {
            result.push({ type: 'removed', text: oldParagraphs[i - 1] });
            i--;
        }
    }

    return result.reverse();
}

/**
 * Split section text into paragraphs (separated by double newlines).
 * Trims whitespace from each paragraph and filters out empty ones.
 */
function splitParagraphs(text) {
    if (!text) return [];
    return text.split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
}

/**
 * Compute a diff between two arrays of { key, text } section objects.
 *
 * @param {Array<{key: string, text: string}>} oldSections - Sections from previous AFD
 * @param {Array<{key: string, text: string}>} newSections - Sections from current AFD
 * @returns {Array<{key: string, status: string, oldText: string, newText: string, changes: Array}>}
 */
export function computeDiff(oldSections, newSections) {
    // Key equivalence: DISCUSSION was previously mapped to "Synopsis"
    // so cached sessionStorage may use the old key name
    const KEY_ALIASES = { 'Synopsis': 'Discussion', 'Discussion': 'Synopsis' };

    // Build lookup maps by key
    const oldMap = new Map();
    for (const s of oldSections) {
        oldMap.set(s.key, s.text);
    }
    const newMap = new Map();
    for (const s of newSections) {
        newMap.set(s.key, s.text);
    }

    // Collect all unique keys in order (new sections first, then any removed old ones)
    const seenKeys = new Set();
    const results = [];

    // Process sections in the order they appear in the new forecast
    for (const s of newSections) {
        seenKeys.add(s.key);
        let oldText = oldMap.get(s.key);
        // Check alias (handles Synopsis↔Discussion rename in cached data)
        const alias = KEY_ALIASES[s.key];
        if (oldText === undefined && alias) {
            oldText = oldMap.get(alias);
            if (oldText !== undefined) seenKeys.add(alias);
        }

        if (oldText === undefined) {
            // Section is new — not present in old forecast
            const newParas = splitParagraphs(s.text);
            results.push({
                key: s.key,
                status: 'added',
                oldText: '',
                newText: s.text,
                changes: newParas.map(p => ({ type: 'added', text: p }))
            });
        } else if (oldText === s.text) {
            // Section is identical
            results.push({
                key: s.key,
                status: 'unchanged',
                oldText: oldText,
                newText: s.text,
                changes: splitParagraphs(s.text).map(p => ({ type: 'unchanged', text: p }))
            });
        } else {
            // Section changed — compute paragraph-level diff
            const oldParas = splitParagraphs(oldText);
            const newParas = splitParagraphs(s.text);
            const changes = lcsDiff(oldParas, newParas);

            results.push({
                key: s.key,
                status: 'changed',
                oldText: oldText,
                newText: s.text,
                changes
            });
        }
    }

    // Process sections that were removed (present in old but not in new)
    for (const s of oldSections) {
        if (!seenKeys.has(s.key)) {
            const oldParas = splitParagraphs(s.text);
            results.push({
                key: s.key,
                status: 'removed',
                oldText: s.text,
                newText: '',
                changes: oldParas.map(p => ({ type: 'removed', text: p }))
            });
        }
    }

    return results;
}

/**
 * Render a single diff result as an HTML string for the "What Changed" view.
 *
 * @param {{key: string, status: string, oldText: string, newText: string, changes: Array}} diffResult
 * @returns {string} HTML string
 */
export function renderDiffHTML(diffResult) {
    if (!diffResult || !diffResult.changes || diffResult.changes.length === 0) {
        return '<p class="diff-unchanged" style="font-style:italic;">No content to compare.</p>';
    }

    const parts = diffResult.changes.map(change => {
        // Escape HTML entities in text
        const escaped = change.text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        switch (change.type) {
            case 'added':
                return `<p class="diff-added">${escaped}</p>`;
            case 'removed':
                return `<p class="diff-removed">${escaped}</p>`;
            case 'unchanged':
            default:
                return `<p class="diff-unchanged">${escaped}</p>`;
        }
    });

    return parts.join('\n');
}
