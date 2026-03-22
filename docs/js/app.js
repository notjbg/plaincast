// ─── Plaincast App (ES Module) ───────────────────────────────────────
import { GLOSSARY, GLOSSARY_COMPILED } from './glossary.js';
import { OFFICE_TIMEZONES, OFFICE_COORDS, OFFICE_STATES, OFFICE_SENDER, OFFICE_NAMES, SECTION_NAMES } from './offices.js';
import { FULL_ABBREVIATIONS } from './abbreviations.js';
import { computeDiff, renderDiffHTML } from './diff.js';

let currentOffice = 'LOX';
let fetchGeneration = 0; // race condition guard for rapid office switching
let issueTimeDate = null; // for auto-updating "X ago"

// Fetch live alerts and return map of event name → alert URL
async function fetchAlerts(office) {
    const state = OFFICE_STATES[office];
    if (!state) return {};
    try {
        const res = await fetch(`https://api.weather.gov/alerts/active?area=${state}`, {
            headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' }
        });
        if (!res.ok) return {};
        const data = await res.json();
        const senderMatch = OFFICE_SENDER[office] || '';
        const alertMap = {};
        for (const f of (data.features || [])) {
            const p = f.properties;
            // Match alerts from this office
            if (senderMatch && !(p.senderName || '').includes(senderMatch)) continue;
            const event = p.event;
            const alertData = {
                headline: p.headline || event,
                description: p.description || '',
                instruction: p.instruction || '',
                severity: p.severity || '',
                expires: p.expires || '',
                areaDesc: p.areaDesc || ''
            };
            // Store as array to handle multiple alerts of the same type
            if (!alertMap[event]) {
                alertMap[event] = [alertData];
            } else {
                alertMap[event].push(alertData);
            }
        }
        return alertMap;
    } catch(e) { console.warn('Alert fetch failed', e); return {}; }
}

let currentAlerts = {};

// ─── Section parsing ───────────────────────────────────────────────
function parseSections(text) {
    // Remove header lines (product header, timestamps at very top)
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
            // Map to canonical name
            currentKey = SECTION_NAMES[rawKey] || rawKey.charAt(0) + rawKey.slice(1).toLowerCase();
            currentLines = [line.replace(headerMatch[0], '').trim()];
            continue;
        }
        // Check for $$ delimiter (end of section / forecaster signature)
        if (line.trim() === '$$') {
            if (currentKey) {
                sections.push({ key: currentKey, text: currentLines.join('\n').trim() });
                currentKey = null;
                currentLines = [];
            }
            continue;
        }
        // Forecaster line
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
        // Extract forecaster if embedded at end
        const fm = s.text.match(/\n\s*(?:Forecaster|FORECASTER)[:\s]*(.+)$/im);
        if (fm) {
            if (!forecaster) forecaster = fm[1].trim();
            s.text = s.text.replace(fm[0], '').trim();
        }
    }

    return { sections, forecaster };
}

// ─── Plain English translation ─────────────────────────────────────
// Shared NWS artifact cleanup used by both translation and alert formatting
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

