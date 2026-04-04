// ─── Test helpers: pure-function extractions from docs/js/app.js ────
// These replicate the logic without requiring a DOM environment.

import { SECTION_NAMES } from '../docs/js/offices.js';
import { GLOSSARY } from '../docs/js/glossary.js';
import { FULL_ABBREVIATIONS } from '../docs/js/abbreviations.js';

// ─── stripAIArtifacts ────────────────────────────────────────────────
// Strips markdown headers, horizontal rules, backticks, and NWS "KEY Message" prefixes.
export function stripAIArtifacts(text) {
    if (!text) return '';
    let t = text;
    t = t.replace(/^#{1,3}\s+.*$/gm, '');
    t = t.replace(/^---+\s*$/gm, '');
    t = t.replace(/^`{3}[^\n]*$/gm, '');
    t = t.replace(/`{1,3}([^`\n]*)`{1,3}/g, '$1');
    t = t.replace(/^\s*(?:[Kk][Ee][Yy]\s+)?[Mm]essage\s+\d+[.:]\s*/gm, '');
    t = t.replace(/\n{3,}/g, '\n\n');
    return t.trim();
}

// ─── parseSections ──────────────────────────────────────────────────
// Copied from docs/js/app.js — pure function, no DOM dependency.
export function parseSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentKey = null;
    let currentLines = [];
    let forecaster = '';

    for (const line of lines) {
        // Check for section headers: .SYNOPSIS..., .SHORT TERM (TDY-TUE)..., .LOX WATCHES/WARNINGS/ADVISORIES...
        // Try with office prefix first (3-letter like LOX, SGX)
        const headerMatch = line.match(/^\.[A-Z]{3}\s+([A-Z\s\/]+?)(?:\s*\([^)]*\))?\s*\.{2,3}/)
            || line.match(/^\.([A-Z\s\/]+?)(?:\s*\([^)]*\))?\s*\.{2,3}/);
        if (headerMatch) {
            if (currentKey) {
                sections.push({ key: currentKey, text: currentLines.join('\n').trim() });
            }
            const rawKey = headerMatch[1].trim();
            currentKey = SECTION_NAMES[rawKey] || rawKey.charAt(0) + rawKey.slice(1).toLowerCase();
            currentLines = [line.replace(headerMatch[0], '').trim()];
            continue;
        }
        // Check for $$ delimiter
        if (line.trim() === '$$') {
            if (currentKey) {
                sections.push({ key: currentKey, text: currentLines.join('\n').trim() });
                currentKey = null;
                currentLines = [];
            }
            continue;
        }
        // Skip && markers
        if (line.match(/^&&$/)) continue;
        if (currentKey) {
            currentLines.push(line);
        }
        // Try to find forecaster
        const fMatch = line.match(/^\.?(?:Forecaster|FORECASTER)[:\s]+(.+)/i);
        if (fMatch) forecaster = fMatch[1].trim();
    }
    if (currentKey) {
        sections.push({ key: currentKey, text: currentLines.join('\n').trim() });
    }

    // Clean up: remove forecaster lines from section text, remove trailing &&
    for (const s of sections) {
        s.text = s.text.replace(/&&\s*$/, '').replace(/^\s*&&\s*/gm, '').trim();
        const fm = s.text.match(/\n\s*(?:Forecaster|FORECASTER)[:\s]*(.+)$/im);
        if (fm) {
            if (!forecaster) forecaster = fm[1].trim();
            s.text = s.text.replace(fm[0], '').trim();
        }
    }

    return { sections, forecaster };
}

// ─── extractTakeaway ────────────────────────────────────────────────
// Simplified version: returns the first 1-2 sentences of the synopsis
// section (or first section) without running full translation (which
// would need timezone state). Returns raw text for testing purposes.
export function extractTakeaway(sections) {
    const synSection = sections.find(s => s.key === 'Synopsis') || sections[0];
    if (!synSection) return '';
    const text = synSection.text.replace(/\.{2,}/g, '. ').replace(/\s+/g, ' ').trim();
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (!sentences) return text.substring(0, 200);
    return sentences.slice(0, 2).join(' ').trim();
}

// ─── stripNWSArtifacts ──────────────────────────────────────────────
function stripNWSArtifacts(text) {
    let t = text;
    t = t.replace(/for\s+zones?\s+[\d\->]+/gi, '');
    t = t.replace(/\(See\s+[A-Za-z]+\)/gi, '');
    t = t.replace(/\(\s*\)/g, '');
    t = t.replace(/\bCA\s*\.{1,3}\s*/g, '');
    t = t.replace(/\bPZ\s*\.{1,3}\s*/g, '');
    t = t.replace(/\b(?:See\s+)?(?:Lax|Cfw|Srf|Npw|Mww|Wsw|Ffa)[a-z]{2,8}\b\.?/gi, '');
    t = t.replace(/\.\s*\.\s*/g, '. ');
    t = t.replace(/\s{2,}/g, ' ');
    return t.trim();
}

