# Cartogram rebrand — design

Status: approved (visual system validated in browser companion, 2026-07-13)

## 1. Brand core

**Name:** Cartogram (renamed from "Architecture Map" / "Archmap").

**Concept:** a cartogram is a real cartographic technique — a map where geometry is distorted to represent a variable (weight, relationship, importance) instead of literal geographic distance. This is a precise technical description of what the product does: it doesn't draw your code as it sits on disk, it draws how the pieces relate and matter. The name is not decorative, it's accurate.

**Internal tagline (voice reference, not necessarily final copy):** "El territorio de tu sistema, trazado en tiempo real."

**Tone of voice:** technical and direct, no empty promises. A midpoint between a serious engineering tool and a command-room feel — never oversells, stays honest about being an early product. Cartographic vocabulary (territorio, relieve, señal, baliza) is a seasoning, not the base of every sentence.

## 2. Visual identity

### 2.1 Color

The current violet/purple palette is the generic default of every AI-era SaaS and must be fully replaced.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0c0d10` | Base — graphite/night-map background |
| `--surface` | `#17191d` | First surface step (cards, panels) |
| `--surface-raised` | `#1e2024` | Second surface step (elevated/floating elements only) |
| `--text` | `#f4ede0` | Primary text — warm parchment white, not cold |
| `--text-muted` | `#a39d8c` | Secondary text |
| `--text-faint` | `#6f6a5c` | Tertiary text / metadata |
| `--accent` (beacon) | `#e8a13d` | Primary accent — amber, like a beacon light on a map. CTAs, active/live state, primary emphasis. |
| `--accent-ink` | `#1a1200` | Text color on top of `--accent` fills |
| `--accent-secondary` (tide) | `#3f8fa8` | Secondary accent — teal, like water on a map. Secondary state, "live/generating" indicators. |
| `--error` | keep a muted warm red, tuned against the new base (exact value TBD in implementation, must read as intentional against graphite, not clash with amber) |

**Node-kind colors** (`--kind-system-*`, `--kind-container-*`, etc. in `theme.css`) currently use violet-family hues and must be redesigned in Phase 2 as a coherent hue system radiating from the amber/teal pair — muted saturation, night-map mood. Not finalized here; Phase 2 implementation defines the full set.

### 2.2 Typography

Rejected during review: a serif/sans pairing (Fraunces + IBM Plex Sans) — user explicitly wants an all-sans system. Approved direction:

- **Headings & wordmark:** Space Grotesk (weights 600/700). Distinctive geometric letterforms (squared descenders, distinct "G") — avoids the generic Inter/Outfit look without introducing a serif.
- **UI / body:** IBM Plex Sans (weights 400/500/600).
- **Data / metadata / coordinates:** JetBrains Mono (weights 400/500) — service names, badges, timestamps, anything that reads as "instrument data."

### 2.3 Hard rule: no borders

**Never use border lines to separate surfaces.** Differentiate cards, panels, and containers by shifting background tone (`--bg` → `--surface` → `--surface-raised`), not by drawing a border. Shadows (`--shadow-float` equivalent, e.g. `0 12px 30px -14px rgba(0,0,0,0.6)`) are reserved for genuinely elevated/floating elements only (e.g. a panel floating over the canvas) — not a default replacement for borders, not used on every card.

This applies to every component touched in every phase: `theme.css` tokens, cards, panels, buttons, node shapes, side panels, dashboards.

### 2.4 Logomark

Concentric contour rings around a single point — a topographic "peak," representing one node with its own weight in the map. Core dot in amber, inner ring in amber (high opacity), outer ring(s) fading toward teal at low opacity. Simple enough to scale down to a favicon; every element has a stated meaning (no abstract mark chosen for looks alone).

### 2.5 Radius & spacing (carried over, revisit if needed in Phase 1)

Keep `--radius-sm/md/lg` roughly at current values (8/12/14px range observed in mockups) unless Phase 1 implementation finds a reason to change them.

## 3. Motion language

Three recurring principles — not decoration, each communicates something about the product:

1. **Hover = elevation + glow.** Interactive nodes/cards lift `translateY(-2/-3px)`, shift to `--surface-raised`, and gain a soft amber glow (`box-shadow` using `color-mix` with `--accent`). Duration ~200-220ms, `cubic-bezier(.4,0,.2,1)`.
2. **Signal pulse on active connections.** A small dot travels along an SVG edge path (`offset-path` + `offset-distance` keyframes, ~2.6s loop, fade in/out at path ends) to mark a "live" or actively-relevant edge — not applied to every edge, reserved for meaningful state (e.g. an edge just touched by AI generation, or hovered/selected).
3. **Reveal / survey-in.** When a diagram is generated (MCP agent drawing the map), new nodes appear via concentric rings drawing themselves in (`stroke-dasharray`/`stroke-dashoffset` animation, staggered rings fading by distance from center) — reads as the map being surveyed into existence, not just popping in.

These three motion primitives are the vocabulary for the whole product; new interactions should reuse them rather than inventing new motion patterns.

## 4. Implementation scope & phasing

Approved approach: **foundation first**, three phases.

- **Phase 1 — Foundation.** Rewrite `theme.css` design tokens (color, typography, radius, motion durations, remove border-based styling patterns), and apply the new system to `LoginPage` and `ProjectDashboard` — the two smallest full screens, used to validate the system end-to-end before touching the complex canvas. Update `index.html` font loading (Space Grotesk + IBM Plex Sans + JetBrains Mono, drop Outfit).
- **Phase 2 — Diagram canvas.** `DiagramCanvas`, `DiagramNode`, `nodeShapes`, `umlMarkers`, `buildFlowEdges`, `edgeGeometry`, `DiagramDetailPanel` — the most complex surface. Defines the final node-kind color system (section 2.1) and applies the signal-pulse / reveal motion primitives here, since this is where they matter most (AI-driven generation).
- **Phase 3 — Secondary panels.** `SidePanel`, `Breadcrumb`, `LegendTab`, `TechBadge`, `ShareProjectPanel`, `McpIntegrationSettings`, `McpAuthorize`, and any remaining chrome.

Each phase should leave the app in a working, visually-consistent state (no mixed old/new styling left behind within a phase).

## 5. Explicitly out of scope for this design doc

- Exact `--error` hex and full node-kind color ramp (Phase 2 decision).
- Copy/microcopy rewrite beyond what's needed to fit the new voice (not a content redesign).
- Backend/MCP behavior changes — this is a visual/brand layer on top of existing functionality.