function translateToPlainEnglish(text) {
    let t = text;

    // Remove NWS timestamps like "15/913 AM.", "15/935 AM.", "15/1801Z.", "15/1002 AM."
    t = t.replace(/\d{2}\/\d{3,4}\s*(?:AM|PM|Z)\.?\s*/gi, '');

    // Remove NWS product code references and "see the CFWLOX..." sentences
    t = t.replace(/,?\s*see\s+the\s+[A-Z]{3,12}\s+(?:and\s+[A-Z]{3,12}\s+)?products?\s+for\s+more\s+details\.?/gi, '.');

    // Strip shared NWS artifacts
    t = stripNWSArtifacts(t);

    // Convert ***Header*** to sub-section markers (before collapsing whitespace)
    t = t.replace(/\*{3}\s*([^*]+?)\s*\*{3}/g, '\n\n§§§$1§§§\n\n');

    // Remove embedded sub-section headers like ".SHORT TERM (TDY-TUE)..." that leak through
    t = t.replace(/\.(?:SHORT|LONG|NEAR)\s+TERM\s*\([^)]*\)\.\s*/gi, '');

    // Remove NWS formatting artifacts
    t = t.replace(/\.{3,}/g, '. ');
    // Collapse runs of spaces (but preserve newlines for paragraph splitting)
    t = t.replace(/[ \t]{2,}/g, ' ');

    // Expand abbreviations using imported FULL_ABBREVIATIONS
    for (const [pat, rep] of FULL_ABBREVIATIONS) {
        t = t.replace(pat, rep);
    }

    // Convert Zulu time references: 18Z → local time (DST-aware)
    t = t.replace(/\b(\d{2,4})Z\b/g, (_, h) => {
        const utcHour = parseInt(h.length <= 2 ? h : h.substring(0, 2));
        const utcMin = h.length > 2 ? parseInt(h.substring(2)) : 0;
        // Create a UTC date for today to get proper DST offset
        const now = new Date();
        const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, utcMin));
        // Use the office timezone if available, fallback to America/Los_Angeles
        const tz = OFFICE_TIMEZONES[currentOffice] || 'America/Los_Angeles';
        try {
            const local = utcDate.toLocaleString('en-US', { hour: 'numeric', minute: utcMin > 0 ? '2-digit' : undefined, timeZone: tz, timeZoneName: 'short' });
            return local;
        } catch(e) {
            console.warn('Timezone conversion failed', e);
            // Fallback: use IANA zone to determine standard offset
            const stdOffsets = { 'America/New_York': -5, 'America/Detroit': -5, 'America/Indiana/Indianapolis': -5, 'America/Chicago': -6, 'America/Denver': -7, 'America/Phoenix': -7, 'America/Los_Angeles': -8, 'America/Anchorage': -9, 'Pacific/Honolulu': -10 };
            const offset = stdOffsets[tz] || -8;
            let localHr = (utcHour + offset + 24) % 24;
            const ampm = localHr >= 12 ? 'PM' : 'AM';
            const hr12 = localHr === 0 ? 12 : localHr > 12 ? localHr - 12 : localHr;
            return `${hr12} ${ampm}`;
        }
    });

    // Clean up geopotential heights: "541 dam" → "a 541-dam"
    t = t.replace(/(\d{3})\s*dam\b/g, '$1-decameter');

    // Clean up pressure level references
    t = t.replace(/(\d{3,4})\s*mb\b/g, '$1 mb level');

    // Convert long ALL CAPS stretches (5+ chars) to sentence case (skip known terms)
    t = t.replace(/\b([A-Z]{5,})\b/g, (m) => {
        if (GLOSSARY[m]) return m;
        return m.charAt(0) + m.slice(1).toLowerCase();
    });

    // "ern" catch-all removed — too aggressive, collides with English words

    // Clean up artifacts from stripped content
    t = t.replace(/^\.\s*/gm, '');
    t = t.trim();

    // ─── Bold pass: make key info skimmable ─────────────────────────
    // Helper: bold only first occurrence of each match
    const boldSeen = new Set();
    const boldFirst = (str, pattern) => {
        return str.replace(pattern, (m) => {
            const k = m.toLowerCase().trim();
            if (boldSeen.has(k)) return m;
            boldSeen.add(k);
            return `<strong>${m}</strong>`;
        });
    };

    // Days of week — first occurrence only
    t = boldFirst(t, /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g);
    // Timeframes — first occurrence only
    t = boldFirst(t, /\b(tonight|this morning|this afternoon|this evening|overnight|today)\b/gi);

    // Temperatures
    t = t.replace(/(\d{1,3})\s*(?:degrees?|°)\s*(?:F|fahrenheit)?/gi, '<strong>$1°</strong>');
    // Wind speeds
    t = t.replace(/\b(\d{1,3})\s*(?:mph)\b/gi, '<strong>$1 mph</strong>');

    // Rainfall/snow ranges: "4 to 8 inches", "1-2.5 inches" (not ft — skip ceiling heights)
    t = t.replace(/\b(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(inches?|")\b/gi,
        (_, a, b) => `<strong>${a}–${b}"</strong>`);
    // Single number + inches
    t = t.replace(/\b(\d+(?:\.\d+)?)\s*(inches?|")\b/gi, '<strong>$1"</strong>');
    // Worded amounts
    t = t.replace(/\b((?:a\s+)?half(?:\s+and\s+one)?\s+inch(?:\s+per\s+hour)?)\b/gi, '<strong>$1</strong>');

    // Hazard terms — first occurrence only
    t = boldFirst(t, /\b(severe thunderstorms?|flash flood(?:ing)?|debris flows?|damaging winds?|heavy (?:mountain )?snow|high surf|coastal flood(?:ing)?)\b/gi);
    // Alert types — first occurrence only
    t = boldFirst(t, /\b(small craft advisory|gale warning|winter storm (?:watch|warning)|flood watch|wind advisory|high wind watch|high surf advisory|beach hazards? statement)\b/gi);

    // Clean up any double-bolded from overlapping matches
    t = t.replace(/<strong><strong>/g, '<strong>');
    t = t.replace(/<\/strong><\/strong>/g, '</strong>');

    // Split into blocks on double newlines
    const blocks = t.split(/\n\s*\n+/).filter(b => b.trim());

    let html = '';
    for (const block of blocks) {
        const trimmed = block.trim();
        // Check for sub-section header marker
        const subMatch = trimmed.match(/§§§\s*(.+?)\s*§§§\s*([\s\S]*)/);
        if (subMatch) {
            const title = subMatch[1].trim();
            const body = subMatch[2].trim();
            html += `<h3 class="sub-header">${title}</h3>`;
            if (body) html += `<p>${body}</p>`;
        } else if (!trimmed.match(/^§§§/)) {
            // Skip orphaned markers, render normal paragraphs
            html += `<p>${trimmed.replace(/\n/g, ' ')}</p>`;
        }
    }
    return html;
}

// ─── Annotated text with jargon highlights ──────────────────────────
function annotateText(text) {
    // Escape HTML
    let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Use placeholder tokens to prevent nested replacement
    const placeholders = [];
    let jargonId = 0;
    for (const { key, regex, tipText } of GLOSSARY_COMPILED) {
        regex.lastIndex = 0; // reset stateful regex
        t = t.replace(regex, (match) => {
            const idx = placeholders.length;
            const tipId = `jargon-tip-${jargonId++}`;
            placeholders.push(`<span class="jargon" tabindex="0" aria-describedby="${tipId}">${match}<span class="tip" role="tooltip" id="${tipId}">${tipText}</span></span>`);
            return `\x00JARGON${idx}\x00`;
        });
    }

    // Replace placeholders with actual HTML
    for (let i = 0; i < placeholders.length; i++) {
        t = t.replace(`\x00JARGON${i}\x00`, placeholders[i]);
    }

    return t;
}

// ─── Key Takeaway extraction ────────────────────────────────────────
function extractTakeaway(sections) {
    // Use synopsis, or first section
    const synSection = sections.find(s => s.key === 'Synopsis') || sections[0];
    if (!synSection) return '';
    // Take first 1-2 sentences
    const text = synSection.text.replace(/\.{2,}/g, '. ').replace(/\s+/g, ' ').trim();
    const sentences = text.match(/[^.!?]+[.!?]+/g);
    if (!sentences) return text.substring(0, 200);
    const takeaway = sentences.slice(0, 2).join(' ').trim();
    // Quick cleanup
    return translateToPlainEnglish(takeaway).replace(/<\/?p>/g, '');
}

// ─── Confidence indicator ────────────────────────────────────────────
function displayConfidence(fullText) {
    const container = document.getElementById('confidence-container');
    const bar = document.getElementById('confidence-bar');
    const text = document.getElementById('confidence-text');
    const t = fullText.toLowerCase();

    // Weighted phrases: multi-word explicit confidence language scores higher
    // than single common words that appear in nearly every forecast
    const uncertainPhrases = [
        // Explicit confidence statements (weight 3)
        { pattern: 'low confidence', weight: 3 },
        { pattern: 'remain uncertain', weight: 3 },
        { pattern: 'low predictability', weight: 3 },
        { pattern: 'highly uncertain', weight: 3 },
        // Strong uncertainty signals (weight 2)
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
        // Mild uncertainty (weight 1)
        { pattern: 'slight chance', weight: 1 },
        { pattern: 'challenging', weight: 1 },
        { pattern: 'complicated', weight: 1 },
        { pattern: 'depends on', weight: 1 },
        { pattern: 'perhaps', weight: 1 },
        { pattern: 'spread', weight: 1 },
    ];
    const certainPhrases = [
        // Explicit confidence statements (weight 3)
        { pattern: 'high confidence', weight: 3 },
        { pattern: 'increasing confidence', weight: 3 },
        { pattern: 'increasingly likely', weight: 3 },
        { pattern: 'remains on track', weight: 3 },
        { pattern: 'on track', weight: 2 },
        // Strong certainty signals (weight 2)
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
    if (total === 0) { container.style.display = 'none'; return; }

    // Score: 0 (all uncertain) to 100 (all certain)
    const score = Math.round((certainScore / total) * 100);

    // Map to label and color
    let label, color;
    if (score >= 75) { label = 'High'; color = '#16a34a'; }
    else if (score >= 50) { label = 'Moderate'; color = '#0F766E'; }
    else if (score >= 30) { label = 'Mixed'; color = '#d97706'; }
    else { label = 'Low'; color = '#dc2626'; }

    bar.style.width = `${score}%`;
    bar.style.background = color;
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-valuenow', score);
    bar.setAttribute('aria-valuemin', 0);
    bar.setAttribute('aria-valuemax', 100);
    bar.setAttribute('aria-label', `Forecaster confidence: ${label}`);
    bar.title = `Confidence score: ${score}%`;
    text.textContent = label;
    text.style.color = color;
    container.style.display = '';
}

// ─── Format Active Alerts as a clean list ───────────────────────────
// Alert modal — data store keyed by index (avoids inline JSON / XSS)
const ALERT_DATA = {};
let alertIdx = 0;

function showAlertModal(data) {
    const overlay = document.getElementById('alert-modal-overlay');
    const modal = overlay.querySelector('.alert-modal');
    document.getElementById('alert-modal-title').textContent = data.headline;
    const meta = [];
    if (data.severity) meta.push(data.severity);
    if (data.areaDesc) meta.push(data.areaDesc);
    if (data.expires) {
        try { meta.push('Expires ' + new Date(data.expires).toLocaleString()); } catch(e) { console.warn('Date parse error', e); }
    }
    document.getElementById('alert-modal-meta').textContent = meta.join(' · ');
    let body = data.description || '';
    if (data.instruction) body += '\n\n' + data.instruction;
    document.getElementById('alert-modal-body').textContent = body;
    overlay.classList.add('open');
    // Focus trap: move focus into modal
    document.getElementById('alert-modal-close').focus();
}

function closeAlertModal() {
    document.getElementById('alert-modal-overlay').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('alert-modal-overlay');
    if (!overlay) return;
    document.getElementById('alert-modal-close').addEventListener('click', closeAlertModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAlertModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAlertModal(); });

    // Focus trap within modal
    overlay.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusable = overlay.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Event delegation for alert links (avoids inline onclick / XSS)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-alert-idx]');
        if (link) showAlertModal(ALERT_DATA[link.dataset.alertIdx]);
    });

    // Jargon tooltip tap-to-toggle for mobile with bounds checking
    document.addEventListener('click', (e) => {
        const jargon = e.target.closest('.jargon');
        // Close all other open tooltips and reset their styles
        document.querySelectorAll('.jargon.tip-open').forEach(el => {
            if (el !== jargon) {
                el.classList.remove('tip-open');
                const tip = el.querySelector('.tip');
                if (tip) { tip.style.left = ''; tip.style.right = ''; tip.style.transform = ''; tip.classList.remove('tip-below'); }
            }
        });
        if (jargon) {
            jargon.classList.toggle('tip-open');
            if (jargon.classList.contains('tip-open')) {
                const tip = jargon.querySelector('.tip');
                if (tip) {
                    // Reset position first
                    tip.style.left = ''; tip.style.right = ''; tip.style.transform = ''; tip.classList.remove('tip-below');
                    const rect = tip.getBoundingClientRect();
                    // Fix horizontal overflow
                    if (rect.left < 8) { tip.style.left = '0'; tip.style.transform = 'none'; }
                    else if (rect.right > window.innerWidth - 8) { tip.style.left = 'auto'; tip.style.right = '0'; tip.style.transform = 'none'; }
                    // Flip below if overflowing top
                    if (rect.top < 0) { tip.classList.add('tip-below'); }
                }
            }
        }
    });

    // Mobile view toggle (Summary / Original + Annotations)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-view]');
        if (!btn) return;
        const section = btn.closest('.forecast-section');
        if (!section) return;
        const columns = section.querySelector('.columns');
        const view = btn.dataset.view;
        // Update button states
        section.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Update column visibility
        columns.classList.remove('show-plain', 'show-original');
        columns.classList.add(view === 'plain' ? 'show-plain' : 'show-original');
    });
});

