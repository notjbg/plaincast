// Vercel serverless function: RSS feed per NWS office
// Uses regex translation (no AI cost) for feed content

const VALID_OFFICES = new Set([
    'OKX','BOX','PHI','LWX','PBZ','BUF','RAH','CHS',
    'FFC','MFL','JAX','TBW','BMX','OHX','MRX','JAN',
    'LOT','DTX','IND','CLE','ILN','MKX','GRR','LSX','EAX','DMX',
    'MPX','DLH','FSD','BIS','OAX','FGF',
    'FWD','HGX','EWX','OUN','TSA','LZK','LIX','SHV','LCH',
    'BOU','PUB','GJT','SLC','BOI','BYZ','MSO','RIW',
    'PSR','VEF','TWC','FGZ','ABQ','EPZ',
    'LOX','SGX','MTR','STO','HNX','EKA','SEW','PQR','MFR','OTX',
    'AFC','AFG','HFO'
]);

const OFFICE_NAMES = {
    'OKX': 'New York', 'BOX': 'Boston', 'PHI': 'Philadelphia', 'LWX': 'Washington DC',
    'PBZ': 'Pittsburgh', 'BUF': 'Buffalo', 'RAH': 'Raleigh', 'CHS': 'Charleston SC',
    'FFC': 'Atlanta', 'MFL': 'Miami', 'JAX': 'Jacksonville', 'TBW': 'Tampa Bay',
    'BMX': 'Birmingham', 'OHX': 'Nashville', 'MRX': 'Morristown', 'JAN': 'Jackson MS',
    'LOT': 'Chicago', 'DTX': 'Detroit', 'IND': 'Indianapolis', 'CLE': 'Cleveland',
    'ILN': 'Cincinnati', 'MKX': 'Milwaukee', 'GRR': 'Grand Rapids', 'LSX': 'St. Louis',
    'EAX': 'Kansas City', 'DMX': 'Des Moines', 'MPX': 'Minneapolis', 'DLH': 'Duluth',
    'FSD': 'Sioux Falls', 'BIS': 'Bismarck', 'OAX': 'Omaha', 'FGF': 'Grand Forks',
    'FWD': 'Dallas/Fort Worth', 'HGX': 'Houston', 'EWX': 'San Antonio',
    'OUN': 'Oklahoma City', 'TSA': 'Tulsa', 'LZK': 'Little Rock',
    'LIX': 'New Orleans', 'SHV': 'Shreveport', 'LCH': 'Lake Charles',
    'BOU': 'Denver', 'PUB': 'Pueblo', 'GJT': 'Grand Junction', 'SLC': 'Salt Lake City',
    'BOI': 'Boise', 'BYZ': 'Billings', 'MSO': 'Missoula', 'RIW': 'Riverton',
    'PSR': 'Phoenix', 'VEF': 'Las Vegas', 'TWC': 'Tucson', 'FGZ': 'Flagstaff',
    'ABQ': 'Albuquerque', 'EPZ': 'El Paso',
    'LOX': 'Los Angeles', 'SGX': 'San Diego', 'MTR': 'San Francisco',
    'STO': 'Sacramento', 'HNX': 'Central California', 'EKA': 'Eureka',
    'SEW': 'Seattle', 'PQR': 'Portland', 'MFR': 'Medford', 'OTX': 'Spokane',
    'AFC': 'Anchorage', 'AFG': 'Fairbanks', 'HFO': 'Honolulu',
};

// Simple regex translation (mirrors client-side translateToPlainEnglish, text-only)
function regexTranslate(text) {
    let t = text;
    t = t.replace(/\.{3,}/g, '. ');
    t = t.replace(/[ \t]{2,}/g, ' ');
    const abbrevs = [
        [/\bchc\b/gi, 'chance'], [/\bcsts\b/gi, 'coasts'], [/\bvlys\b/gi, 'valleys'],
        [/\bmtns\b/gi, 'mountains'], [/\bwnds\b/gi, 'winds'], [/\btemps\b/gi, 'temperatures'],
        [/\bpcpn\b/gi, 'precipitation'], [/\baftn\b/gi, 'afternoon'], [/\bmrng\b/gi, 'morning'],
        [/\berly\b/gi, 'early'], [/\bthru\b/gi, 'through'], [/\bbtwn\b/gi, 'between'],
        [/\bisol\b/gi, 'isolated'], [/\bocnl\b/gi, 'occasional'], [/\bcont\b/gi, 'continue'],
        [/\bincr\b/gi, 'increase'], [/\bdecr\b/gi, 'decrease'], [/\bfcst\b/gi, 'forecast'],
        [/\bTSTMS?\b/gi, 'thunderstorms'], [/\bSFC\b/g, 'surface'], [/\btrof\b/gi, 'trough'],
    ];
    for (const [pat, rep] of abbrevs) t = t.replace(pat, rep);
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
