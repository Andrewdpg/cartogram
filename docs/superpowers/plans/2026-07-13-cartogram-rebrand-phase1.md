# Cartogram Rebrand — Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic violet theme with the Cartogram visual system (color, typography, motion, no-border rule) at the token level, and apply it to the two smallest full screens — Login and Project Dashboard — to validate the system end-to-end before the complex diagram canvas (Phase 2).

**Architecture:** This codebase has no CSS modules and no per-component stylesheets — one global `src/theme.css` (imported once in `main.tsx`) defines CSS custom properties and a handful of shared utility classes (`.btn`, `.icon-btn`, `.node-shape`, …) that components reference via plain `className`. This plan follows that existing convention: extend `theme.css` with the new tokens and utility classes, then update `LoginPage` and `ProjectDashboard` to use them. A new `AppHeader` component (with an inline SVG `BrandMark`) is introduced because both the dashboard and every future screen need the same branded header — it doesn't exist yet in any form.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest + @testing-library/react, react-router-dom, plain CSS custom properties (no CSS-in-JS, no CSS modules).

## Global Constraints

- **No borders, ever.** Differentiate surfaces by background tone (`--bg` → `--surface` → `--surface-raised`), never by `border`. Shadows only for genuinely elevated/floating elements, not as a default.
- **Typography:** Space Grotesk (headings/wordmark, 600/700) + IBM Plex Sans (UI/body, 400/500/600) + JetBrains Mono (data/metadata, 400/500). No serif anywhere.
- **Color:** graphite base `#0c0d10`, surfaces `#17191d` / `#1e2024`, warm parchment text `#f4ede0`, amber "beacon" accent `#e8a13d` (ink `#1a1200` for text on top of it), teal "tide" secondary accent `#3f8fa8`.
- **Out of scope this phase:** `--kind-*` node colors, `--edge-*` colors, the diagram canvas, and every component listed under Phase 2/3 in the design doc (`Breadcrumb`, `DiagramCanvas`, `DiagramNode`, `nodeShapes`, `umlMarkers`, `SidePanel`, `McpAuthorize`, `DiagramPage`, `ShareProjectPanel`, `McpIntegrationSettings`, `LegendTab`, `TechBadge`). Do not touch these files. They still reference `var(--border)` and `var(--kind-*)` — those tokens must remain defined with working values so those screens don't break.
- **No functional/behavioral changes.** Same routes, same labels, same button text, same success/error copy, same Supabase/`diagramRepo` calls. This is a visual layer only.
- Reference doc: `docs/superpowers/specs/2026-07-13-cartogram-rebrand-design.md`

---

### Task 1: Update font loading and title in `index.html`

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: the `--font-heading` token in Task 2 assumes "Space Grotesk" weights 500/600/700 are loaded; `--font-ui` assumes "IBM Plex Sans" weights 400/500/600 are loaded; `--font-mono` assumes "JetBrains Mono" weights 400/500 are loaded (unchanged from before).

- [ ] **Step 1: Replace the Google Fonts link and title**

Edit `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cartogram</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Verify the change**

Run: `rg "Space Grotesk|IBM Plex Sans|Cartogram" index.html`
Expected: three matches (font link contains both family names, title is "Cartogram").

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: load Cartogram brand fonts and update page title"
```

---

### Task 2: Rewrite `theme.css` design tokens and shared utility classes

**Files:**
- Modify: `src/theme.css` (full file, lines 1-142 as of this plan)

**Interfaces:**
- Produces: CSS custom properties `--bg`, `--surface`, `--surface-raised`, `--text`, `--text-muted`, `--text-faint`, `--accent`, `--accent-ink`, `--accent-dim`, `--accent-secondary`, `--error`, `--radius-sm/md/lg`, `--transition`, `--transition-slow`, `--shadow-float`, `--font-heading`, `--font-ui`, `--font-mono` — all consumed by Tasks 3-5. Also produces global classes `.btn`, `.btn-primary`, `.icon-btn` (renamed usage, same class names — no consumer changes needed elsewhere), and new classes `.app-header`, `.app-header-brand`, `.app-header-actions`, `.auth-shell`, `.auth-card`, `.auth-card .hint`, `.field`, `.alert`, `.dashboard-body`, `.dashboard-hint`, `.project-grid`, `.project-card`, `.project-card-new` — consumed by Tasks 3-5.
- Consumes: nothing (this is the base layer). Leaves `--border`, `--border-strong`, `--edge-*`, `--kind-*` tokens defined with their **current** values untouched, because `Breadcrumb`, `DiagramCanvas`, `DiagramNode`, `nodeShapes`, `umlMarkers`, `SidePanel`, `McpAuthorize` still reference them and are out of scope this phase.