function formatAlerts(text, alertMap) {
    // Strip NWS artifacts and format as list items
    let t = stripNWSArtifacts(text);

    // Split on known alert types to create individual items
    const alertPattern = /((?:High Wind (?:Watch|Warning)|Wind Advisory|Flood (?:Watch|Warning)|High Surf (?:Advisory|Warning)|Beach Hazards? Statement|Winter Storm (?:Watch|Warning)|Winter Weather Advisory|Small Craft Advisory|Gale Warning|Storm Warning|Red Flag Warning|Fire Weather Watch|Tornado (?:Watch|Warning)|Severe Thunderstorm (?:Watch|Warning)|Flash Flood (?:Watch|Warning)|Blizzard Warning|Ice Storm Warning|Freeze (?:Watch|Warning)|Frost Advisory|Dense Fog Advisory|Heat Advisory|Excessive Heat Warning|Extreme (?:Heat|Cold) Warning|Wind Chill (?:Watch|Warning|Advisory)|Tropical Storm (?:Watch|Warning)|Hurricane (?:Watch|Warning)|Rip Current Statement|Coastal Flood (?:Watch|Warning|Advisory|Statement))[^.]*\.?)/gi;

    const matches = t.match(alertPattern);
    if (!matches || matches.length === 0) {
        return `<p>${t}</p>`;
    }

    const items = matches.map(m => {
        let item = m.trim().replace(/\.\s*$/, '').replace(/^\.\s*/, '').trim();
        item = item.charAt(0).toUpperCase() + item.slice(1);
        // Classify by severity
        let cls = 'alert-advisory';
        if (/warning/i.test(item)) cls = 'alert-warning';
        else if (/watch/i.test(item)) cls = 'alert-watch';
        else if (/statement/i.test(item)) cls = 'alert-statement';
        // Severity icon for accessibility (not color-only)
        const icon = /warning/i.test(item) ? '⚠️ ' : /watch/i.test(item) ? '👁️ ' : /statement/i.test(item) ? 'ℹ️ ' : '🔹 ';
        // Try to find matching alert details (alertMap values are arrays)
        let alertEntries = null;
        if (alertMap) {
            for (const [event, entries] of Object.entries(alertMap)) {
                if (item.toLowerCase().includes(event.toLowerCase())) { alertEntries = entries; break; }
            }
        }
        let content;
        if (alertEntries && alertEntries.length === 1) {
            const idx = alertIdx++;
            ALERT_DATA[idx] = alertEntries[0];
            content = `<button class="alert-link" data-alert-idx="${idx}" aria-label="View details: ${item.replace(/"/g, '&quot;')}">${icon}${item}</button>`;
        } else if (alertEntries && alertEntries.length > 1) {
            // Multiple alerts of same type — show each with area info
            content = alertEntries.map(ad => {
                const idx = alertIdx++;
                ALERT_DATA[idx] = ad;
                const area = ad.areaDesc ? ` (${ad.areaDesc.split(';')[0].trim()})` : '';
                return `<button class="alert-link" data-alert-idx="${idx}" aria-label="View details: ${item.replace(/"/g, '&quot;')}${area}">${icon}${item}${area}</button>`;
            }).join('');
        } else {
            content = `${icon}${item}`;
        }
        return `<li class="${cls}">${content}</li>`;
    });

    return `<ul class="alert-list">${items.join('')}</ul>`;
}

