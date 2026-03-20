# 🌤️ Plaincast

**What the forecast actually says.**

**[→ plaincast.live](https://plaincast.live)** · **[☕ Support the Project](https://buymeacoffee.com/notjbg)** · **[💡 Suggest a Feature](https://github.com/notjbg/plaincast/issues)**

---

## What Is This?

Area Forecast Discussions (AFDs) are the real forecasts - written 3-4 times daily by National Weather Service meteorologists who actually read the models and interpret what they mean for your area. They're far deeper than any weather app, but they're written in dense meteorological shorthand that's nearly unreadable for normal people.

Plaincast uses Anthropic's Claude to summarize them into plain English, displayed side by side with the annotated original.

---

## Features

### 🤖 AI-Powered Summaries
Every forecast section is summarized by Claude (Haiku) into natural, readable prose. Not just abbreviation expansion - actual explanation of *why* weather is happening, what the models show, and what it means for you. Falls back to regex translation if the API is unavailable.

### 📖 Side-by-Side Layout
AI summary on the left, original AFD with jargon annotations on the right. Every highlighted term in the original has a hover tooltip (or tap on mobile) explaining what it means. 150+ term glossary covering synoptic meteorology, aviation, marine, pressure levels, model names, and airport codes.

### ⚡ Key Takeaway
Bold 1-2 sentence summary at the top extracting what matters most from the Synopsis. Skip the details when you just need the headline.

### 📊 Forecaster Confidence
Visual indicator analyzing the AFD's language for certainty vs. uncertainty signals. Words like "high confidence" and "consistent" push it up; "uncertain", "tricky", and "wide range" push it down.

### ✏️ Bold Key Info
Days of the week, hazard terms, temperatures, rainfall amounts, and wind speeds are bolded for skimmability.

### 🗂️ Section Parsing
Synopsis, Short Term, Long Term, Aviation, Marine, Beaches, Fire Weather, and Active Alerts all rendered as separate sections with pill-style jump navigation.

### ⚠️ Active Alerts
Current watches, warnings, and advisories formatted as a clean, color-coded bullet list with severity icons. Click any alert to see the full NWS detail in a modal.

### 🏢 68 NWS Offices
Covering all US regions: Northeast (New York, Boston, Philadelphia, Washington DC, Pittsburgh, Buffalo, Raleigh, Charleston), Southeast (Atlanta, Miami, Jacksonville, Tampa Bay, Birmingham, Nashville, Morristown, Jackson), Midwest (Chicago, Detroit, Indianapolis, Cleveland, Cincinnati, Milwaukee, Grand Rapids, St. Louis, Kansas City, Des Moines), Northern Plains (Minneapolis, Duluth, Sioux Falls, Bismarck, Omaha, Grand Forks), South Central (Dallas/Fort Worth, Houston, San Antonio, Oklahoma City, Tulsa, Little Rock, New Orleans, Shreveport, Lake Charles), Rockies (Denver, Pueblo, Grand Junction, Salt Lake City, Boise, Billings, Missoula, Riverton), Southwest (Phoenix, Las Vegas, Tucson, Flagstaff, Albuquerque, El Paso), Pacific (Los Angeles, San Diego, San Francisco, Sacramento, Central CA, Eureka, Seattle, Portland, Medford, Spokane), and Alaska/Hawaii (Anchorage, Fairbanks, Honolulu).

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  docs/index.html - single-file vanilla app      │
│                                                 │
│  NWS API (api.weather.gov)                      │
│    ├─ /products/types/AFD/locations/{office}     │
│    ├─ /products/{id}                            │
│    └─ /alerts/active?area={state}               │
│                                                 │
│  Vercel Serverless (/api/translate)             │
│    └─ Anthropic Claude Haiku                    │
│       └─ In-memory + client-side caching        │
│                                                 │
│  No framework. No build step. No API key needed.│
└─────────────────────────────────────────────────┘
```

---

## Technical Details

- **Single-file app** - Everything in `docs/index.html` (~2,500 lines)
- **Zero frontend dependencies** - Vanilla HTML/CSS/JS, no frameworks, no build step
- **NWS API** - Pulls directly from `api.weather.gov` (no API key needed)
- **AI summaries** - Claude Haiku via Vercel serverless with aggressive caching
- **System fonts** - Georgia serif for body, system monospace for raw AFD, system sans for UI
- **Light mode** - Editorial design with generous whitespace
- **Mobile responsive** - Side-by-side stacks to vertical on screens under 768px
- **Accessible** - ARIA roles on modals and tooltips, focus trapping, keyboard navigation, severity icons
- **DST-aware** - Zulu time conversion uses IANA timezones per office
- **SEO** - WebApplication + FAQPage schema, OG image, llms.txt, AI crawler friendly

---

## Run Locally

```bash
cd docs && python3 -m http.server 8765
# Open http://localhost:8765
# Note: AI summaries require the Vercel serverless function.
# Locally, sections will fall back to regex translation.
```

---

## Why?

Weather apps give you icons and numbers. AFDs give you the *reasoning* - why the models disagree, what the forecasters are watching, where the uncertainty is. That's the forecast that matters.

The problem is they look like this:

```
.SYNOPSIS...DEEP SW FLOW WILL CONT TO BRING PCPN TO THE AREA
THRU TUE. TEMPS WILL REMAIN BLO NORMAL. NEXT TROF MOV THRU WED...
```

Plaincast turns that into:

> A deep southwest flow is channeling moisture into Southern California through **Tuesday**, bringing steady rain to the coast and heavy snow to the mountains. Temperatures will stay **5-10 degrees below average**. The next trough moves through **Wednesday** with increasing winds.

---

## Credits

Built by [Jonah Berg](https://github.com/notjbg). Forecast data from the [National Weather Service](https://www.weather.gov). Summaries powered by [Claude](https://www.anthropic.com/claude/haiku).

---

## License

MIT - see [LICENSE](LICENSE) for details.