// ─── translateToPlainEnglish (pure subset) ──────────────────────────
// Applies abbreviation expansion and artifact stripping, but skips
// Zulu time conversion (timezone-dependent) and bold pass (DOM-like).
export function translateToPlainEnglish(text) {
    let t = text;

    // Remove NWS timestamps
    t = t.replace(/\d{2}\/\d{3,4}\s*(?:AM|PM|Z)\.?\s*/gi, '');

    // Remove product code references
    t = t.replace(/,?\s*see\s+the\s+[A-Z]{3,12}\s+(?:and\s+[A-Z]{3,12}\s+)?products?\s+for\s+more\s+details\.?/gi, '.');

    // Strip NWS artifacts
    t = stripNWSArtifacts(t);

    // Remove embedded sub-section headers
    t = t.replace(/\.(?:SHORT|LONG|NEAR)\s+TERM\s*\([^)]*\)\.\s*/gi, '');

    // Clean NWS formatting
    t = t.replace(/\.{3,}/g, '. ');
    t = t.replace(/[ \t]{2,}/g, ' ');

    // Expand abbreviations
    for (const [pat, rep] of FULL_ABBREVIATIONS) {
        t = t.replace(pat, rep);
    }

    // Clean up geopotential heights
    t = t.replace(/(\d{3})\s*dam\b/g, '$1-decameter');

    // Clean up pressure level references
    t = t.replace(/(\d{3,4})\s*mb\b/g, '$1 mb level');

    // Convert long ALL CAPS stretches to sentence case (skip known glossary terms)
    t = t.replace(/\b([A-Z]{5,})\b/g, (m) => {
        if (GLOSSARY[m]) return m;
        return m.charAt(0) + m.slice(1).toLowerCase();
    });

    // Clean artifacts from stripped content
    t = t.replace(/^\.\s*/gm, '');
    t = t.trim();

    return t;
}

// ─── computeConfidence ──────────────────────────────────────────────
// Extracted scoring logic from displayConfidence() in app.js.
// Returns { score, label } or null if no signal phrases found.
export function computeConfidence(text) {
    const t = text.toLowerCase();

    const uncertainPhrases = [
        { pattern: 'low confidence', weight: 3 },
        { pattern: 'remain uncertain', weight: 3 },
        { pattern: 'low predictability', weight: 3 },
        { pattern: 'highly uncertain', weight: 3 },
        { pattern: 'uncertainty', weight: 2 },
        { pattern: 'uncertain', weight: 2 },
        { pattern: 'unclear', weight: 2 },
        { pattern: 'can\'t rule out', weight: 2 },
        { pattern: 'cannot rule out', weight: 2 },
        { pattern: 'wide range', weight: 2 },
        { pattern: 'disagreement', weight: 2 },
        { pattern: 'inconsistent', weight: 2 },
        { pattern: 'diverge', weight: 2 },
        { pattern: 'tricky', weight: 2 },
        { pattern: 'questionable', weight: 2 },
        { pattern: 'iffy', weight: 2 },
        { pattern: 'slight chance', weight: 1 },
        { pattern: 'challenging', weight: 1 },
        { pattern: 'complicated', weight: 1 },
        { pattern: 'depends on', weight: 1 },
        { pattern: 'perhaps', weight: 1 },
        { pattern: 'spread', weight: 1 },
    ];
    const certainPhrases = [
        { pattern: 'high confidence', weight: 3 },
        { pattern: 'increasing confidence', weight: 3 },
        { pattern: 'increasingly likely', weight: 3 },
        { pattern: 'remains on track', weight: 3 },
        { pattern: 'on track', weight: 2 },
        { pattern: 'confident', weight: 2 },
        { pattern: 'good agreement', weight: 2 },
        { pattern: 'consensus', weight: 2 },
        { pattern: 'consistent', weight: 2 },
        { pattern: 'strong signal', weight: 2 },
        { pattern: 'well-defined', weight: 2 },
    ];

    let uncertainScore = 0;
    let certainScore = 0;
    for (const { pattern, weight } of uncertainPhrases) {
        const m = t.match(new RegExp(pattern, 'gi'));
        if (m) uncertainScore += m.length * weight;
    }
    for (const { pattern, weight } of certainPhrases) {
        const m = t.match(new RegExp(pattern, 'gi'));
        if (m) certainScore += m.length * weight;
    }

    const total = uncertainScore + certainScore;
    if (total === 0) return null;

    const score = Math.round((certainScore / total) * 100);

    let label;
    if (score >= 75) label = 'High';
    else if (score >= 50) label = 'Moderate';
    else if (score >= 30) label = 'Mixed';
    else label = 'Low';

    return { score, label };
}

// ─── reorderSections ──────────────────────────────────────────────
// Copied from docs/js/app.js — pure function, no DOM dependency.
export function reorderSections(sections, office, hasAlerts) {
    const priority = {
        'Active Alerts': hasAlerts ? 0 : 99,
        'Synopsis': 1,
        'Short Term': 2,
        'Long Term': 3,
    };
    const coastalOffices = new Set(['LOX','SGX','MTR','STO','EKA','SEW','PQR','MFR','OKX','BOX','PHI','MFL','JAX','TBW','CHS','HFO']);
    if (coastalOffices.has(office)) {
        priority['Marine'] = 3.5;
        priority['Beaches'] = 3.6;
    }
    const fireOffices = new Set(['PSR','VEF','TWC','FGZ','BOU','BOI','MSO','RIW','LOX','SGX']);
    if (fireOffices.has(office)) {
        priority['Fire Weather'] = 3.5;
    }
    return [...sections].sort((a, b) => {
        const pa = priority[a.key] ?? 50;
        const pb = priority[b.key] ?? 50;
        return pa - pb;
    });
}