// ─── AI Translation ─────────────────────────────────────────────────
const aiCache = {}; // client-side cache keyed by text hash

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

async function fetchAITranslation(text, section, office) {
    const key = simpleHash(text + '|' + section + '|' + office);
    if (aiCache[key]) return aiCache[key];

    const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, section, office })
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    // Sanitize: escape HTML entities first, then convert markdown bold
    let safe = data.translation
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = safe
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .split(/\n\s*\n+/)
        .filter(b => b.trim())
        .map(b => `<p>${b.trim().replace(/\n/g, ' ')}</p>`)
        .join('');
    aiCache[key] = html;
    return html;
}

// ─── Smart section ordering ──────────────────────────────────────
// Reorder sections based on context: alerts first when active,
// elevate Marine for coastal offices, Fire Weather for inland.
function reorderSections(sections, office, hasAlerts) {
    const priority = {
        'Active Alerts': hasAlerts ? 0 : 99,
        'Synopsis': 1,
        'Short Term': 2,
        'Long Term': 3,
    };

    // Coastal offices: elevate Marine
    const coastalOffices = new Set(['LOX','SGX','MTR','STO','EKA','SEW','PQR','MFR','OKX','BOX','PHI','MFL','JAX','TBW','CHS','HFO']);
    if (coastalOffices.has(office)) {
        priority['Marine'] = 3.5;
        priority['Beaches'] = 3.6;
    }

    // Mountain/fire offices: elevate Fire Weather
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

// ─── Render ─────────────────────────────────────────────────────────
function render(sections) {
    const sectionsEl = document.getElementById('sections');
    const navEl = document.getElementById('section-nav');
    const takeawayContainer = document.getElementById('takeaway-container');
    const takeawayText = document.getElementById('takeaway-text');

    // Key takeaway
    const takeaway = extractTakeaway(sections);
    if (takeaway) {
        takeawayText.innerHTML = takeaway;
        takeawayContainer.style.display = '';
    }

    // Section nav — sanitize IDs for URL safety
    const safeId = (key) => key.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    navEl.innerHTML = sections.map(s =>
        `<a href="#section-${safeId(s.key)}" aria-label="Jump to ${s.key} section">${s.key}</a>`
    ).join('');

    // Render sections with regex first (instant), then upgrade with AI
    sectionsEl.innerHTML = sections.map(s => {
        let plainHtml;
        if (s.key === 'Active Alerts') {
            plainHtml = formatAlerts(s.text, currentAlerts);
        } else {
            // Show loading spinner initially
            plainHtml = '<div style="display:flex;align-items:center;gap:0.5rem;color:var(--text-light);font-family:var(--sans);font-size:0.85rem"><span class="ai-loading"></span> Summarizing...</div>';
        }
        return `
        <div class="forecast-section" id="section-${safeId(s.key)}" data-section-key="${s.key}">
            <h2 class="section-title">${s.key}</h2>
            <div class="ai-toggle">
                <button class="ai-toggle-btn active" data-view="plain">Summary</button>
                <button class="ai-toggle-btn" data-view="original">Original + Annotations</button>
            </div>
            <div class="columns show-plain">
                <div>
                    <div class="col-label">Summary · Powered by <a href="https://www.anthropic.com/claude/haiku" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;text-decoration-color:var(--border)">Claude</a></div>
                    <div class="plain-col">${plainHtml}</div>
                </div>
                <div>
                    <div class="col-label">Original + Annotations</div>
                    <div class="annotated-col">${annotateText(s.text)}</div>
                </div>
            </div>
        </div>`;
    }).join('');

    // Fire off AI translations with concurrency limit (3 at a time)
    // Capture current generation to prevent stale writes if office changes mid-translation
    const renderGen = fetchGeneration;
    const toTranslate = sections.filter(s => s.key !== 'Active Alerts');
    const concurrency = 3;
    let i = 0;
    async function translateNext() {
        while (i < toTranslate.length) {
            const s = toTranslate[i++];
            if (renderGen !== fetchGeneration) return; // office changed, abort
            const el = document.getElementById(`section-${safeId(s.key)}`);
            if (!el) continue;
            const plainCol = el.querySelector('.plain-col');
            try {
                const html = await fetchAITranslation(s.text, s.key, currentOffice);
                if (renderGen !== fetchGeneration) return; // office changed during fetch
                plainCol.innerHTML = html;
            } catch (err) {
                if (renderGen !== fetchGeneration) return;
                console.warn('AI translation failed for', s.key, err);
                plainCol.innerHTML = `<div style="font-family:var(--sans);font-size:0.75rem;color:var(--text-light);margin-bottom:0.5rem;font-style:italic">AI summary unavailable — showing expanded version</div>` + translateToPlainEnglish(s.text);
            }
        }
    }
    // Launch concurrent workers
    const workers = [];
    for (let w = 0; w < Math.min(concurrency, toTranslate.length); w++) {
        workers.push(translateNext());
    }
    Promise.allSettled(workers);
}

// ─── Helpers ────────────────────────────────────────────────────────
function timeAgo(date) {
    const diffMs = Date.now() - date;
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    const days = Math.round(diffHours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ─── Fetch AFD ──────────────────────────────────────────────────────
async function fetchAFD(office) {
    currentOffice = office;
    const thisGen = ++fetchGeneration;
    const sectionsEl = document.getElementById('sections');
    sectionsEl.innerHTML = `
    <div class="skeleton">
        <div class="skeleton-takeaway"></div>
        <div class="skeleton-confidence"></div>
        <div class="skeleton-section"><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div></div>
        <div class="skeleton-section"><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
        <div class="skeleton-section"><div class="skeleton-title"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>
    </div>`;
    // Reset alert state for new fetch
    alertIdx = 0;
    for (const k of Object.keys(ALERT_DATA)) delete ALERT_DATA[k];

    // Update footer office name
    const footerOffice = document.getElementById('footer-office');
    if (footerOffice) footerOffice.textContent = office;

    // Check cache first (15 min TTL)
    const cached = sessionStorage.getItem(`afd-${office}`);
    if (cached) {
        try {
            const { time, prodData } = JSON.parse(cached);
            if (Date.now() - time < 15 * 60 * 1000) {
                if (thisGen === fetchGeneration) renderAFD(prodData, office);
                return;
            }
        } catch(e) { console.warn('Cache parse error, refetching', e); }
    }

    try {
        const listRes = await fetch(`https://api.weather.gov/products/types/AFD/locations/${office}`, {
            headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' }
        });
        if (!listRes.ok) throw new Error(`API error: ${listRes.status} ${listRes.statusText}`);
        if (thisGen !== fetchGeneration) return; // stale request
        const listData = await listRes.json();
        const latest = listData['@graph']?.[0];
        if (!latest) throw new Error('No AFD found for this office');

        const prodUrl = latest['@id'] || `https://api.weather.gov/products/${latest.id}`;
        const prodRes = await fetch(prodUrl, {
            headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' }
        });
        if (!prodRes.ok) throw new Error(`Product fetch error: ${prodRes.status}`);
        if (thisGen !== fetchGeneration) return; // stale request
        const prodData = await prodRes.json();

        // Cache the result
        sessionStorage.setItem(`afd-${office}`, JSON.stringify({
            time: Date.now(),
            prodData
        }));

        if (thisGen === fetchGeneration) renderAFD(prodData, office);

    } catch (err) {
        if (thisGen !== fetchGeneration) return;
        // Try stale cache as fallback
        if (cached) {
            try {
                const { prodData } = JSON.parse(cached);
                renderAFD(prodData, office);
                return;
            } catch(e) { console.warn('Stale cache fallback failed', e); }
        }
        const errDiv = document.createElement('div');
        errDiv.className = 'loading';
        errDiv.textContent = `Error loading forecast: ${err.message}`;
        sectionsEl.innerHTML = '';
        sectionsEl.appendChild(errDiv);
        console.error(err);
    }
}

// ─── afterRender callback array (replaces monkey-patching) ──────────
const afterRender = [];

async function renderAFD(prodData, office) {
    const sectionsEl = document.getElementById('sections');

    // Update raw link
    const rawUrl = prodData['@id'] || `https://api.weather.gov/products/${prodData.id}`;
    document.getElementById('raw-link').href = rawUrl;

    // Parse issue time with office timezone
    const tz = OFFICE_TIMEZONES[office] || 'America/Los_Angeles';
    const issueTime = new Date(prodData.issuanceTime);
    issueTimeDate = issueTime;
    document.getElementById('issue-time').textContent =
        `Issued ${issueTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: tz, timeZoneName: 'short' })} - ${timeAgo(issueTime)}`;

    // Parse sections
    const { sections, forecaster } = parseSections(prodData.productText);

    // Display forecaster name if available
    if (forecaster) {
        const issueEl = document.getElementById('issue-time');
        issueEl.textContent += ` · by ${forecaster}`;
    }

    if (sections.length === 0) {
        sectionsEl.innerHTML = '<div class="loading">Could not parse forecast sections.</div>';
        return;
    }

    // Smart section ordering: alerts first when active, coastal/fire context
    const hasAlerts = sections.some(s => s.key === 'Active Alerts');
    const orderedSections = reorderSections(sections, office, hasAlerts);

    // Extract and display confidence
    displayConfidence(prodData.productText);

    // Fetch live alerts for linking (non-blocking — render first, update after)
    currentAlerts = {};
    render(orderedSections);

    // Then fetch alerts and re-render the alerts section with links
    fetchAlerts(office).then(alertMap => {
        currentAlerts = alertMap;
        // Re-render just the alerts section if we got links
        if (Object.keys(alertMap).length > 0) {
            const alertSection = orderedSections.find(s => s.key === 'Active Alerts');
            if (alertSection) {
                const el = document.getElementById('section-active-alerts');
                if (el) {
                    const plainCol = el.querySelector('.plain-col');
                    if (plainCol) plainCol.innerHTML = formatAlerts(alertSection.text, alertMap);
                }
            }
        }
    });

    // Run afterRender callbacks (pass orderedSections for diff engine)
    for (const cb of afterRender) cb(prodData, office, orderedSections);
}

// ─── Geolocation: find nearest office ───────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findNearestOffice(lat, lon) {
    let nearest = 'LOX', minDist = Infinity;
    for (const [code, [oLat, oLon]] of Object.entries(OFFICE_COORDS)) {
        const d = haversineDistance(lat, lon, oLat, oLon);
        if (d < minDist) { minDist = d; nearest = code; }
    }
    return nearest;
}

// ─── Init ───────────────────────────────────────────────────────────
const officeSelect = document.getElementById('office-select');

// Office priority: URL param > localStorage > geolocation > LOX
const urlParams = new URLSearchParams(window.location.search);
const urlOffice = urlParams.get('office')?.toUpperCase();
const savedOffice = (() => { try { return localStorage.getItem('plaincast-office'); } catch(e) { return null; } })();
let initialOffice = 'LOX';

if (urlOffice && officeSelect.querySelector(`option[value="${urlOffice}"]`)) {
    initialOffice = urlOffice;
} else if (savedOffice && officeSelect.querySelector(`option[value="${savedOffice}"]`)) {
    initialOffice = savedOffice;
}
officeSelect.value = initialOffice;

function updateTitle(office) {
    const opt = officeSelect.querySelector(`option[value="${office}"]`);
    const name = opt ? opt.textContent.replace(/\s*\([^)]+\)/, '') : office;
    document.title = `${name} Forecast - Plaincast`;
}

function selectOffice(office, updateUrl) {
    officeSelect.value = office;
    if (updateUrl !== false) {
        const url = new URL(window.location);
        url.searchParams.set('office', office);
        history.pushState({}, '', url);
    }
    try { localStorage.setItem('plaincast-office', office); } catch(e) { /* quota */ }
    updateTitle(office);
    fetchAFD(office);
}

officeSelect.addEventListener('change', () => selectOffice(officeSelect.value));

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const office = params.get('office')?.toUpperCase();
    if (office && officeSelect.querySelector(`option[value="${office}"]`)) {
        selectOffice(office, false);
    }
});