- [ ] **Step 1: Run the full test suite to capture the baseline (regression guard)**

This is a pure CSS/markup-support change with no new business logic, so instead of a new failing test, the existing suite is the regression guard: it must pass before and after.

Run: `npm run test`
Expected: all existing tests PASS (baseline, before any edit).

- [ ] **Step 2: Replace the `:root` token block and base element styles**

Replace `src/theme.css` lines 1-77 (from `:root {` through the closing of the `body` rule) with:

```css
:root {
  --bg: #0c0d10;
  --surface: #17191d;
  --surface-raised: #1e2024;
  --border: #26282e;
  --border-strong: #33363d;
  --text: #f4ede0;
  --text-muted: #a39d8c;
  --text-faint: #6f6a5c;
  --accent: #e8a13d;
  --accent-ink: #1a1200;
  --accent-dim: #4a3616;
  --accent-secondary: #3f8fa8;

  --edge-stroke: #33363d;
  --edge-arrow: #5c5748;
  --edge-label-fg: #a39d8c;
  --edge-label-bg: #17191d;
  --error: #d97060;

  --kind-system-fg: #a3ddce;
  --kind-system-bg: #16302c;
  --kind-container-fg: #a3c3e8;
  --kind-container-bg: #16273a;
  --kind-component-fg: #d6b0e0;
  --kind-component-bg: #2c2436;
  --kind-service-fg: #b3aef2;
  --kind-service-bg: #262444;
  --kind-server-fg: #e0b393;
  --kind-server-bg: #2e2419;
  --kind-database-fg: #9bd0af;
  --kind-database-bg: #1f2f26;
  --kind-class-fg: #ecd394;
  --kind-class-bg: #2f2818;
  --kind-external-fg: #a5a0b5;
  --kind-external-bg: #24222c;
  --kind-bridge-fg: #ecc094;
  --kind-bridge-bg: #302719;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 14px;
  --transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 280ms cubic-bezier(0.4, 0, 0.2, 1);
  --shadow-float: 0 12px 30px -14px rgba(0, 0, 0, 0.6);

  --font-heading: 'Space Grotesk', system-ui, sans-serif;
  --font-ui: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}

button {
  font-family: inherit;
}

button:focus-visible,
a:focus-visible,
textarea:focus-visible,
input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

Note: `--kind-*` and `--edge-*` values are copied verbatim from the original file — not touched, per the global constraint.

- [ ] **Step 3: Replace `.btn` / `.btn-primary` / `.icon-btn` to remove borders**

Replace the old `.btn`, `.btn:hover`, `.btn:active`, `.btn-primary`, `.btn-primary:hover`, `.icon-btn`, `.icon-btn:hover` rules with:

```css
.btn {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--surface-raised);
  color: var(--text);
  cursor: pointer;
  transition: background var(--transition), transform var(--transition);
}

.btn:hover {
  background: color-mix(in srgb, var(--surface-raised) 85%, var(--text) 8%);
}

.btn:active {
  transform: translateY(1px);
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-ink);
  font-weight: 600;
}

.btn-primary:hover {
  filter: brightness(1.08);
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color var(--transition), background var(--transition);
  border-radius: var(--radius-sm);
}

.icon-btn:hover {
  color: var(--text);
  background: var(--surface-raised);
}
```

Leave `.node-shape`, `.node-shape:hover`, `.node-eye-btn`, `.node-eye-btn:hover` exactly as they are (Phase 2 territory, they already reference `--accent`/`--transition` which now resolve to the new values automatically).

- [ ] **Step 4: Append the Phase 1 layout utility classes**

Add at the end of `src/theme.css`:

```css
.app-shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 28px;
  background: var(--surface);
}

