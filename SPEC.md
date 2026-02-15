# Forecast Decoded — Spec

## What
A clean, minimal website that pulls NWS Area Forecast Discussions (AFDs) and presents them in two modes:
1. **Plain English** — AI-translated readable version for normal people
2. **Annotated Original** — The raw AFD with inline hover tooltips explaining meteorological jargon

## Design
- Ultra-minimal editorial design. Think: darioamodei.com, steipete.me, jonahberg.com
- Single page per forecast office. Start with LOX (Los Angeles/Oxnard)
- Big clean typography (serif for body, mono for raw AFD text)
- Lots of whitespace. The forecast IS the content — no dashboard clutter
- Light mode default with subtle weather-themed accents (muted blues/grays)
- Mobile responsive

## Layout (single page)
1. **Header**: "Forecast Decoded" + location selector (just LOX for now, but build the dropdown for future offices)
2. **Mode toggle**: Two pill buttons — "Plain English" / "Original + Annotations" 
3. **Issue time**: When the AFD was issued, in local time, with relative time ("2 hours ago")
4. **The forecast content** — this is the hero:
   - In Plain English mode: clean prose paragraphs, organized by section (Synopsis, Short Term, Long Term, etc.)
   - In Annotated mode: monospace raw text with highlighted jargon terms. Hover/click shows a tooltip with definition
5. **Confidence indicator**: Extracted from AFD language — a simple bar or badge showing forecaster confidence
6. **Key Takeaway**: A bold 1-2 sentence summary at the very top of what matters most ("A powerful storm arrives Monday with potential severe weather, flooding, and mountain snow")
7. **Sections nav**: Subtle jump links for Synopsis, Short Term, Long Term, Aviation, Marine
8. **Footer**: "Data: NWS {office}" + link to raw product + "Built by Jonah Berg"

## Jargon Glossary (build a comprehensive JS object)
Include at minimum:
- dam (decameters of geopotential height)
- PWAT/PWATs (precipitable water)
- vort/vort lobe (vorticity)
- 500mb, 300mb, 700mb (pressure levels → altitude equivalents)
- SCA (Small Craft Advisory)
- GALE (Gale Warning)
- MVFR, IFR, LIFR, VFR (flight categories)
- TSTM (thunderstorm)
- chc (chance)
- csts/vlys (coasts/valleys)
- mtns (mountains)
- trof (trough)
- QPF (quantitative precipitation forecast)
- CAPE (convective available potential energy)
- CIN (convective inhibition)
- LI (lifted index)
- OFB/FROPA (frontal passage)
- Z/UTC time references
- SFC (surface)
- BKN/OVC/SCT/FEW (sky conditions)
- AGL/MSL (above ground level / mean sea level)
- KLAX, KBUR, etc (ICAO airport codes)
- NW/SW/SE flow patterns
- ensembles (forecast model runs)
- hi res (high resolution models)
- TAF (terminal aerodrome forecast)
- NEXRAD (radar)
- GDP/GS (ground delay program / ground stop)
- ...and at least 30 more common AFD terms

## Plain English Translation
For the MVP, use a client-side approach:
- Parse the AFD into sections (SYNOPSIS, SHORT TERM, LONG TERM, AVIATION, MARINE, BEACHES)
- For each section, apply regex-based cleanup:
  - Expand abbreviations (chc → chance, csts → coasts, vlys → valleys, mtns → mountains, etc.)
  - Convert ALL CAPS warnings to styled callout boxes
  - Convert measurements to include conversions where helpful
  - Clean up the NWS formatting artifacts
- Add a "TL;DR" key takeaway at the top extracted from the synopsis
- Future: actual LLM translation via API (but start with smart regex for zero-cost MVP)

## Tech
- Single HTML file (like Blue Board pattern — proven, fast, simple)
- Vanilla JS, no framework
- NWS API: https://api.weather.gov/products/types/AFD/locations/{office}
- No API key needed
- Host on GitHub Pages initially, move to Vercel if needed
- Fetch latest AFD on page load, cache in sessionStorage

## Files to Create
- public/index.html — the entire app (single file)
- README.md — project description
- That's it. Keep it dead simple.

## DO NOT
- Use any framework or build step
- Make it look like a dashboard — this is editorial/magazine style
- Use dark mode (this is a reading experience, light mode)
- Over-design. Let the typography and whitespace do the work.