// Load initial office
updateTitle(initialOffice);
fetchAFD(initialOffice);

// Geolocation: auto-detect after initial load (non-blocking)
if (!urlOffice && !savedOffice && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const detected = findNearestOffice(pos.coords.latitude, pos.coords.longitude);
            if (detected !== initialOffice) {
                selectOffice(detected);
                const issueEl = document.getElementById('issue-time');
                if (issueEl) {
                    const flash = document.createElement('span');
                    flash.textContent = ' 📍 Detected';
                    flash.style.cssText = 'color:var(--teal);font-size:0.8rem;transition:opacity 1s';
                    issueEl.appendChild(flash);
                    setTimeout(() => { flash.style.opacity = '0'; }, 2000);
                    setTimeout(() => flash.remove(), 3000);
                }
            }
        },
        () => { /* denied or error — silent fallback */ },
        { timeout: 5000, maximumAge: 300000 }
    );
}

// ─── Service worker registration ────────────────────────────────────
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* no-op */ });
}

// ─── Theme toggle ───────────────────────────────────────────────────
(function() {
    const toggle = document.getElementById('theme-toggle');
    function isDark() { return document.documentElement.classList.contains('dark'); }
    function updateIcon() {
        var sun = document.getElementById('theme-icon-sun');
        var moon = document.getElementById('theme-icon-moon');
        if (sun && moon) {
            sun.style.display = isDark() ? 'none' : 'block';
            moon.style.display = isDark() ? 'block' : 'none';
        }
    }
    updateIcon();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    toggle.addEventListener('click', () => {
        const dark = !isDark();
        document.documentElement.classList.toggle('dark', dark);
        // If toggling back to match system preference, clear override so we follow the OS again
        if (dark === mq.matches) {
            localStorage.removeItem('theme');
        } else {
            localStorage.setItem('theme', dark ? 'dark' : 'light');
        }
        updateIcon();
    });
    // Follow system preference changes when no manual override is stored
    mq.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            document.documentElement.classList.toggle('dark', e.matches);
            updateIcon();
        }
    });
})();