.app-header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 19px;
  color: var(--text);
  letter-spacing: -0.01em;
}

.app-header-actions {
  display: flex;
  gap: 10px;
}

.auth-shell {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 36px;
  width: 100%;
  max-width: 360px;
}

.auth-card h1 {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 22px;
  color: var(--text);
  margin: 16px 0 4px;
}

.auth-card .hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 24px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.field label {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.field input {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: none;
}

.alert {
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--error);
  background: color-mix(in srgb, var(--error) 14%, var(--surface));
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin: 12px 0 0;
}

.dashboard-body {
  padding: 28px;
}

.dashboard-body h1 {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 24px;
  letter-spacing: -0.01em;
  color: var(--text);
  margin: 0 0 4px;
}

.dashboard-hint {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-faint);
  margin: 0 0 24px;
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.project-card {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 18px;
  text-decoration: none;
  color: inherit;
  display: block;
  transition: transform var(--transition), background var(--transition);
}

.project-card:hover {
  transform: translateY(-2px);
  background: var(--surface-raised);
}

.project-card h4 {
  font-family: var(--font-ui);
  font-weight: 500;
  font-size: 14px;
  color: var(--text);
  margin: 0;
}

.project-card-new {
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.project-card-new .field {
  margin-bottom: 0;
}
```

- [ ] **Step 5: Run the full test suite again to confirm no regression**

Run: `npm run test`
Expected: same tests PASS as in Step 1 (CSS-only change, no DOM structure touched yet — `LoginPage`/`ProjectDashboard` markup is unchanged until Tasks 4-5).

- [ ] **Step 6: Commit**

```bash
git add src/theme.css
git commit -m "feat: rewrite theme tokens for the Cartogram visual system"
```

---

### Task 3: Add `AppHeader` and `BrandMark` components

**Files:**
- Create: `src/components/AppHeader.tsx`
- Test: `src/components/AppHeader.test.tsx`

**Interfaces:**
- Consumes: CSS classes `.app-header`, `.app-header-brand`, `.app-header-actions` from Task 2.
- Produces: `export function BrandMark({ size }: { size?: number }): JSX.Element` and `export function AppHeader({ actions }: { actions?: ReactNode }): JSX.Element`, both consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the failing test**

Create `src/components/AppHeader.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppHeader } from './AppHeader'

