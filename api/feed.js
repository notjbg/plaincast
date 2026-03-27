// Vercel serverless function: RSS feed per NWS office
// Uses regex translation (no AI cost) for feed content

import { OFFICE_NAMES } from '../docs/js/offices.js';
import { BASIC_ABBREVIATIONS } from '../docs/js/abbreviations.js';

const VALID_OFFICES = new Set(Object.keys(OFFICE_NAMES));

// Regex translation using shared abbreviation patterns
function regexTranslate(text) {
    let t = text;
    t = t.replace(/\.{3,}/g, '. ');
    t = t.replace(/[ \t]{2,}/g, ' ');
    for (const [pat, rep] of BASIC_ABBREVIATIONS) t = t.replace(pat, rep);
    return t.trim();
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    const office = (req.query.office || '').toUpperCase();
    if (!office || !VALID_OFFICES.has(office)) {
        return res.status(400).json({ error: 'Invalid office. Use ?office=LOX (3-letter NWS code)' });
    }

    try {
        const listRes = await fetch(`https://api.weather.gov/products/types/AFD/locations/${office}`, {
            headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' }
        });
        if (!listRes.ok) throw new Error(`NWS API error: ${listRes.status}`);
        const listData = await listRes.json();
        const items = (listData['@graph'] || []).slice(0, 10);

        const cityName = OFFICE_NAMES[office] || office;
        const feedTitle = `Plaincast — ${cityName} (${office}) Forecast`;
        const feedLink = `https://plaincast.live/?office=${office}`;

        let rssItems = '';
        for (const item of items) {
            try {
                const prodUrl = item['@id'] || `https://api.weather.gov/products/${item.id}`;
                if (!prodUrl.startsWith('https://api.weather.gov/')) continue;
                const prodRes = await fetch(prodUrl, {
                    headers: { 'User-Agent': 'Plaincast/1.0 (plaincast.live)' }
                });
                if (!prodRes.ok) continue;
                const prodData = await prodRes.json();
                const text = prodData.productText || '';
                // Extract synopsis for description
                const synMatch = text.match(/\.SYNOPSIS[^.]*\.{2,3}\s*([\s\S]*?)(?=\n\.[A-Z]|\n\$\$)/);
                const synopsis = synMatch ? regexTranslate(synMatch[1]) : regexTranslate(text.substring(0, 500));
                const pubDate = new Date(prodData.issuanceTime).toUTCString();

                rssItems += `    <item>
      <title>${escapeXml(cityName)} Forecast - ${escapeXml(new Date(prodData.issuanceTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))}</title>
      <link>${escapeXml(feedLink)}</link>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(synopsis.substring(0, 1000))}</description>
    </item>\n`;
            } catch(e) { /* skip failed items */ }
        }

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
    <description>NWS Area Forecast Discussions for ${escapeXml(cityName)} decoded into plain English by Plaincast</description>
    <language>en-us</language>
    <atom:link href="https://plaincast.live/api/feed?office=${office}" rel="self" type="application/rss+xml"/>
${rssItems}  </channel>
</rss>`;

        res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200');
        return res.status(200).send(rss);
    } catch (err) {
        console.error('Feed error:', err);
        return res.status(502).json({ error: 'Failed to generate feed' });
    }
}
