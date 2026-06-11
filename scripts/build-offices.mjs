// Generates per-office SEO landing pages (docs/o/<CODE>/index.html) + sitemap.xml
// from docs/index.html. Committed to the repo (no Vercel build step), kept in
// sync by tests/seo-pages.test.js. Regenerate after editing docs/index.html:
//   bun scripts/build-offices.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OFFICE_NAMES } from '../docs/js/offices.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS = join(__dirname, '..', 'docs');

// Exact strings from docs/index.html that vary per office.
const TITLE_TEMPLATE = 'Plaincast - What the forecast actually says';
const DESC_TEMPLATE = 'NWS meteorologists write the real forecasts 3-4x daily, but in dense shorthand. Plaincast uses AI to translate them into plain English anyone can read.';

export function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function officeTitle(city) {
    return `${city} NWS Forecast in Plain English · Plaincast`;
}
export function officeDescription(city, code) {
    return `The latest National Weather Service Area Forecast Discussion for ${city} (${code}), translated into plain English — the real forecast, decoded. Updated 3–4 times daily.`;
}

export function renderOfficePage(template, code, city) {
    const title = escHtml(officeTitle(city));
    const desc = escHtml(officeDescription(city, code));
    let html = template;
    // title appears in <title>, og:title, twitter:title; desc in 3 meta tags.
    html = html.split(TITLE_TEMPLATE).join(title);
    html = html.split(DESC_TEMPLATE).join(desc);
    // self-referential canonical + og:url
    html = html.replace('<link rel="canonical" href="https://plaincast.live">',
        `<link rel="canonical" href="https://plaincast.live/o/${code}/">`);
    html = html.replace('<meta property="og:url" content="https://plaincast.live">',
        `<meta property="og:url" content="https://plaincast.live/o/${code}/">`);
    // per-office RSS auto-discovery
    html = html.replace('href="/api/feed?office=LOX"', `href="/api/feed?office=${code}"`);
    // relative assets must resolve from /o/<CODE>/ → make them absolute
    html = html.replace('href="manifest.json"', 'href="/manifest.json"');
    html = html.replace('href="styles.css"', 'href="/styles.css"');
    html = html.replace('src="js/app.js"', 'src="/js/app.js"');
    return html;
}

export function renderSitemap(codes) {
    const urls = ['  <url><loc>https://plaincast.live/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>'];
    for (const code of codes) {
        urls.push(`  <url><loc>https://plaincast.live/o/${code}/</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`);
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

export function buildAll() {
    const template = readFileSync(join(DOCS, 'index.html'), 'utf8');
    const codes = Object.keys(OFFICE_NAMES);
    for (const code of codes) {
        const dir = join(DOCS, 'o', code);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'index.html'), renderOfficePage(template, code, OFFICE_NAMES[code]));
    }
    writeFileSync(join(DOCS, 'sitemap.xml'), renderSitemap(codes));
    return codes.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const n = buildAll();
    console.log(`Generated ${n} office pages + sitemap.xml`);
}
