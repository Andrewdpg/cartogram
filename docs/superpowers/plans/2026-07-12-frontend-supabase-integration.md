# Frontend Supabase Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current static-file diagram loading with Supabase-backed
auth, project/diagram CRUD, sharing, and per-project MCP access toggles —
while keeping the existing canvas/rendering code (`nodeShapes.tsx`,
`autoLayout.ts`, `DiagramCanvas.tsx`, `LegendTab.tsx`) completely untouched.

**Architecture:** `@supabase/supabase-js` client wrapped in a small
`src/lib/supabaseClient.ts` + a `src/lib/diagramRepo.ts` data-access module
that replaces `loadDiagram.ts`'s glob-based loading with async Supabase
queries. `DiagramPage` and `resolveDiagramPath` change from sync/file-id-based
to async/project-and-slug-based, matching the schema built in the Supabase
backend plan (`docs/superpowers/plans/2026-07-12-supabase-backend.md`,
assumed already implemented). New routes and screens (login, project
dashboard, sharing, integration settings) are added around the existing
diagram viewer, which becomes one route among several instead of the app's
only route.

**Tech Stack:** React 18, react-router-dom (already a dependency),
`@supabase/supabase-js` (new dependency), Vite, Vitest + Testing Library
(existing).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-12-backend-mcp-design.md`.
- Schema/RLS source of truth: `docs/superpowers/plans/2026-07-12-supabase-backend.md`
  (this plan assumes those tables and policies already exist against a
  running `supabase start` instance).
- `nodeShapes.tsx`, `autoLayout.ts`, `DiagramCanvas.tsx`, `LegendTab.tsx`,
  `buildFlowEdges.ts`, `edgeGeometry.ts`, `umlMarkers.tsx`, `techIcons.ts` are
  **not modified** by this plan — they operate on the same `Diagram` shape
  regardless of where it came from.
- `validateDiagramShape`/`checkCrossFileReferences` (`src/lib/validateDiagram.ts`)
  are reused as-is for validating Supabase-sourced JSON (including the "Edit
  JSON" tab's apply path) — do not duplicate this logic.
- No `diagrams/*.json` local files are read by the app after this plan ships
  (per spec: DB is the sole source of truth). The existing example files
  under `diagrams/` may remain in the repo as documentation/reference but are
  no longer imported by `src/`.
- Every new async data operation must have a corresponding loading and error
  UI state — no unhandled promise rejections presented as a blank screen.

---

### Task 1: Supabase client + environment config

**Files:**
- Create: `src/lib/supabaseClient.ts`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env.local` is ignored — verify, don't
  duplicate if already covered by a `.env*` pattern)
- Modify: `package.json` (add dependency)

**Interfaces:**
- Produces: `supabase: SupabaseClient` — a configured singleton client,
  imported by every later task's data-access code.

- [ ] **Step 1: Install the dependency**

Run: `npm install @supabase/supabase-js`
Expected: added to `package.json` dependencies.

- [ ] **Step 2: Create the env template**

Create `.env.example`:

```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=replace-with-local-anon-key-from-supabase-start
```

- [ ] **Step 3: Verify `.env.local` is gitignored**

Run: `rg -n "\.env" .gitignore`
Expected: a pattern matching `.env.local` (e.g. `.env*.local` or `.env.local`
explicitly). If nothing matches, add `.env.local` to `.gitignore`.

- [ ] **Step 4: Create the client module**

Create `src/lib/supabaseClient.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env.local and fill in values from `supabase start`.'
  )
}

export const supabase = createClient(url, anonKey)
```

- [ ] **Step 5: Manually verify against the local Supabase stack**

Run: `supabase start` (if not already running from the backend plan), copy
the printed `API URL` and `anon key` into a local `.env.local` (create it
from `.env.example`), then run `npm run dev` and confirm the app boots
without the "Missing VITE_SUPABASE_URL" error (a blank/broken page from
missing tables is expected at this point — later tasks add the screens that
use this client).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/supabaseClient.ts .env.example .gitignore
git commit -m "chore: add supabase client and env config"
```

---

### Task 2: Auth — login screen, session state, route guard

**Files:**
- Create: `src/lib/useSession.ts`
- Create: `src/components/LoginPage.tsx`
- Create: `src/components/LoginPage.test.tsx`
- Create: `src/components/RequireAuth.tsx`
- Create: `src/components/RequireAuth.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase` from Task 1.
- Produces: `useSession(): { session: Session | null, loading: boolean }`
  hook (wraps `supabase.auth.getSession()` + `onAuthStateChange`) — used by
  `RequireAuth` here and by every later task's screens that need to know the
  current user's id (`session.user.id`).
- Produces: `<RequireAuth>{children}</RequireAuth>` — renders children if
  authenticated, otherwise `<Navigate to="/login" />`. Later tasks wrap
  every protected route in this.

- [ ] **Step 1: Write the failing test for `RequireAuth`**

Create `src/components/RequireAuth.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'

vi.mock('../lib/useSession', () => ({
  useSession: vi.fn(),
}))

import { useSession } from '../lib/useSession'

describe('RequireAuth', () => {
  it('renders children when a session exists', () => {
    vi.mocked(useSession).mockReturnValue({
      session: { user: { id: 'u1' } } as any,
      loading: false,
    })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<RequireAuth><p>secret</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('redirects to /login when there is no session', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: false })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<RequireAuth><p>secret</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders nothing while loading', () => {
    vi.mocked(useSession).mockReturnValue({ session: null, loading: true })
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<RequireAuth><p>secret</p></RequireAuth>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
    expect(screen.queryByText('login page')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- RequireAuth`
Expected: FAIL — `useSession` and `RequireAuth` modules don't exist yet.

- [ ] **Step 3: Implement `useSession`**

Create `src/lib/useSession.ts`:

```typescript
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  return { session, loading }
}
```

- [ ] **Step 4: Implement `RequireAuth`**

Create `src/components/RequireAuth.tsx`:

```typescript
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../lib/useSession'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- RequireAuth`
Expected: PASS, 3/3.

- [ ] **Step 6: Write the failing test for `LoginPage`**

Create `src/components/LoginPage.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginPage } from './LoginPage'

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}))

import { supabase } from '../lib/supabaseClient'

describe('LoginPage', () => {
  it('sends a magic link on submit', async () => {
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'me@example.com' } })
    fireEvent.click(screen.getByText('Send magic link'))
    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'me@example.com' })
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Run to verify it fails**

Run: `npm test -- LoginPage`
Expected: FAIL — module doesn't exist.

- [ ] **Step 8: Implement `LoginPage`**

Create `src/components/LoginPage.tsx`:

```typescript
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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

  if (sent) {
    return <p>Check your email for a magic link to sign in.</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <button type="submit">Send magic link</button>
      {error && <p role="alert">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npm test -- LoginPage`
Expected: PASS.

- [ ] **Step 10: Wire routes in `App.tsx`**

Modify `src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from './components/LoginPage'
import { RequireAuth } from './components/RequireAuth'
import { DiagramPage } from './components/DiagramPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/projects/:projectId/*"
          element={
            <RequireAuth>
              <DiagramPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
```

Note: this route shape (`/projects/:projectId/*`) anticipates Task 4's
`DiagramPage` rewrite — `App.test.tsx` (existing) will fail after this step
until Task 4 lands; that's expected and addressed there, not here.

- [ ] **Step 11: Commit**

```bash
git add src/lib/useSession.ts src/components/LoginPage.tsx src/components/LoginPage.test.tsx src/components/RequireAuth.tsx src/components/RequireAuth.test.tsx src/App.tsx
git commit -m "feat: add supabase magic-link auth and route guard"
```

---

### Task 3: `diagramRepo` — Supabase-backed data access

**Files:**
- Create: `src/lib/diagramRepo.ts`
- Create: `src/lib/diagramRepo.test.ts`
- Delete: `src/lib/loadDiagram.ts`
- Delete: `src/lib/loadDiagram.test.ts`

**Interfaces:**
- Consumes: `supabase` from Task 1; `Diagram`, `validateDiagramShape` from
  existing `src/lib/types.ts` / `src/lib/validateDiagram.ts` (unchanged).
- Produces:
  - `listProjects(): Promise<{ id: string; name: string }[]>`
  - `createProject(name: string): Promise<{ id: string; name: string }>`
  - `getDiagram(projectId: string, slug: string): Promise<{ diagram: Diagram; version: number }>`
  - `updateDiagram(projectId: string, slug: string, content: Pick<Diagram, 'nodes' | 'edges'>, expectedVersion: number): Promise<{ version: number } | { conflict: true }>`
  - `createDiagram(projectId: string, slug: string, title: string, notation: Diagram['notation'], content: Pick<Diagram, 'nodes' | 'edges'>): Promise<void>`

  These five functions are what Task 4 (`DiagramPage`) and Task 5 (project
  dashboard) call — no other module in this plan talks to `supabase` for
  diagram/project data directly.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/diagramRepo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockGetUser = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  },
}))

import { getDiagram, updateDiagram, createDiagram, listProjects, createProject } from './diagramRepo'

function chainable(result: unknown) {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    single: () => Promise.resolve(result),
    insert: () => chain,
    update: () => chain,
  }
  return chain
}

beforeEach(() => {
  mockFrom.mockReset()
})

describe('getDiagram', () => {
  it('returns the parsed diagram and its version', async () => {
    mockFrom.mockReturnValue(
      chainable({
        data: {
          id: 'diag-1',
          title: 'Deployment',
          notation: 'c4',
          content: { nodes: [], edges: [] },
          version: 3,
        },
        error: null,
      })
    )
    const result = await getDiagram('proj-1', 'deployment')
    expect(result.version).toBe(3)
    expect(result.diagram.title).toBe('Deployment')
    expect(result.diagram.nodes).toEqual([])
  })

  it('throws when the diagram row does not validate', async () => {
    mockFrom.mockReturnValue(
      chainable({
        data: { id: 'diag-1', title: 'Bad', notation: 'c4', content: { nodes: 'not-an-array', edges: [] }, version: 1 },
        error: null,
      })
    )
    await expect(getDiagram('proj-1', 'deployment')).rejects.toThrow()
  })
})

describe('updateDiagram', () => {
  it('returns the new version on success', async () => {
    mockFrom.mockReturnValue(
      chainable({ data: { version: 4 }, error: null })
    )
    const result = await updateDiagram('proj-1', 'deployment', { nodes: [], edges: [] }, 3)
    expect(result).toEqual({ version: 4 })
  })

  it('returns a conflict when no row matched the expected version', async () => {
    mockFrom.mockReturnValue(
      chainable({ data: null, error: { code: 'PGRST116' } })
    )
    const result = await updateDiagram('proj-1', 'deployment', { nodes: [], edges: [] }, 3)
    expect(result).toEqual({ conflict: true })
  })
})

describe('createDiagram', () => {
  it('inserts a new diagram row', async () => {
    mockFrom.mockReturnValue(chainable({ data: { id: 'new-diag' }, error: null }))
    await expect(
      createDiagram('proj-1', 'new-slug', 'New', 'c4', { nodes: [], edges: [] })
    ).resolves.toBeUndefined()
  })
})

describe('listProjects / createProject', () => {
  it('lists accessible projects', async () => {
    mockFrom.mockReturnValue({
      select: () => Promise.resolve({ data: [{ id: 'p1', name: 'Proj 1' }], error: null }),
    })
    const result = await listProjects()
    expect(result).toEqual([{ id: 'p1', name: 'Proj 1' }])
  })

  it('creates a project', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockReturnValue(chainable({ data: { id: 'p2', name: 'New Proj' }, error: null }))
    const result = await createProject('New Proj')
    expect(result).toEqual({ id: 'p2', name: 'New Proj' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- diagramRepo`
Expected: FAIL — `./diagramRepo` doesn't exist.

- [ ] **Step 3: Implement `diagramRepo.ts`**

Create `src/lib/diagramRepo.ts`:

```typescript
import { supabase } from './supabaseClient'
import { validateDiagramShape } from './validateDiagram'
import type { Diagram } from './types'

export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('projects').select('id, name')
  if (error) throw error
  return data ?? []
}

export async function createProject(name: string): Promise<{ id: string; name: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  // owner_id is required here, not optional: the projects table has
  // owner_id uuid not null with no column default (see the Supabase
  // backend plan's Task 2), and its RLS insert policy is
  // `with check (owner_id = auth.uid())` — the check evaluates the row as
  // sent, so the client must supply owner_id itself, a server-side
  // trigger/default would not satisfy the check.
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, owner_id: user.id })
    .select('id, name')
    .single()
  if (error) throw error
  return data
}

export async function getDiagram(
  projectId: string,
  slug: string
): Promise<{ diagram: Diagram; version: number }> {
  const { data, error } = await supabase
    .from('diagrams')
    .select('title, notation, content, version')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .single()
  if (error) throw error

  const raw = {
    id: slug,
    title: data.title,
    notation: data.notation,
    nodes: (data.content as { nodes: unknown }).nodes,
    edges: (data.content as { edges: unknown }).edges,
  }
  const diagram = validateDiagramShape(raw, slug)
  return { diagram, version: data.version }
}

export async function updateDiagram(
  projectId: string,
  slug: string,
  content: Pick<Diagram, 'nodes' | 'edges'>,
  expectedVersion: number
): Promise<{ version: number } | { conflict: true }> {
  const { data, error } = await supabase
    .from('diagrams')
    .update({ content, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('slug', slug)
    .eq('version', expectedVersion)
    .select('version')
    .single()

  if (error || !data) {
    return { conflict: true }
  }
  return { version: data.version }
}

export async function createDiagram(
  projectId: string,
  slug: string,
  title: string,
  notation: Diagram['notation'],
  content: Pick<Diagram, 'nodes' | 'edges'>
): Promise<void> {
  const { error } = await supabase
    .from('diagrams')
    .insert({ project_id: projectId, slug, title, notation, content })
  if (error) throw error
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- diagramRepo`
Expected: PASS, all cases.

- [ ] **Step 5: Delete the now-unused file-glob loader**

Run: `rm src/lib/loadDiagram.ts src/lib/loadDiagram.test.ts`

- [ ] **Step 6: Run the full test suite to confirm nothing else references the deleted module**

Run: `npm test`
Expected: fails only on `resolveDiagramPath.test.ts` and `DiagramPage.test.tsx`
(both import `loadDiagram` or assume its sync signature) — that's expected,
Task 4 fixes them. Confirm via:

Run: `rg -n "loadDiagram" src/`
Expected: matches only in `resolveDiagramPath.ts`, `resolveDiagramPath.test.ts`,
`DiagramPage.tsx` — the files Task 4 rewrites next.

- [ ] **Step 7: Commit**

```bash
git add src/lib/diagramRepo.ts src/lib/diagramRepo.test.ts
git rm src/lib/loadDiagram.ts src/lib/loadDiagram.test.ts
git commit -m "feat: replace file-glob diagram loading with supabase-backed diagramRepo"
```

---

### Task 4: `resolveDiagramPath` + `DiagramPage` — async, project-scoped

**Files:**
- Modify: `src/lib/resolveDiagramPath.ts`
- Modify: `src/lib/resolveDiagramPath.test.ts`
- Modify: `src/components/DiagramPage.tsx`
- Modify: `src/components/DiagramPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `getDiagram`, `updateDiagram` from Task 3's `diagramRepo.ts`.
- Produces: `resolveDiagramPath(projectId: string, segments: string[],
  loadFn: (projectId: string, slug: string) => Promise<{ diagram: Diagram;
  version: number }>): Promise<{ chain: { diagram: Diagram; version: number
  }[] }>` — root diagram is now always the project's `deployment` slug (same
  convention as today, now scoped to a project instead of the whole app).
  Later tasks (dashboard) navigate to `/projects/:projectId/` to enter a
  project's root diagram via this function.

- [ ] **Step 1: Update `resolveDiagramPath`'s failing test first**

Modify `src/lib/resolveDiagramPath.test.ts` — replace its full contents:

```typescript
import { describe, it, expect } from 'vitest'
import { resolveDiagramPath } from './resolveDiagramPath'
import { DiagramNotFoundError } from './types'
import type { Diagram } from './types'

const diagrams: Record<string, Diagram> = {
  deployment: {
    id: 'deployment',
    title: 'Deployment',
    notation: 'c4',
    nodes: [{ id: 'api', label: 'API', kind: 'service', childDiagram: 'api-components' }],
    edges: [],
  },
  'api-components': {
    id: 'api-components',
    title: 'API Components',
    notation: 'c4',
    nodes: [{ id: 'handler', label: 'Handler', kind: 'component' }],
    edges: [],
  },
}

async function fakeLoad(_projectId: string, slug: string) {
  const diagram = diagrams[slug]
  if (!diagram) throw new DiagramNotFoundError(slug)
  return { diagram, version: 1 }
}

describe('resolveDiagramPath', () => {
  it('resolves the root diagram with no segments', async () => {
    const result = await resolveDiagramPath('proj-1', [], fakeLoad)
    expect(result.chain).toHaveLength(1)
    expect(result.chain[0].diagram.id).toBe('deployment')
  })

  it('resolves a nested diagram by following childDiagram slugs', async () => {
    const result = await resolveDiagramPath('proj-1', ['api'], fakeLoad)
    expect(result.chain).toHaveLength(2)
    expect(result.chain[1].diagram.id).toBe('api-components')
  })

  it('throws DiagramNotFoundError for an unknown node id in the path', async () => {
    await expect(resolveDiagramPath('proj-1', ['does-not-exist'], fakeLoad)).rejects.toThrow(
      DiagramNotFoundError
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- resolveDiagramPath`
Expected: FAIL — current implementation is sync and single-arg.

- [ ] **Step 3: Rewrite `resolveDiagramPath.ts`**

Replace `src/lib/resolveDiagramPath.ts`:

```typescript
import type { Diagram } from './types'
import { DiagramNotFoundError } from './types'

export interface LoadedDiagram {
  diagram: Diagram
  version: number
}

export interface ResolvedDiagramPath {
  chain: LoadedDiagram[]
}

export async function resolveDiagramPath(
  projectId: string,
  segments: string[],
  loadFn: (projectId: string, slug: string) => Promise<LoadedDiagram>
): Promise<ResolvedDiagramPath> {
  const root = await loadFn(projectId, 'deployment')
  const chain: LoadedDiagram[] = [root]
  let current = root.diagram

  for (const nodeId of segments) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node || !node.childDiagram) {
      throw new DiagramNotFoundError(nodeId)
    }
    const loaded = await loadFn(projectId, node.childDiagram)
    chain.push(loaded)
    current = loaded.diagram
  }

  return { chain }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- resolveDiagramPath`
Expected: PASS, 3/3.

- [ ] **Step 5: Rewrite `DiagramPage.tsx`**

Replace `src/components/DiagramPage.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getDiagram, updateDiagram } from '../lib/diagramRepo'
import { resolveDiagramPath } from '../lib/resolveDiagramPath'
import { validateDiagramShape } from '../lib/validateDiagram'
import { DiagramNotFoundError } from '../lib/types'
import type { Diagram } from '../lib/types'
import { layoutDiagram } from '../lib/autoLayout'
import { DiagramCanvas } from './DiagramCanvas'
import { Breadcrumb } from './Breadcrumb'
import { SidePanel } from './SidePanel'

type LoadedDiagram = { diagram: Diagram; version: number }
type Resolution =
  | { status: 'loading' }
  | { status: 'error'; notFoundId: string }
  | { status: 'ready'; chain: LoadedDiagram[] }

export function DiagramPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const params = useParams()
  const navigate = useNavigate()
  const segments = useMemo(
    () => (params['*'] ?? '').split('/').filter(Boolean),
    [params['*']]
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [resolution, setResolution] = useState<Resolution>({ status: 'loading' })
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    setResolution({ status: 'loading' })
    resolveDiagramPath(projectId, segments, getDiagram)
      .then((r) => setResolution({ status: 'ready', chain: r.chain }))
      .catch((err) => {
        if (err instanceof DiagramNotFoundError) {
          setResolution({ status: 'error', notFoundId: err.diagramId })
        } else {
          throw err
        }
      })
  }, [projectId, segments])

  if (resolution.status === 'loading') return null

  if (resolution.status === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          gap: 8,
          background: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Diagram not found</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-muted)' }}>
          {resolution.notFoundId}
        </span>
      </div>
    )
  }

  const { chain } = resolution
  const { diagram: current, version: currentVersion } = chain[chain.length - 1]
  const positionedNodes = layoutDiagram(current.nodes, current.edges)
  const labels = ['Home', ...chain.slice(1).map((d) => d.diagram.title)]
  const selectedNode = current.nodes.find((n) => n.id === selectedNodeId) ?? null

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/projects/${projectId}/${[...segments, nodeId].join('/')}`)
  }

  function handleNodeDetailRequest(nodeId: string) {
    setSelectedNodeId(nodeId)
    setPanelCollapsed(false)
  }

  function handleBreadcrumbNavigate(index: number) {
    setSelectedNodeId(null)
    navigate(`/projects/${projectId}/${segments.slice(0, index).join('/')}`)
  }

  async function handleApplyJson(raw: string): Promise<string | null> {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      return `Invalid JSON: ${(err as Error).message}`
    }
    let diagram: Diagram
    try {
      diagram = validateDiagramShape(parsed, current.id)
    } catch (err) {
      return (err as Error).message
    }

    const currentSlug = segments.length === 0 ? 'deployment' : current.id
    const result = await updateDiagram(
      projectId!,
      currentSlug,
      { nodes: diagram.nodes, edges: diagram.edges },
      currentVersion
    )
    if ('conflict' in result) {
      setConflictMessage(
        'This diagram changed since you loaded it (edited elsewhere or by an MCP-connected agent). Reload to see the latest version before retrying.'
      )
      return 'Save conflict: the diagram was updated elsewhere. Reload and reapply your changes.'
    }
    setConflictMessage(null)
    const refreshed = await resolveDiagramPath(projectId!, segments, getDiagram)
    setResolution({ status: 'ready', chain: refreshed.chain })
    return null
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        padding: 12,
        gap: 12,
        background: 'var(--bg)',
        boxSizing: 'border-box',
      }}
    >
      {conflictMessage && (
        <div role="alert" style={{ color: 'var(--error)', fontSize: 13 }}>
          {conflictMessage}
        </div>
      )}
      <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DiagramCanvas
            nodes={positionedNodes}
            edges={current.edges}
            onNodeClick={handleNodeClick}
            onNodeDetailRequest={handleNodeDetailRequest}
          />
        </div>
        <SidePanel
          node={selectedNode}
          notation={current.notation ?? 'c4'}
          onCloseNode={() => setSelectedNodeId(null)}
          diagramJson={JSON.stringify(current, null, 2)}
          onApplyJson={handleApplyJson}
          collapsed={panelCollapsed}
          onToggleCollapsed={() => setPanelCollapsed((c) => !c)}
        />
      </div>
    </div>
  )
}
```

Note: `SidePanel`'s `onApplyJson` prop type changes from
`(raw: string) => string | null` to `(raw: string) => Promise<string | null>`
— update `src/components/SidePanel.tsx`'s `SidePanelProps` and its
`handleApply` function (`async function handleApply() { setJsonError(await
onApplyJson(jsonText)) }`) as part of this step, and drop the now-inaccurate
"not written back to the diagram file" helper text (replace with "Saved to
your account — conflicts are detected if edited elsewhere at the same
time.").

- [ ] **Step 6: Update `App.tsx`'s catch-all route to be project-scoped**

`src/App.tsx`'s `/projects/:projectId/*` route (added in Task 2 Step 10)
already matches `DiagramPage`'s new `useParams<{ projectId: string }>()` —
no further change needed here beyond confirming it via Step 8's test run.

- [ ] **Step 7: Update `DiagramPage.test.tsx` and `App.test.tsx`**

Both existing test files mock/exercise the old sync `loadDiagram`-based
flow. Update `src/components/DiagramPage.test.tsx` to mock
`../lib/diagramRepo`'s `getDiagram` (returning `Promise.resolve({ diagram,
version: 1 })`) instead of `../lib/loadDiagram`, and wrap renders in
`await waitFor(...)` for the now-async resolution (the exact assertions
being tested — breadcrumb rendering, node click navigation, JSON apply —
stay the same; only the mock target and the async wrapper change). Update
`src/App.test.tsx`'s route paths from `/` to `/projects/test-project-id/` to
match the new route shape.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: PASS across all files. `SidePanel.test.tsx` may also need its
`onApplyJson` mock changed from returning a string to returning a resolved
promise — fix if it fails, following the same pattern as Step 7.

- [ ] **Step 9: Commit**

```bash
git add src/lib/resolveDiagramPath.ts src/lib/resolveDiagramPath.test.ts src/components/DiagramPage.tsx src/components/DiagramPage.test.tsx src/components/SidePanel.tsx src/components/SidePanel.test.tsx src/App.test.tsx
git commit -m "feat: make diagram resolution async and project-scoped, wire optimistic-locking conflicts into Edit JSON"
```

---

### Task 5: Project dashboard (list + create)

**Files:**
- Create: `src/components/ProjectDashboard.tsx`
- Create: `src/components/ProjectDashboard.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `listProjects`, `createProject` from `diagramRepo.ts` (Task 3).
- Produces: the `/projects` route — the app's post-login landing page.

- [ ] **Step 1: Write the failing test**

Create `src/components/ProjectDashboard.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProjectDashboard } from './ProjectDashboard'

vi.mock('../lib/diagramRepo', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
}))

import { listProjects, createProject } from '../lib/diagramRepo'

describe('ProjectDashboard', () => {
  it('lists existing projects', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'My Repo' }])
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)
    expect(await screen.findByText('My Repo')).toBeInTheDocument()
  })

  it('creates a new project and adds it to the list', async () => {
    vi.mocked(listProjects).mockResolvedValue([])
    vi.mocked(createProject).mockResolvedValue({ id: 'p2', name: 'New One' })
    render(<MemoryRouter><ProjectDashboard /></MemoryRouter>)
    await waitFor(() => expect(listProjects).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'New One' } })
    fireEvent.click(screen.getByText('Create project'))

    expect(await screen.findByText('New One')).toBeInTheDocument()
    expect(createProject).toHaveBeenCalledWith('New One')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ProjectDashboard`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `ProjectDashboard.tsx`**

Create `src/components/ProjectDashboard.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, createProject } from '../lib/diagramRepo'

interface Project {
  id: string
  name: string
}

export function ProjectDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [newName, setNewName] = useState('')

  useEffect(() => {
    listProjects().then(setProjects)
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    const created = await createProject(newName)
    setProjects((prev) => [...prev, created])
    setNewName('')
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Your projects</h1>
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <Link to={`/projects/${p.id}/`}>{p.name}</Link>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <label htmlFor="project-name">Project name</label>
        <input id="project-name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit">Create project</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- ProjectDashboard`
Expected: PASS, both cases.

- [ ] **Step 5: Wire the route**

Modify `src/App.tsx` — add the dashboard route inside the authenticated
section, alongside the existing `/projects/:projectId/*` route:

```typescript
<Route
  path="/projects"
  element={
    <RequireAuth>
      <ProjectDashboard />
    </RequireAuth>
  }
/>
```

Add the corresponding import: `import { ProjectDashboard } from
'./components/ProjectDashboard'`.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS across all files.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProjectDashboard.tsx src/components/ProjectDashboard.test.tsx src/App.tsx
git commit -m "feat: add project dashboard as the post-login landing page"
```

---

### Task 6: Sharing screen (collaborators)

**Files:**
- Create: `src/lib/collaboratorRepo.ts`
- Create: `src/lib/collaboratorRepo.test.ts`
- Create: `src/components/ShareProjectPanel.tsx`
- Create: `src/components/ShareProjectPanel.test.tsx`

**Interfaces:**
- Consumes: `supabase` from Task 1.
- Produces:
  - `listCollaborators(projectId: string): Promise<{ userId: string; email: string; role: 'viewer' | 'editor' }[]>`
  - `inviteCollaborator(projectId: string, email: string, role: 'viewer' | 'editor'): Promise<void>`

  This task's repo function set is independent of `diagramRepo.ts` — kept in
  its own file because it operates on `project_members`, a different
  concern from diagram content, matching the "files that change together
  live together, split by responsibility" guidance.

- [ ] **Step 1: Write the failing repo test**

Create `src/lib/collaboratorRepo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args), rpc: (...args: unknown[]) => mockRpc(...args) },
}))

import { listCollaborators, inviteCollaborator } from './collaboratorRepo'

beforeEach(() => {
  mockFrom.mockReset()
  mockRpc.mockReset()
})

describe('listCollaborators', () => {
  it('returns member rows with email and role', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ user_id: 'u1', role: 'viewer', users: { email: 'a@example.com' } }],
            error: null,
          }),
      }),
    })
    const result = await listCollaborators('proj-1')
    expect(result).toEqual([{ userId: 'u1', email: 'a@example.com', role: 'viewer' }])
  })
})

describe('inviteCollaborator', () => {
  it('calls the invite_collaborator_by_email rpc', async () => {
    mockRpc.mockResolvedValue({ error: null })
    await inviteCollaborator('proj-1', 'new@example.com', 'editor')
    expect(mockRpc).toHaveBeenCalledWith('invite_collaborator_by_email', {
      p_project_id: 'proj-1',
      p_email: 'new@example.com',
      p_role: 'editor',
    })
  })

  it('throws when the rpc errors (e.g. no matching user)', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'No user with that email' } })
    await expect(inviteCollaborator('proj-1', 'nobody@example.com', 'viewer')).rejects.toThrow(
      'No user with that email'
    )
  })
})
```

Note on design: inviting "by email" requires resolving an email to a
`auth.users.id`, which the anon-key client cannot query directly (`auth.users`
is not exposed to PostgREST). This task therefore also requires a small
Postgres function (`invite_collaborator_by_email`) exposed via RPC, added as
a migration in the Supabase backend plan's repo — added here as a follow-up
migration since it's specific to this frontend feature's needs and wasn't
anticipated in that plan's original 4 tasks.

- [ ] **Step 2: Add the missing RPC migration**

Run: `supabase migration new invite_collaborator_by_email`

Write into the generated file:

```sql
create or replace function invite_collaborator_by_email(
  p_project_id uuid,
  p_email text,
  p_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if p_role not in ('viewer', 'editor') then
    raise exception 'invalid role: %', p_role;
  end if;

  if not exists (
    select 1 from projects where id = p_project_id and owner_id = auth.uid()
  ) then
    raise exception 'only the project owner can invite collaborators';
  end if;

  select id into v_user_id from auth.users where email = p_email;
  if v_user_id is null then
    raise exception 'No user with that email';
  end if;

  insert into project_members (project_id, user_id, role)
  values (p_project_id, v_user_id, p_role)
  on conflict (project_id, user_id) do update set role = excluded.role;
end;
$$;
```

Run: `supabase db reset` (from the architecture-map repo root, with the
local stack from the backend plan running)
Expected: no errors.

- [ ] **Step 3: Run the frontend test to verify it fails**

Run: `npm test -- collaboratorRepo`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 4: Implement `collaboratorRepo.ts`**

Create `src/lib/collaboratorRepo.ts`:

```typescript
import { supabase } from './supabaseClient'

export interface Collaborator {
  userId: string
  email: string
  role: 'viewer' | 'editor'
}

export async function listCollaborators(projectId: string): Promise<Collaborator[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('user_id, role, users:user_id(email)')
    .eq('project_id', projectId)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    userId: row.user_id,
    email: row.users.email,
    role: row.role,
  }))
}

export async function inviteCollaborator(
  projectId: string,
  email: string,
  role: 'viewer' | 'editor'
): Promise<void> {
  const { error } = await supabase.rpc('invite_collaborator_by_email', {
    p_project_id: projectId,
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- collaboratorRepo`
Expected: PASS, all cases.

- [ ] **Step 6: Write the failing component test**

Create `src/components/ShareProjectPanel.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShareProjectPanel } from './ShareProjectPanel'

vi.mock('../lib/collaboratorRepo', () => ({
  listCollaborators: vi.fn(),
  inviteCollaborator: vi.fn(),
}))

import { listCollaborators, inviteCollaborator } from '../lib/collaboratorRepo'

describe('ShareProjectPanel', () => {
  it('lists current collaborators', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([
      { userId: 'u1', email: 'friend@example.com', role: 'viewer' },
    ])
    render(<ShareProjectPanel projectId="proj-1" />)
    expect(await screen.findByText('friend@example.com')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
  })

  it('invites a new collaborator', async () => {
    vi.mocked(listCollaborators).mockResolvedValue([])
    vi.mocked(inviteCollaborator).mockResolvedValue(undefined)
    render(<ShareProjectPanel projectId="proj-1" />)
    await waitFor(() => expect(listCollaborators).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Collaborator email'), {
      target: { value: 'new@example.com' },
    })
    fireEvent.click(screen.getByText('Invite as viewer'))

    await waitFor(() =>
      expect(inviteCollaborator).toHaveBeenCalledWith('proj-1', 'new@example.com', 'viewer')
    )
  })
})
```

- [ ] **Step 7: Run to verify it fails**

Run: `npm test -- ShareProjectPanel`
Expected: FAIL — module doesn't exist.

- [ ] **Step 8: Implement `ShareProjectPanel.tsx`**

Create `src/components/ShareProjectPanel.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { listCollaborators, inviteCollaborator, type Collaborator } from '../lib/collaboratorRepo'

export function ShareProjectPanel({ projectId }: { projectId: string }) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [email, setEmail] = useState('')

  useEffect(() => {
    listCollaborators(projectId).then(setCollaborators)
  }, [projectId])

  async function handleInvite(role: 'viewer' | 'editor') {
    if (!email.trim()) return
    await inviteCollaborator(projectId, email, role)
    const refreshed = await listCollaborators(projectId)
    setCollaborators(refreshed)
    setEmail('')
  }

  return (
    <div>
      <h2>Collaborators</h2>
      <ul>
        {collaborators.map((c) => (
          <li key={c.userId}>
            {c.email} — {c.role}
          </li>
        ))}
      </ul>
      <label htmlFor="collab-email">Collaborator email</label>
      <input id="collab-email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button onClick={() => handleInvite('viewer')}>Invite as viewer</button>
      <button onClick={() => handleInvite('editor')}>Invite as editor</button>
    </div>
  )
}
```

- [ ] **Step 9: Run to verify it passes**

Run: `npm test -- ShareProjectPanel`
Expected: PASS, both cases.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations src/lib/collaboratorRepo.ts src/lib/collaboratorRepo.test.ts src/components/ShareProjectPanel.tsx src/components/ShareProjectPanel.test.tsx
git commit -m "feat: add project sharing (invite collaborators by email)"
```

---

### Task 7: MCP integration settings (per-project access toggles)

**Files:**
- Create: `src/lib/mcpGrantRepo.ts`
- Create: `src/lib/mcpGrantRepo.test.ts`
- Create: `src/components/McpIntegrationSettings.tsx`
- Create: `src/components/McpIntegrationSettings.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `supabase` from Task 1; `listProjects` from `diagramRepo.ts`
  (Task 3).
- Produces:
  - `listMcpGrants(): Promise<Set<string>>` (set of `project_id`s currently
    granted)
  - `setMcpGrant(projectId: string, granted: boolean): Promise<void>`
  - The `/settings/integrations` route.

- [ ] **Step 1: Write the failing repo test**

Create `src/lib/mcpGrantRepo.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockAuth = { getUser: vi.fn() }
vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args), auth: mockAuth },
}))

import { listMcpGrants, setMcpGrant } from './mcpGrantRepo'

beforeEach(() => {
  mockFrom.mockReset()
  mockAuth.getUser.mockReset()
  mockAuth.getUser.mockResolvedValue({ data: { user: { id: 'me' } } })
})

describe('listMcpGrants', () => {
  it('returns the set of granted project ids', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => Promise.resolve({ data: [{ project_id: 'p1' }], error: null }) }),
    })
    const result = await listMcpGrants()
    expect(result).toEqual(new Set(['p1']))
  })
})

describe('setMcpGrant', () => {
  it('inserts a grant when enabling', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert })
    await setMcpGrant('p1', true)
    expect(insert).toHaveBeenCalledWith({ project_id: 'p1', user_id: 'me' })
  })

  it('deletes the grant when disabling', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null })
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    mockFrom.mockReturnValue({ delete: () => ({ eq: eq1 }) })
    await setMcpGrant('p1', false)
    expect(eq1).toHaveBeenCalledWith('project_id', 'p1')
    expect(eq2).toHaveBeenCalledWith('user_id', 'me')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- mcpGrantRepo`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `mcpGrantRepo.ts`**

Create `src/lib/mcpGrantRepo.ts`:

```typescript
import { supabase } from './supabaseClient'

export async function listMcpGrants(): Promise<Set<string>> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Set()
  const { data, error } = await supabase
    .from('mcp_project_grants')
    .select('project_id')
    .eq('user_id', user.id)
  if (error) throw error
  return new Set((data ?? []).map((row: { project_id: string }) => row.project_id))
}

export async function setMcpGrant(projectId: string, granted: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  if (granted) {
    const { error } = await supabase.from('mcp_project_grants').insert({
      project_id: projectId,
      user_id: user.id,
    })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('mcp_project_grants')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', user.id)
    if (error) throw error
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- mcpGrantRepo`
Expected: PASS, all cases.

- [ ] **Step 5: Write the failing component test**

Create `src/components/McpIntegrationSettings.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { McpIntegrationSettings } from './McpIntegrationSettings'

vi.mock('../lib/diagramRepo', () => ({ listProjects: vi.fn() }))
vi.mock('../lib/mcpGrantRepo', () => ({ listMcpGrants: vi.fn(), setMcpGrant: vi.fn() }))

import { listProjects } from '../lib/diagramRepo'
import { listMcpGrants, setMcpGrant } from '../lib/mcpGrantRepo'

describe('McpIntegrationSettings', () => {
  it('shows a toggle per project reflecting current grant state', async () => {
    vi.mocked(listProjects).mockResolvedValue([
      { id: 'p1', name: 'Granted Repo' },
      { id: 'p2', name: 'Ungranted Repo' },
    ])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set(['p1']))

    render(<McpIntegrationSettings />)

    const granted = await screen.findByLabelText('Granted Repo')
    const ungranted = screen.getByLabelText('Ungranted Repo')
    expect(granted).toBeChecked()
    expect(ungranted).not.toBeChecked()
  })

  it('toggling a project calls setMcpGrant', async () => {
    vi.mocked(listProjects).mockResolvedValue([{ id: 'p1', name: 'Repo' }])
    vi.mocked(listMcpGrants).mockResolvedValue(new Set())
    vi.mocked(setMcpGrant).mockResolvedValue(undefined)

    render(<McpIntegrationSettings />)
    const toggle = await screen.findByLabelText('Repo')
    fireEvent.click(toggle)

    await waitFor(() => expect(setMcpGrant).toHaveBeenCalledWith('p1', true))
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npm test -- McpIntegrationSettings`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Implement `McpIntegrationSettings.tsx`**

Create `src/components/McpIntegrationSettings.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { listProjects } from '../lib/diagramRepo'
import { listMcpGrants, setMcpGrant } from '../lib/mcpGrantRepo'

interface Project {
  id: string
  name: string
}

export function McpIntegrationSettings() {
  const [projects, setProjects] = useState<Project[]>([])
  const [granted, setGranted] = useState<Set<string>>(new Set())

  useEffect(() => {
    listProjects().then(setProjects)
    listMcpGrants().then(setGranted)
  }, [])

  async function handleToggle(projectId: string, next: boolean) {
    await setMcpGrant(projectId, next)
    setGranted((prev) => {
      const updated = new Set(prev)
      if (next) updated.add(projectId)
      else updated.delete(projectId)
      return updated
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>MCP access</h1>
      <p>Choose which projects an MCP-connected AI agent (e.g. Claude Code) can read and write.</p>
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <label htmlFor={`mcp-grant-${p.id}`}>{p.name}</label>
            <input
              id={`mcp-grant-${p.id}`}
              aria-label={p.name}
              type="checkbox"
              checked={granted.has(p.id)}
              onChange={(e) => handleToggle(p.id, e.target.checked)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `npm test -- McpIntegrationSettings`
Expected: PASS, both cases.

- [ ] **Step 9: Wire the route**

Modify `src/App.tsx` — add:

```typescript
<Route
  path="/settings/integrations"
  element={
    <RequireAuth>
      <McpIntegrationSettings />
    </RequireAuth>
  }
/>
```

Add the import: `import { McpIntegrationSettings } from
'./components/McpIntegrationSettings'`.

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: PASS across all files.

- [ ] **Step 11: Commit**

```bash
git add src/lib/mcpGrantRepo.ts src/lib/mcpGrantRepo.test.ts src/components/McpIntegrationSettings.tsx src/components/McpIntegrationSettings.test.tsx src/App.tsx
git commit -m "feat: add per-project MCP access settings screen"
```

---

### Task 8: Retire the local `diagrams/` example files and update README

**Files:**
- Modify: `README.md`
- Modify: `scripts/validate-diagrams.ts` (or delete, see step 1)
- Delete: `diagrams/*.json` (optional — see step 1)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by other tasks — final documentation cleanup.

- [ ] **Step 1: Decide the fate of `scripts/validate-diagrams.ts` and `diagrams/`**

Run: `rg -n "diagrams/" scripts/validate-diagrams.ts package.json`
Expected: shows the `npm run validate` script and its glob over
`diagrams/*.json`. Since the app no longer reads these files (Task 3, Step
5), keep `diagrams/*.json` and `scripts/validate-diagrams.ts` in the repo
as **reference examples of the JSON shape** (useful for anyone authoring
diagrams manually or via MCP tooling, and for `validateDiagramShape`'s own
test fixtures) but remove the `npm run validate` script's implication that
it validates "the app's" diagrams — reword its README section instead of
deleting the files, per Step 2.

- [ ] **Step 2: Update the README**

Modify `README.md`: replace the "Usage" section's `npm run dev` instructions
to mention Supabase setup (point to the "Backend (Supabase)" section added
by the Supabase backend plan), and reword the "Authoring diagrams" section's
opening line from "Every diagram is one JSON file under `diagrams/`" to:

```markdown
## Authoring diagrams

Diagrams are stored in Supabase, not local files — create and edit them from
the web app, or via the MCP server. `diagrams/*.json` in this repo are
reference examples of the JSON shape only (used by `scripts/validate-diagrams.ts`
as a schema-validation fixture) — editing them has no effect on the running
app.
```

Also update the "Known limitation" section if the `vite`/`vitest` build issue
it references is unrelated to this plan's changes — verify by running the
command it references (Step 3) rather than assuming it's still accurate.

- [ ] **Step 3: Verify the README's claims**

Run: `npm run validate`
Expected: still passes (validates the example fixtures, unchanged behavior).

Run: `npm run build`
Expected: same outcome as before this plan (the known `tsc`/`vite`/`vitest`
mismatch, unrelated to this plan's changes) — confirm the failure reason is
unchanged, not newly broken by this plan's code.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: clarify diagrams/ is a reference fixture, not the app's data source"
```

---

## Self-Review Notes

- **Spec coverage:** auth (magic link via Supabase Auth), project dashboard,
  diagram viewing/editing against Supabase with optimistic-locking conflict
  surfacing, sharing (owner invites viewer/editor), and per-project MCP
  access toggles are all covered. Workspaces remain explicitly out of scope
  (no UI added for `workspace_id`), matching the design doc.
- **Untouched-by-design files verified:** `nodeShapes.tsx`, `autoLayout.ts`,
  `DiagramCanvas.tsx`, `LegendTab.tsx`, `buildFlowEdges.ts`,
  `edgeGeometry.ts`, `umlMarkers.tsx`, `techIcons.ts` appear in no task's
  Files/Modify list.
- **Type consistency:** `getDiagram`'s return shape (`{ diagram, version }`)
  is used identically in `resolveDiagramPath` (Task 4), `DiagramPage` (Task
  4), and is the same shape asserted in Task 3's tests — no drift between
  tasks.
- **Auth method note:** magic-link (`signInWithOtp`) was chosen over
  password auth as the simplest Supabase-native flow requiring no additional
  UI (no password reset screens, etc.) — not specified in the design doc,
  flagged here as an implementation-level default rather than a re-litigated
  design decision; swap for password or OAuth-social login later if desired
  without affecting any other task in this plan.