describe('AppHeader', () => {
  it('renders the cartogram wordmark', () => {
    render(<AppHeader />)
    expect(screen.getByText('cartogram')).toBeInTheDocument()
  })

  it('renders actions passed to it', () => {
    render(<AppHeader actions={<button>Nuevo proyecto</button>} />)
    expect(screen.getByText('Nuevo proyecto')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AppHeader.test.tsx`
Expected: FAIL — `Failed to resolve import "./AppHeader"` (file doesn't exist yet).

- [ ] **Step 3: Implement `AppHeader.tsx`**

Create `src/components/AppHeader.tsx`:

```tsx
import type { ReactNode } from 'react'

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="6" fill="var(--accent)" />
      <circle cx="36" cy="36" r="16" fill="none" stroke="var(--accent)" strokeWidth="2" opacity="0.75" />
      <circle cx="36" cy="36" r="26" fill="none" stroke="var(--accent)" strokeWidth="1.4" opacity="0.4" />
    </svg>
  )
}

export function AppHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <BrandMark />
        <span>cartogram</span>
      </div>
      {actions && <div className="app-header-actions">{actions}</div>}
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AppHeader.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AppHeader.tsx src/components/AppHeader.test.tsx
git commit -m "feat: add AppHeader and BrandMark components"
```

---

### Task 4: Restyle `LoginPage`

**Files:**
- Modify: `src/components/LoginPage.tsx`
- Existing test (do not modify): `src/components/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `BrandMark` from `./AppHeader` (Task 3); CSS classes `.auth-shell`, `.auth-card`, `.auth-card .hint`, `.field`, `.btn`, `.btn-primary`, `.alert` from Task 2.
- Produces: no change to the component's public behavior — same default export shape used by `App.tsx`.

- [ ] **Step 1: Run the existing test to confirm the baseline**

Run: `npx vitest run src/components/LoginPage.test.tsx`
Expected: PASS (baseline, before edit).

- [ ] **Step 2: Replace `LoginPage.tsx`**

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BrandMark } from './AppHeader'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <BrandMark size={32} />
        <h1>cartogram</h1>
        {sent ? (
          <p>Check your email for a magic link to sign in.</p>
        ) : (
          <>
            <p className="hint">Trazá el territorio de tu sistema</p>
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Send magic link
              </button>
              {error && (
                <p role="alert" className="alert">
                  {error}
                </p>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run the test to confirm no regression**

Run: `npx vitest run src/components/LoginPage.test.tsx`
Expected: PASS (same test, unmodified — confirms the restyle preserved `getByLabelText('Email')`, the "Send magic link" button text, the `signInWithOtp` call, and the "check your email" success text).

- [ ] **Step 4: Commit**

```bash
git add src/components/LoginPage.tsx
git commit -m "feat: restyle LoginPage with the Cartogram auth card"
```

---

### Task 5: Restyle `ProjectDashboard`

**Files:**
- Modify: `src/components/ProjectDashboard.tsx`
- Existing test (do not modify): `src/components/ProjectDashboard.test.tsx`

**Interfaces:**
- Consumes: `AppHeader` from `./AppHeader` (Task 3); CSS classes `.app-shell`, `.dashboard-body`, `.dashboard-hint`, `.alert`, `.project-grid`, `.project-card`, `.project-card-new`, `.field`, `.btn`, `.btn-primary` from Task 2.
- Produces: no change to the component's public behavior — same default export shape used by `App.tsx`.

- [ ] **Step 1: Run the existing tests to confirm the baseline**

Run: `npx vitest run src/components/ProjectDashboard.test.tsx`
Expected: PASS, 2 tests (baseline, before edit).

- [ ] **Step 2: Replace `ProjectDashboard.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, createProject } from '../lib/diagramRepo'
import { AppHeader } from './AppHeader'

interface Project {
  id: string
  name: string
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => setError((err as Error).message))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      const created = await createProject(newName)
      setProjects((prev) => [...prev, created])
      setNewName('')
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <div className="dashboard-body">
        <h1>Tus proyectos</h1>
        <p className="dashboard-hint">
          {projects.length} {projects.length === 1 ? 'proyecto' : 'proyectos'}
        </p>
        {error && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <div className="project-grid">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}/`} className="project-card">
              <h4>{p.name}</h4>
            </Link>
          ))}
          <form onSubmit={handleCreate} className="project-card-new">
            <div className="field">
              <label htmlFor="project-name">Project name</label>
              <input id="project-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary">
              Create project
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run the tests to confirm no regression**

Run: `npx vitest run src/components/ProjectDashboard.test.tsx`
Expected: PASS, 2 tests (confirms `findByText('My Repo')`, `getByLabelText('Project name')`, the "Create project" button, and `findByText('New One')` after creation all still work).

- [ ] **Step 4: Commit**

```bash
git add src/components/ProjectDashboard.tsx
git commit -m "feat: restyle ProjectDashboard with the Cartogram project grid"
```

---

### Task 6: Full-suite verification and typecheck

**Files:** none (verification only)

**Interfaces:** none — this task only runs checks across everything touched in Tasks 1-5.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests PASS, including `src/components/AppHeader.test.tsx`, `src/components/LoginPage.test.tsx`, `src/components/ProjectDashboard.test.tsx`, and every other existing test file (untouched components must still pass since their CSS variable names didn't change).

- [ ] **Step 2: Typecheck and build**

Run: `npm run build`
Expected: exits 0 — `tsc -b` reports no type errors, `vite build` completes.

- [ ] **Step 3: Manual visual check**

Run: `npm run dev`, open the app in a browser, navigate to `/login` and `/projects`.
Confirm: graphite background, amber primary button, Space Grotesk wordmark "cartogram" in the header/auth card, no visible border lines anywhere on these two screens, project cards separated by tone (not lines) with a lift-on-hover effect.

- [ ] **Step 4: Commit (only if Step 3 required fixes; otherwise skip)**

```bash
git add -A
git commit -m "fix: address visual QA findings from Phase 1 rebrand"
```