// Auto-update "X minutes ago" every 60 seconds (preserve forecaster attribution)
setInterval(() => {
    if (!issueTimeDate) return;
    const el = document.getElementById('issue-time');
    if (el) {
        // Match " - <time ago>" but stop before " · by" if present
        el.textContent = el.textContent.replace(/ - \d+[^·]*?((?= · )|$)/, ` - ${timeAgo(issueTimeDate)}$1`);
    }
}, 60000);

// ─── Share button ───────────────────────────────────────────────────
document.getElementById('share-btn').addEventListener('click', async () => {
    const url = window.location.href;
    if (navigator.share) {
        try { await navigator.share({ title: document.title, url }); return; } catch(e) { /* cancelled */ }
    }
    try {
        await navigator.clipboard.writeText(url);
        const toast = document.getElementById('share-toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    } catch(e) {
        prompt('Copy this URL:', url);
    }
});

// ─── Auto-refresh polling (10 min, visibility-aware) ────────────────
let lastProductId = null;
let refreshTimer = null;

function startRefreshPolling() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
        if (document.hidden) return;
        try {
            const res = await fetch(`https://api.weather.gov/products/types/AFD/locations/${currentOffice}`, {
                headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' }
            });
            if (!res.ok) return;
            const data = await res.json();
            const latest = data['@graph']?.[0];
            if (latest && lastProductId && latest.id !== lastProductId) {
                document.getElementById('refresh-banner').style.display = '';
            }
        } catch(e) { /* silent retry next cycle */ }
    }, 10 * 60 * 1000);
}

