# Plaincast Design System

## Colors

### Light Mode (default)
| Token | Value | Usage |
|-------|-------|-------|
| `--text` | `#1c1917` | Body text (warm near-black) |
| `--text-light` | `#78716c` | Secondary text, labels |
| `--text-muted` | `#44403c` | Monospace text |
| `--blue` | `#2563eb` | Primary accent |
| `--blue-light` | `#eff6ff` | Accent backgrounds |
| `--border` | `#e7e5e4` | Borders, dividers |
| `--bg` | `#ffffff` | Page background |

### Dark Mode (`.dark` on `<html>`)
| Token | Value |
|-------|-------|
| `--text` | `#e5e5e5` |
| `--text-light` | `#a3a3a3` |
| `--text-muted` | `#a8a29e` |
| `--blue` | `#60a5fa` |
| `--blue-light` | `rgba(37,99,235,0.15)` |
| `--border` | `#2a2a2a` |
| `--bg` | `#0d0d0d` |

## Typography

| Role | Font | Size | Weight | Tracking |
|------|------|------|--------|----------|
| Body | Georgia, serif | 17px | 400 | normal |
| UI labels | System sans-serif | 0.7-0.85rem | 400-600 | normal |
| Section titles | System sans-serif | 0.8rem | 600 | 0.08em, uppercase |
| Small labels | System sans-serif | 0.7rem | 600 | 0.08em, uppercase |
| Monospace (AFD) | SF Mono, Monaco | 0.82rem | 400 | normal |

### Font Stacks
- `--serif`: Georgia, 'Times New Roman', serif
- `--sans`: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif
- `--mono`: 'SF Mono', Monaco, 'Cascadia Code', monospace

## Spacing

| Token | Value |
|-------|-------|
| Page max-width | 1200px (centered) |
| Horizontal padding | 2rem (1.25rem mobile) |
| Section gap | 3rem |
| Column gap | 2.5rem (1.5rem mobile) |
| Header top padding | 3rem |

## Components

### Pill Button
- `border-radius: 999px`, 1px border, `0.25rem 0.75rem` padding
- Hover: border-color and text-color transition (0.15s)

### Callout Box
- Background: `var(--blue-light)`, 3px solid left border `var(--blue)`
- Right border-radius: 6px

### Select / Dropdown
- 0.85rem sans-serif, 1px border, 4px radius

### Modal
- 10px radius, max-width 600px, 2rem padding
- Backdrop: `rgba(0,0,0,0.4)` (0.6 in dark)
- Focus trap, Escape to close

### Tooltip (Jargon)
- 6px radius, dark bg, white text, max-width 280px
- Below variant for top-of-screen overflow

### Banner (Auto-refresh, Offline)
- Same callout pattern with 3px left border
- Blue variant for informational, amber for warnings
- Slide-down animation (0.2s ease-out)

## Patterns

- **Labels**: Uppercase, small (0.7-0.8rem), letter-spaced, above content
- **Emphasis**: 3px solid left border + tinted background
- **Loading**: 12px spinning circle with blue accent border-top
- **Dividers**: 1px solid `var(--border)`

## Breakpoints

| Name | Query | Key Changes |
|------|-------|-------------|
| Mobile | `max-width: 768px` | Single column, larger touch targets, horizontal scroll nav |
| Desktop | `> 768px` | Two-column side-by-side, keyboard shortcuts visible |

## Aesthetic Direction

Editorial, not dashboard. The forecast IS the content. Let typography and whitespace do the work. Warm stone neutrals (not cold grays). Blue accent used sparingly for interactivity and emphasis. No gradients, no heavy shadows, no card-heavy layouts.