// Track current product ID for refresh detection (via afterRender callback)
afterRender.push((prodData, office) => { lastProductId = prodData.id; });

// Load history after each render (via afterRender callback)
afterRender.push((prodData, office) => { fetchHistoryList(office).then(items => { historyList = items; renderHistorySelector(items, prodData.id); }); });

// Seasonal context: show current conditions below key takeaway
afterRender.push(async (prodData, office) => {
    try {
        const res = await fetch(`/api/conditions?office=${office}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.temp) return;

        let contextText = `Current: ${data.temp}\u00B0F`;
        if (data.delta !== null) {
            const sign = data.delta > 0 ? '+' : '';
            contextText += ` (${sign}${data.delta}\u00B0 vs ${new Date().toLocaleString('en-US', { month: 'long' })} avg)`;
        }

        // Insert into the forecast-meta strip
        let container = document.getElementById('seasonal-context');
        if (!container) {
            container = document.createElement('span');
            container.id = 'seasonal-context';
            container.style.cssText = 'font-family:var(--font-ui);font-size:0.75rem;color:var(--text-light)';
            const metaInner = document.querySelector('.forecast-meta-inner');
            if (metaInner) metaInner.prepend(container);
        }
        container.textContent = contextText;
    } catch (e) {
        // Silent fail — no context line shown
    }
});

// Forecast diff: compare current vs previous AFD
afterRender.push((prodData, office, sections) => {
    if (!sections) return;
    const storageKey = `afd-${office}-previous-sections`;
    const safeId = (key) => key.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

    try {
        const prevRaw = sessionStorage.getItem(storageKey);
        const previousSections = prevRaw ? JSON.parse(prevRaw) : null;

        if (previousSections) {
            const diffResults = computeDiff(previousSections, sections);
            const changedCount = diffResults.filter(d => d.status !== 'unchanged').length;

            if (changedCount > 0) {
                // Add diff toggle to each changed section
                for (const diff of diffResults) {
                    if (diff.status === 'unchanged') continue;
                    const sectionEl = document.getElementById(`section-${safeId(diff.key)}`);
                    if (!sectionEl) continue;
                    const titleEl = sectionEl.querySelector('.section-title');
                    if (!titleEl || titleEl.querySelector('.diff-toggle')) continue;

                    const btn = document.createElement('button');
                    btn.className = 'diff-toggle';
                    btn.innerHTML = `<span class="diff-badge">${diff.status === 'added' ? 'new' : '\u0394'}</span> What changed`;
                    btn.setAttribute('aria-pressed', 'false');
                    titleEl.appendChild(btn);

                    const plainCol = sectionEl.querySelector('.plain-col');
                    let originalHTML = plainCol ? plainCol.innerHTML : '';

                    btn.addEventListener('click', () => {
                        const active = btn.classList.toggle('active');
                        btn.setAttribute('aria-pressed', String(active));
                        if (active && plainCol) {
                            originalHTML = plainCol.innerHTML;
                            plainCol.innerHTML = renderDiffHTML(diff);
                        } else if (plainCol) {
                            plainCol.innerHTML = originalHTML;
                        }
                    });
                }
            }
        } else {
            // First visit — no previous data to compare
        }

        // Store current sections for next comparison
        const toStore = sections.map(s => ({ key: s.key, text: s.text }));
        sessionStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (e) {
        console.warn('Diff engine error:', e);
    }
});

document.getElementById('refresh-load')?.addEventListener('click', () => {
    document.getElementById('refresh-banner').style.display = 'none';
    // Clear cache so fetchAFD doesn't serve stale data
    sessionStorage.removeItem(`afd-${currentOffice}`);
    fetchAFD(currentOffice);
});
document.getElementById('refresh-dismiss')?.addEventListener('click', () => {
    document.getElementById('refresh-banner').style.display = 'none';
});

startRefreshPolling();

// ─── Offline detection ──────────────────────────────────────────────
window.addEventListener('offline', () => {
    document.getElementById('offline-banner').style.display = '';
});
window.addEventListener('online', () => {
    document.getElementById('offline-banner').style.display = 'none';
});
if (!navigator.onLine) {
    document.getElementById('offline-banner').style.display = '';
}

// ─── Keyboard shortcuts ────────────────────────────────────────────
const kbdOverlay = document.getElementById('kbd-overlay');
document.getElementById('kbd-hint')?.addEventListener('click', () => {
    kbdOverlay.classList.add('open');
    document.getElementById('kbd-close').focus();
});
document.getElementById('kbd-close')?.addEventListener('click', () => {
    kbdOverlay.classList.remove('open');
});
kbdOverlay?.addEventListener('click', (e) => { if (e.target === kbdOverlay) kbdOverlay.classList.remove('open'); });

document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const sectionEls = document.querySelectorAll('.forecast-section');
    if (e.key === 'j' || e.key === 'k') {
        e.preventDefault();
        const scrollY = window.scrollY + 100;
        let target = null;
        const arr = Array.from(sectionEls);
        if (e.key === 'j') {
            target = arr.find(s => s.offsetTop > scrollY);
        } else {
            for (let i = arr.length - 1; i >= 0; i--) {
                if (arr[i].offsetTop < scrollY - 50) { target = arr[i]; break; }
            }
        }
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('office-select')?.focus();
    } else if (e.key === '?') {
        e.preventDefault();
        kbdOverlay.classList.add('open');
        document.getElementById('kbd-close').focus();
    } else if (e.key === 'Escape') {
        kbdOverlay.classList.remove('open');
    }
});

// ─── Forecast history ───────────────────────────────────────────────
let historyList = [];

async function fetchHistoryList(office) {
    try {
        const res = await fetch(`https://api.weather.gov/products/types/AFD/locations/${office}`, {
            headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' }
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data['@graph'] || []).slice(0, 10).map(item => ({
            id: item.id,
            url: item['@id'] || `https://api.weather.gov/products/${item.id}`,
            time: new Date(item.issuanceTime)
        }));
    } catch(e) { return []; }
}

function renderHistorySelector(items, currentId) {
    let container = document.getElementById('history-selector');
    if (!container) {
        container = document.createElement('div');
        container.id = 'history-selector';
        container.style.cssText = 'margin-left:auto';
        const metaInner = document.querySelector('.forecast-meta-inner');
        if (metaInner) metaInner.appendChild(container);
    }
    // Build select with DOM methods (no innerHTML for safety)
    container.textContent = '';
    const sel = document.createElement('select');
    sel.id = 'history-select';
    sel.style.cssText = 'font-family:var(--font-ui);font-size:0.75rem;border:1px solid var(--border);border-radius:6px;padding:0.2rem 0.4rem;background:var(--bg-surface);color:var(--text)';
    const tz = OFFICE_TIMEZONES[currentOffice] || 'America/Los_Angeles';
    if (items.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = 'No previous forecasts';
        sel.appendChild(opt);
    } else {
        items.forEach((item, i) => {
            const opt = document.createElement('option');
            opt.value = item.id;
            const label = item.time.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', weekday: 'short', month: 'short', day: 'numeric', timeZone: tz, timeZoneName: 'short' });
            opt.textContent = (i === 0 ? 'Latest: ' : '') + label + ' (' + timeAgo(item.time) + ')';
            if (item.id === currentId) opt.selected = true;
            sel.appendChild(opt);
        });
    }
    sel.addEventListener('change', async () => {
        const item = items.find(i => i.id === sel.value);
        if (!item) return;
        try {
            const res = await fetch(item.url, { headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' } });
            if (!res.ok) throw new Error('Fetch failed');
            const prodData = await res.json();
            renderAFD(prodData, currentOffice);
        } catch(e) { console.warn('History fetch failed', e); }
    });
    container.appendChild(sel);
}

// ─── PWA install prompt ──────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // Only show after 2nd visit
    const visits = parseInt(localStorage.getItem('plaincast-visits') || '0', 10) + 1;
    localStorage.setItem('plaincast-visits', String(visits));
    if (visits < 2) return;
    // Don't show if already dismissed
    if (localStorage.getItem('plaincast-install-dismissed')) return;
    deferredInstallPrompt = e;
    showInstallBanner();
});

function showInstallBanner() {
    const banner = document.createElement('div');
    banner.className = 'banner';
    banner.id = 'install-banner';
    banner.innerHTML = `<div class="banner-box banner-blue">
        <span>Add Plaincast to your home screen</span>
        <button class="banner-action" id="install-accept">Install</button>
        <button class="banner-dismiss" id="install-dismiss" aria-label="Dismiss">&times;</button>
    </div>`;
    const header = document.querySelector('.header');
    header.parentNode.insertBefore(banner, header.nextSibling);

    document.getElementById('install-accept').addEventListener('click', async () => {
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            deferredInstallPrompt = null;
        }
        banner.remove();
    });
    document.getElementById('install-dismiss').addEventListener('click', () => {
        localStorage.setItem('plaincast-install-dismissed', '1');
        banner.remove();
    });
}

// Track visits for PWA prompt
(() => {
    const visits = parseInt(localStorage.getItem('plaincast-visits') || '0', 10) + 1;
    localStorage.setItem('plaincast-visits', String(visits));
})();
