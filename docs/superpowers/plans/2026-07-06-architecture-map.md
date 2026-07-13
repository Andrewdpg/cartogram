# Architecture Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal, project-agnostic React tool that renders an interactive, recursively drill-down-able architecture map from hand-authored JSON files, one file per diagram.

**Architecture:** Vite + React + TypeScript SPA. `@xyflow/react` renders each diagram's nodes/edges; `dagre` auto-computes layout. React Router's URL path IS the drill-down stack — each segment is the id of the node that was clicked in the previous diagram. All diagram content lives under `diagrams/*.json`, discovered via `import.meta.glob`; the rest of the app is content-agnostic and reusable as-is for other projects (swap the `diagrams/` folder).

**Tech Stack:** React 18, TypeScript 5, Vite 6, `@xyflow/react` (React Flow v12), `dagre`, `react-router-dom` 6, Vitest + `@testing-library/react` for tests, `tsx` to run the validation script.

## Global Constraints

- One diagram = one JSON file under `diagrams/`, regardless of conceptual "level" (spec: Data format).
- Navigation is full drill-down only — no inline/nested node expansion (spec: Non-goals, Navigation).
- No coordinates in diagram JSON by default — `dagre` computes `x`/`y`; a node may set its own `x`/`y` to override (spec: Layout).
- `diagrams/` is the only project-specific content; no central registry file (spec: Reusability).
- A missing `childDiagram` reference must produce a friendly "not found" state, not a crash (spec: Error handling).
- The validation script (`npm run validate`) must catch: (1) edges referencing unknown node ids within a diagram, (2) `childDiagram` referencing a file that doesn't exist (spec: Validation script).

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/setupTests.ts`
- Create: `src/App.tsx`
- Create: `src/App.test.tsx`
- Create: `.gitignore`

**Interfaces:**
- Produces: `App` (default export from `src/App.tsx`), a placeholder component later replaced in Task 10.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "architecture-map",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "validate": "tsx scripts/validate-diagrams.ts"
  },
  "dependencies": {
    "@xyflow/react": "^12.3.0",
    "dagre": "^0.8.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/dagre": "^0.7.52",
    "@types/node": "^22.9.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vite": "^6.0.1",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "scripts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
  },
})
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Architecture Map</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 7: Write `src/setupTests.ts`**

```ts
import '@testing-library/jest-dom'

// ponytail: @xyflow/react measures nodes via ResizeObserver, which jsdom
// doesn't implement. A no-op stub is enough for render/interaction tests —
// we never assert on measured sizes.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).ResizeObserver = ResizeObserverStub
```

- [ ] **Step 8: Write placeholder `src/App.tsx`**

```tsx
export function App() {
  return <div>Architecture Map</div>
}
```

- [ ] **Step 9: Write the failing test `src/App.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('renders the placeholder heading', () => {
    render(<App />)
    expect(screen.getByText('Architecture Map')).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Install dependencies and run the test**

Run: `npm install && npm test`
Expected: PASS — `App > renders the placeholder heading`

- [ ] **Step 11: Write `.gitignore`**

```
node_modules
dist
*.local
```

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS project with Vitest"
```

---

## Task 2: Diagram types and pure validation

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/validateDiagram.ts`
- Create: `src/lib/validateDiagram.test.ts`

**Interfaces:**
- Produces:
  - `DiagramNodeData { id: string; label: string; kind: string; childDiagram?: string; x?: number; y?: number }`
  - `DiagramEdgeData { from: string; to: string; label?: string }`
  - `Diagram { id: string; title: string; nodes: DiagramNodeData[]; edges: DiagramEdgeData[] }`
  - `DiagramNotFoundError extends Error` (constructed with `diagramId: string`, exposes `.diagramId`)
  - `InvalidDiagramError extends Error`
  - `validateDiagramShape(raw: unknown, diagramId: string): Diagram` — throws `InvalidDiagramError` on malformed input.
  - `checkCrossFileReferences(diagrams: Record<string, Diagram>): string[]` — returns human-readable error strings, empty array if all `childDiagram` references resolve.

- [ ] **Step 1: Write `src/lib/types.ts`**

```ts
export interface DiagramNodeData {
  id: string
  label: string
  kind: string
  childDiagram?: string
  x?: number
  y?: number
}

export interface DiagramEdgeData {
  from: string
  to: string
  label?: string
}

export interface Diagram {
  id: string
  title: string
  nodes: DiagramNodeData[]
  edges: DiagramEdgeData[]
}

export class DiagramNotFoundError extends Error {
  constructor(public diagramId: string) {
    super(`Diagram not found: ${diagramId}`)
    this.name = 'DiagramNotFoundError'
  }
}
```

- [ ] **Step 2: Write the failing tests `src/lib/validateDiagram.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validateDiagramShape, checkCrossFileReferences, InvalidDiagramError } from './validateDiagram'
import type { Diagram } from './types'

describe('validateDiagramShape', () => {
  it('accepts a well-formed diagram', () => {
    const raw = {
      id: 'deployment',
      title: 'Deployment',
      nodes: [{ id: 'a', label: 'A', kind: 'service' }],
      edges: [],
    }
    expect(validateDiagramShape(raw, 'deployment')).toEqual(raw)
  })

  it('rejects a non-object', () => {
    expect(() => validateDiagramShape(null, 'x')).toThrow(InvalidDiagramError)
  })

  it('rejects a diagram missing "nodes"', () => {
    const raw = { id: 'x', title: 'X', edges: [] }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/nodes/)
  })

  it('rejects an edge referencing an unknown node', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [{ id: 'a', label: 'A', kind: 'service' }],
      edges: [{ from: 'a', to: 'ghost' }],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/ghost/)
  })
})

describe('checkCrossFileReferences', () => {
  it('returns no errors when every childDiagram exists', () => {
    const diagrams: Record<string, Diagram> = {
      deployment: {
        id: 'deployment',
        title: 'Deployment',
        nodes: [{ id: 'svc', label: 'Svc', kind: 'service', childDiagram: 'svc.components' }],
        edges: [],
      },
      'svc.components': { id: 'svc.components', title: 'Svc components', nodes: [], edges: [] },
    }
    expect(checkCrossFileReferences(diagrams)).toEqual([])
  })

  it('flags a childDiagram that does not exist', () => {
    const diagrams: Record<string, Diagram> = {
      deployment: {
        id: 'deployment',
        title: 'Deployment',
        nodes: [{ id: 'svc', label: 'Svc', kind: 'service', childDiagram: 'ghost' }],
        edges: [],
      },
    }
    const errors = checkCrossFileReferences(diagrams)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatch(/ghost/)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- validateDiagram`
Expected: FAIL — `validateDiagram.ts` does not exist yet

- [ ] **Step 4: Write `src/lib/validateDiagram.ts`**

```ts
import type { Diagram } from './types'

export class InvalidDiagramError extends Error {
  constructor(diagramId: string, reason: string) {
    super(`Invalid diagram "${diagramId}": ${reason}`)
    this.name = 'InvalidDiagramError'
  }
}

export function validateDiagramShape(raw: unknown, diagramId: string): Diagram {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidDiagramError(diagramId, 'not an object')
  }
  const d = raw as Partial<Diagram>

  if (typeof d.id !== 'string') throw new InvalidDiagramError(diagramId, 'missing "id"')
  if (typeof d.title !== 'string') throw new InvalidDiagramError(diagramId, 'missing "title"')
  if (!Array.isArray(d.nodes)) throw new InvalidDiagramError(diagramId, 'missing "nodes" array')
  if (!Array.isArray(d.edges)) throw new InvalidDiagramError(diagramId, 'missing "edges" array')

  const nodeIds = new Set(d.nodes.map((n) => n.id))
  for (const edge of d.edges) {
    if (!nodeIds.has(edge.from)) {
      throw new InvalidDiagramError(diagramId, `edge references unknown node "${edge.from}"`)
    }
    if (!nodeIds.has(edge.to)) {
      throw new InvalidDiagramError(diagramId, `edge references unknown node "${edge.to}"`)
    }
  }

  return d as Diagram
}

export function checkCrossFileReferences(diagrams: Record<string, Diagram>): string[] {
  const errors: string[] = []
  for (const [id, diagram] of Object.entries(diagrams)) {
    for (const node of diagram.nodes) {
      if (node.childDiagram && !(node.childDiagram in diagrams)) {
        errors.push(`${id}: node "${node.id}" references missing childDiagram "${node.childDiagram}"`)
      }
    }
  }
  return errors
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- validateDiagram`
Expected: PASS — all 6 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/validateDiagram.ts src/lib/validateDiagram.test.ts
git commit -m "feat: add diagram types and pure shape validation"
```

---

## Task 3: Sample diagram data and `loadDiagram`

**Files:**
- Create: `diagrams/deployment.json`
- Create: `diagrams/api-service.components.json`
- Create: `diagrams/auth-module.flow.json`
- Create: `src/lib/loadDiagram.ts`
- Create: `src/lib/loadDiagram.test.ts`

**Interfaces:**
- Consumes: `validateDiagramShape`, `Diagram`, `DiagramNotFoundError` (Task 2)
- Produces: `loadDiagram(id: string): Diagram` — synchronous, throws `DiagramNotFoundError` if `id` has no matching file under `diagrams/`.

This task also seeds a working 3-level example (`deployment` → `api-service.components` → `auth-module.flow`) so the app has something real to render from Task 9 onward, and so the validation script (Task 11) has real content to check.

- [ ] **Step 1: Write `diagrams/deployment.json`**

```json
{
  "id": "deployment",
  "title": "Deployment",
  "nodes": [
    { "id": "web-frontend", "label": "Web Frontend", "kind": "external" },
    { "id": "api-service", "label": "API Service", "kind": "service", "childDiagram": "api-service.components" },
    { "id": "database", "label": "Database", "kind": "database" }
  ],
  "edges": [
    { "from": "web-frontend", "to": "api-service", "label": "HTTPS" },
    { "from": "api-service", "to": "database", "label": "SQL" }
  ]
}
```

- [ ] **Step 2: Write `diagrams/api-service.components.json`**

```json
{
  "id": "api-service.components",
  "title": "API Service — Components",
  "nodes": [
    { "id": "auth-module", "label": "Auth Module", "kind": "component", "childDiagram": "auth-module.flow" },
    { "id": "orders-module", "label": "Orders Module", "kind": "component" }
  ],
  "edges": [
    { "from": "auth-module", "to": "orders-module", "label": "authorizes" }
  ]
}
```

- [ ] **Step 3: Write `diagrams/auth-module.flow.json`**

```json
{
  "id": "auth-module.flow",
  "title": "Auth Module — Flow",
  "nodes": [
    { "id": "validate-credentials", "label": "Validate credentials", "kind": "component" },
    { "id": "issue-token", "label": "Issue token", "kind": "component" }
  ],
  "edges": [
    { "from": "validate-credentials", "to": "issue-token", "label": "on success" }
  ]
}
```

- [ ] **Step 4: Write the failing test `src/lib/loadDiagram.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { loadDiagram } from './loadDiagram'
import { DiagramNotFoundError } from './types'

describe('loadDiagram', () => {
  it('loads the root deployment diagram', () => {
    const diagram = loadDiagram('deployment')
    expect(diagram.id).toBe('deployment')
    expect(diagram.nodes.some((n) => n.id === 'api-service')).toBe(true)
  })

  it('loads a nested diagram by its file id', () => {
    const diagram = loadDiagram('auth-module.flow')
    expect(diagram.title).toBe('Auth Module — Flow')
  })

  it('throws DiagramNotFoundError for an unknown id', () => {
    expect(() => loadDiagram('does-not-exist')).toThrow(DiagramNotFoundError)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- loadDiagram`
Expected: FAIL — `loadDiagram.ts` does not exist yet

- [ ] **Step 6: Write `src/lib/loadDiagram.ts`**

```ts
import type { Diagram } from './types'
import { DiagramNotFoundError } from './types'
import { validateDiagramShape } from './validateDiagram'

// ponytail: eager glob bundles every diagram JSON at build time. Fine for a
// local, single-user tool — no need for per-file async fetching or code
// splitting here.
const modules = import.meta.glob('/diagrams/*.json', { eager: true }) as Record<
  string,
  { default: unknown }
>

const rawDiagramsById = new Map<string, unknown>()
for (const path in modules) {
  const id = path.replace('/diagrams/', '').replace(/\.json$/, '')
  rawDiagramsById.set(id, modules[path].default)
}

export function loadDiagram(id: string): Diagram {
  const raw = rawDiagramsById.get(id)
  if (raw === undefined) {
    throw new DiagramNotFoundError(id)
  }
  return validateDiagramShape(raw, id)
}
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test -- loadDiagram`
Expected: PASS — all 3 tests

- [ ] **Step 8: Commit**

```bash
git add diagrams src/lib/loadDiagram.ts src/lib/loadDiagram.test.ts
git commit -m "feat: add sample diagram data and loadDiagram"
```

---

## Task 4: Auto-layout

**Files:**
- Create: `src/lib/autoLayout.ts`
- Create: `src/lib/autoLayout.test.ts`

**Interfaces:**
- Consumes: `DiagramNodeData`, `DiagramEdgeData` (Task 2)
- Produces: `PositionedNode extends DiagramNodeData { x: number; y: number }`, `layoutDiagram(nodes: DiagramNodeData[], edges: DiagramEdgeData[]): PositionedNode[]`

- [ ] **Step 1: Write the failing test `src/lib/autoLayout.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { layoutDiagram } from './autoLayout'
import type { DiagramNodeData, DiagramEdgeData } from './types'

describe('layoutDiagram', () => {
  it('assigns numeric x/y to every node', () => {
    const nodes: DiagramNodeData[] = [
      { id: 'a', label: 'A', kind: 'service' },
      { id: 'b', label: 'B', kind: 'service' },
    ]
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

    const positioned = layoutDiagram(nodes, edges)

    expect(positioned).toHaveLength(2)
    for (const n of positioned) {
      expect(typeof n.x).toBe('number')
      expect(typeof n.y).toBe('number')
    }
  })

  it('places a downstream node to the right of its upstream node (rankdir LR)', () => {
    const nodes: DiagramNodeData[] = [
      { id: 'a', label: 'A', kind: 'service' },
      { id: 'b', label: 'B', kind: 'service' },
    ]
    const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

    const [a, b] = layoutDiagram(nodes, edges)
    expect(b.x).toBeGreaterThan(a.x)
  })

  it('respects an explicit x/y override instead of computing one', () => {
    const nodes: DiagramNodeData[] = [{ id: 'a', label: 'A', kind: 'service', x: 999, y: 111 }]
    const [a] = layoutDiagram(nodes, [])
    expect(a.x).toBe(999)
    expect(a.y).toBe(111)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- autoLayout`
Expected: FAIL — `autoLayout.ts` does not exist yet

- [ ] **Step 3: Write `src/lib/autoLayout.ts`**

```ts
import dagre from 'dagre'
import type { DiagramNodeData, DiagramEdgeData } from './types'

export interface PositionedNode extends DiagramNodeData {
  x: number
  y: number
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 60

export function layoutDiagram(nodes: DiagramNodeData[], edges: DiagramEdgeData[]): PositionedNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 80 })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    graph.setEdge(edge.from, edge.to)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    if (node.x !== undefined && node.y !== undefined) {
      return { ...node, x: node.x, y: node.y }
    }
    const computed = graph.node(node.id)
    return { ...node, x: computed.x, y: computed.y }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- autoLayout`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/autoLayout.ts src/lib/autoLayout.test.ts
git commit -m "feat: add dagre-based auto-layout"
```

---

## Task 5: Path resolution (drill-down walk)

**Files:**
- Create: `src/lib/resolveDiagramPath.ts`
- Create: `src/lib/resolveDiagramPath.test.ts`

**Interfaces:**
- Consumes: `Diagram`, `DiagramNotFoundError` (Task 2)
- Produces: `resolveDiagramPath(segments: string[], loadFn: (id: string) => Diagram): { chain: Diagram[] }` — `chain[0]` is always the root `deployment` diagram; throws `DiagramNotFoundError` if a segment doesn't match a node in the current diagram, or matches a node with no `childDiagram`.

- [ ] **Step 1: Write the failing test `src/lib/resolveDiagramPath.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { resolveDiagramPath } from './resolveDiagramPath'
import { DiagramNotFoundError } from './types'
import type { Diagram } from './types'

const fixtures: Record<string, Diagram> = {
  deployment: {
    id: 'deployment',
    title: 'Deployment',
    nodes: [
      { id: 'svc', label: 'Svc', kind: 'service', childDiagram: 'svc.components' },
      { id: 'leaf', label: 'Leaf', kind: 'external' },
    ],
    edges: [],
  },
  'svc.components': {
    id: 'svc.components',
    title: 'Svc — Components',
    nodes: [{ id: 'inner', label: 'Inner', kind: 'component' }],
    edges: [],
  },
}

function fakeLoad(id: string): Diagram {
  const d = fixtures[id]
  if (!d) throw new DiagramNotFoundError(id)
  return d
}

describe('resolveDiagramPath', () => {
  it('returns just the root when there are no segments', () => {
    const { chain } = resolveDiagramPath([], fakeLoad)
    expect(chain).toHaveLength(1)
    expect(chain[0].id).toBe('deployment')
  })

  it('walks one level into a node with a childDiagram', () => {
    const { chain } = resolveDiagramPath(['svc'], fakeLoad)
    expect(chain.map((d) => d.id)).toEqual(['deployment', 'svc.components'])
  })

  it('throws when a segment does not match any node id', () => {
    expect(() => resolveDiagramPath(['ghost'], fakeLoad)).toThrow(DiagramNotFoundError)
  })

  it('throws when a segment matches a node with no childDiagram', () => {
    expect(() => resolveDiagramPath(['leaf'], fakeLoad)).toThrow(DiagramNotFoundError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- resolveDiagramPath`
Expected: FAIL — `resolveDiagramPath.ts` does not exist yet

- [ ] **Step 3: Write `src/lib/resolveDiagramPath.ts`**

```ts
import type { Diagram } from './types'
import { DiagramNotFoundError } from './types'

export interface ResolvedDiagramPath {
  chain: Diagram[]
}

export function resolveDiagramPath(
  segments: string[],
  loadFn: (id: string) => Diagram
): ResolvedDiagramPath {
  const root = loadFn('deployment')
  const chain: Diagram[] = [root]
  let current = root

  for (const nodeId of segments) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node || !node.childDiagram) {
      throw new DiagramNotFoundError(nodeId)
    }
    current = loadFn(node.childDiagram)
    chain.push(current)
  }

  return { chain }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- resolveDiagramPath`
Expected: PASS — all 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/resolveDiagramPath.ts src/lib/resolveDiagramPath.test.ts
git commit -m "feat: add drill-down path resolution"
```

---

## Task 6: Custom diagram node (kind-based styling)

**Files:**
- Create: `src/components/DiagramNode.tsx`
- Create: `src/components/DiagramNode.test.tsx`

**Interfaces:**
- Produces: `DiagramNode` — a React Flow custom node component, registered under the type key `"diagramNode"` (Task 7 wires this in). Reads `data.label` and `data.kind`.

- [ ] **Step 1: Write the failing test `src/components/DiagramNode.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DiagramNode } from './DiagramNode'

// ponytail: DiagramNode only ever reads `data`, so it's typed to take just
// that — not @xyflow/react's full NodeProps, whose shape has changed across
// major versions. Keeps this test decoupled from that library's internals.
function renderNode(kind: string) {
  return render(
    <ReactFlowProvider>
      <DiagramNode data={{ label: 'My Node', kind }} />
    </ReactFlowProvider>
  )
}

describe('DiagramNode', () => {
  it('renders the label', () => {
    renderNode('service')
    expect(screen.getByText('My Node')).toBeInTheDocument()
  })

  it('applies the known style for kind "service"', () => {
    renderNode('service')
    const el = screen.getByText('My Node').closest('div')
    expect(el).toHaveStyle({ borderColor: '#4f8cff' })
  })

  it('falls back to the default style for an unknown kind', () => {
    renderNode('something-new')
    const el = screen.getByText('My Node').closest('div')
    expect(el).toHaveStyle({ borderColor: '#9b9b9b' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DiagramNode`
Expected: FAIL — `DiagramNode.tsx` does not exist yet

- [ ] **Step 3: Write `src/components/DiagramNode.tsx`**

```tsx
import { Handle, Position } from '@xyflow/react'

export interface DiagramNodeData {
  label: string
  kind: string
}

export interface DiagramNodeProps {
  data: DiagramNodeData
}

const KIND_STYLES: Record<string, { background: string; border: string }> = {
  service: { background: '#e8f0fe', border: '#4f8cff' },
  bridge: { background: '#fdf3e3', border: '#f5a623' },
  database: { background: '#eaf7e3', border: '#7ed321' },
  component: { background: '#f6e8fd', border: '#bd10e0' },
  external: { background: '#f0f0f0', border: '#9b9b9b' },
}
const DEFAULT_STYLE = { background: '#f0f0f0', border: '#9b9b9b' }

// ponytail: typed against our own minimal DiagramNodeProps, not
// @xyflow/react's NodeProps — React Flow calls this with more props at
// runtime (id, selected, dragging, ...), which we simply don't declare or
// use. Avoids coupling to a type shape that has changed across major
// versions of the library.
export function DiagramNode({ data }: DiagramNodeProps) {
  const { label, kind } = data
  const style = KIND_STYLES[kind] ?? DEFAULT_STYLE

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 6,
        border: `2px solid ${style.border}`,
        background: style.background,
        fontSize: 13,
        minWidth: 140,
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Left} />
      {label}
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DiagramNode`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/DiagramNode.tsx src/components/DiagramNode.test.tsx
git commit -m "feat: add custom diagram node with kind-based styling"
```

---

## Task 7: Diagram canvas (React Flow wrapper)

**Files:**
- Create: `src/components/DiagramCanvas.tsx`
- Create: `src/components/DiagramCanvas.test.tsx`

**Interfaces:**
- Consumes: `PositionedNode` (Task 4), `DiagramEdgeData` (Task 2), `DiagramNode` (Task 6)
- Produces: `DiagramCanvas({ nodes: PositionedNode[]; edges: DiagramEdgeData[]; onNodeClick: (nodeId: string) => void })`

- [ ] **Step 1: Write the failing test `src/components/DiagramCanvas.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiagramCanvas } from './DiagramCanvas'
import type { PositionedNode } from '../lib/autoLayout'
import type { DiagramEdgeData } from '../lib/types'

const nodes: PositionedNode[] = [
  { id: 'a', label: 'A', kind: 'service', x: 0, y: 0 },
  { id: 'b', label: 'B', kind: 'service', x: 200, y: 0 },
]
const edges: DiagramEdgeData[] = [{ from: 'a', to: 'b' }]

describe('DiagramCanvas', () => {
  it('renders every node label', () => {
    render(<DiagramCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('calls onNodeClick with the clicked node id', async () => {
    const onNodeClick = vi.fn()
    render(<DiagramCanvas nodes={nodes} edges={edges} onNodeClick={onNodeClick} />)
    await userEvent.click(screen.getByText('A'))
    expect(onNodeClick).toHaveBeenCalledWith('a')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DiagramCanvas`
Expected: FAIL — `DiagramCanvas.tsx` does not exist yet

- [ ] **Step 3: Write `src/components/DiagramCanvas.tsx`**

```tsx
import type { ComponentType } from 'react'
import { ReactFlow, ReactFlowProvider, Background, Controls, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DiagramNode } from './DiagramNode'
import type { PositionedNode } from '../lib/autoLayout'
import type { DiagramEdgeData } from '../lib/types'

// ponytail: DiagramNode declares its own minimal prop type (just `data`)
// rather than @xyflow/react's NodeProps, so it's cast here at the one place
// that's wired into the library. See DiagramNode.tsx for why.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodeTypes = { diagramNode: DiagramNode as ComponentType<any> }

export interface DiagramCanvasProps {
  nodes: PositionedNode[]
  edges: DiagramEdgeData[]
  onNodeClick: (nodeId: string) => void
}

export function DiagramCanvas({ nodes, edges, onNodeClick }: DiagramCanvasProps) {
  const flowNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.label, kind: n.kind },
    type: 'diagramNode',
  }))

  const flowEdges: Edge[] = edges.map((e) => ({
    id: `${e.from}->${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label,
  }))

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DiagramCanvas`
Expected: PASS — both tests

- [ ] **Step 5: Commit**

```bash
git add src/components/DiagramCanvas.tsx src/components/DiagramCanvas.test.tsx
git commit -m "feat: add React Flow diagram canvas wrapper"
```

---

## Task 8: Breadcrumb

**Files:**
- Create: `src/components/Breadcrumb.tsx`
- Create: `src/components/Breadcrumb.test.tsx`

**Interfaces:**
- Produces: `Breadcrumb({ labels: string[]; onNavigate: (index: number) => void })` — pure/presentational, no routing knowledge (`DiagramPage`, Task 9, supplies `labels` and handles navigation).

- [ ] **Step 1: Write the failing test `src/components/Breadcrumb.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Breadcrumb } from './Breadcrumb'

describe('Breadcrumb', () => {
  it('renders one button per label', () => {
    render(<Breadcrumb labels={['Home', 'API Service']} onNavigate={() => {}} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('API Service')).toBeInTheDocument()
  })

  it('calls onNavigate with the clicked index', async () => {
    const onNavigate = vi.fn()
    render(<Breadcrumb labels={['Home', 'API Service']} onNavigate={onNavigate} />)
    await userEvent.click(screen.getByText('Home'))
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it('disables the last (current) label', () => {
    render(<Breadcrumb labels={['Home', 'API Service']} onNavigate={() => {}} />)
    expect(screen.getByText('API Service')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Breadcrumb`
Expected: FAIL — `Breadcrumb.tsx` does not exist yet

- [ ] **Step 3: Write `src/components/Breadcrumb.tsx`**

```tsx
export interface BreadcrumbProps {
  labels: string[]
  onNavigate: (index: number) => void
}

export function Breadcrumb({ labels, onNavigate }: BreadcrumbProps) {
  return (
    <nav aria-label="breadcrumb" style={{ padding: '8px 12px', borderBottom: '1px solid #ddd' }}>
      {labels.map((label, index) => (
        <span key={index}>
          {index > 0 && <span style={{ margin: '0 6px' }}>/</span>}
          <button
            onClick={() => onNavigate(index)}
            disabled={index === labels.length - 1}
            style={{ border: 'none', background: 'none', cursor: 'pointer', font: 'inherit' }}
          >
            {label}
          </button>
        </span>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Breadcrumb`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/Breadcrumb.tsx src/components/Breadcrumb.test.tsx
git commit -m "feat: add breadcrumb component"
```

---

## Task 9: Diagram page (wiring)

**Files:**
- Create: `src/components/DiagramPage.tsx`
- Create: `src/components/DiagramPage.test.tsx`

**Interfaces:**
- Consumes: `loadDiagram` (Task 3), `resolveDiagramPath`, `DiagramNotFoundError` (Task 5/2), `layoutDiagram` (Task 4), `DiagramCanvas` (Task 7), `Breadcrumb` (Task 8)
- Produces: `DiagramPage` — reads the current route's wildcard path via `react-router-dom`'s `useParams`, resolves and renders the corresponding diagram, or a not-found state.

- [ ] **Step 1: Write the failing test `src/components/DiagramPage.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { DiagramPage } from './DiagramPage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<DiagramPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DiagramPage', () => {
  it('renders the root deployment diagram at "/"', () => {
    renderAt('/')
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('API Service')).toBeInTheDocument()
  })

  it('drills down into a child diagram by clicking a node', async () => {
    renderAt('/')
    await userEvent.click(screen.getByText('API Service'))
    expect(await screen.findByText('Auth Module')).toBeInTheDocument()
  })

  it('renders a not-found state for a bad path', () => {
    renderAt('/does-not-exist')
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DiagramPage`
Expected: FAIL — `DiagramPage.tsx` does not exist yet

- [ ] **Step 3: Write `src/components/DiagramPage.tsx`**

```tsx
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadDiagram } from '../lib/loadDiagram'
import { resolveDiagramPath } from '../lib/resolveDiagramPath'
import { DiagramNotFoundError } from '../lib/types'
import type { Diagram } from '../lib/types'
import { layoutDiagram } from '../lib/autoLayout'
import { DiagramCanvas } from './DiagramCanvas'
import { Breadcrumb } from './Breadcrumb'

type Resolution = { chain: Diagram[] } | { notFoundId: string }

export function DiagramPage() {
  const params = useParams()
  const navigate = useNavigate()
  const segments = useMemo(
    () => (params['*'] ?? '').split('/').filter(Boolean),
    [params['*']]
  )

  const resolution: Resolution = useMemo(() => {
    try {
      return resolveDiagramPath(segments, loadDiagram)
    } catch (err) {
      if (err instanceof DiagramNotFoundError) {
        return { notFoundId: err.diagramId }
      }
      throw err
    }
  }, [segments])

  if ('notFoundId' in resolution) {
    return <div>Diagram not found: {resolution.notFoundId}</div>
  }

  const current = resolution.chain[resolution.chain.length - 1]
  const positionedNodes = layoutDiagram(current.nodes, current.edges)
  const labels = ['Home', ...resolution.chain.slice(1).map((d) => d.title)]

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/${[...segments, nodeId].join('/')}`)
  }

  function handleBreadcrumbNavigate(index: number) {
    navigate(`/${segments.slice(0, index).join('/')}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
      <div style={{ flex: 1 }}>
        <DiagramCanvas nodes={positionedNodes} edges={current.edges} onNodeClick={handleNodeClick} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DiagramPage`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/DiagramPage.tsx src/components/DiagramPage.test.tsx
git commit -m "feat: wire diagram page with routing-driven drill-down"
```

---

## Task 10: Wire the real App

**Files:**
- Modify: `src/App.tsx` (replace placeholder from Task 1, Step 8)
- Modify: `src/App.test.tsx` (replace placeholder test from Task 1, Step 9)

**Interfaces:**
- Consumes: `DiagramPage` (Task 9)

- [ ] **Step 1: Write the failing test — replace `src/App.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('App', () => {
  it('renders the root deployment diagram by default', () => {
    render(<App />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('API Service')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App`
Expected: FAIL — placeholder `App` only renders "Architecture Map", not "Home"/"API Service"

- [ ] **Step 3: Replace `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DiagramPage } from './components/DiagramPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<DiagramPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- App`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — every test file green

- [ ] **Step 6: Manually verify in the browser**

Run: `npm run dev`, open the printed local URL. Confirm: deployment diagram renders with 3 nodes; clicking "API Service" drills into its components diagram with a working breadcrumb back to "Home"; clicking "Auth Module" drills one level further into the flow diagram; clicking a leaf node (e.g. "Database") does nothing.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: wire App to route-driven DiagramPage"
```

---

## Task 11: Validation script

**Files:**
- Create: `scripts/validate-diagrams.ts`

**Interfaces:**
- Consumes: `validateDiagramShape`, `checkCrossFileReferences`, `InvalidDiagramError` (Task 2)
- Produces: a CLI entry point run via `npm run validate` (already wired to `tsx scripts/validate-diagrams.ts` in Task 1's `package.json`)

This script is thin fs-wiring around functions already unit-tested in Task 2 — no dedicated test file, verified manually per Step 3 below (ponytail: the logic worth testing already has tests; this file only reads the filesystem and prints).

- [ ] **Step 1: Write `scripts/validate-diagrams.ts`**

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  validateDiagramShape,
  checkCrossFileReferences,
  InvalidDiagramError,
} from '../src/lib/validateDiagram'
import type { Diagram } from '../src/lib/types'

const DIAGRAMS_DIR = join(import.meta.dirname, '..', 'diagrams')

function main() {
  const files = readdirSync(DIAGRAMS_DIR).filter((f) => f.endsWith('.json'))
  const diagrams: Record<string, Diagram> = {}
  const errors: string[] = []

  for (const file of files) {
    const id = file.replace(/\.json$/, '')
    const raw = JSON.parse(readFileSync(join(DIAGRAMS_DIR, file), 'utf-8'))
    try {
      diagrams[id] = validateDiagramShape(raw, id)
    } catch (err) {
      if (err instanceof InvalidDiagramError) {
        errors.push(err.message)
      } else {
        throw err
      }
    }
  }

  errors.push(...checkCrossFileReferences(diagrams))

  if (errors.length > 0) {
    console.error('Diagram validation failed:\n')
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(`✓ ${files.length} diagram(s) validated OK`)
}

main()
```

- [ ] **Step 2: Run it against the real sample data**

Run: `npm run validate`
Expected: `✓ 3 diagram(s) validated OK`

- [ ] **Step 3: Manually verify it catches a broken reference**

Temporarily edit `diagrams/deployment.json`, change `"childDiagram": "api-service.components"` to `"childDiagram": "ghost"`, run `npm run validate` again.
Expected: exits non-zero, prints `deployment: node "api-service" references missing childDiagram "ghost"`. Revert the edit afterward.

- [ ] **Step 4: Commit**

```bash
git add scripts/validate-diagrams.ts
git commit -m "feat: add diagram validation CLI script"
```

---

## Task 12: README and final polish

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# architecture-map

Personal, project-agnostic tool to explore a codebase's architecture as an
interactive, recursively drill-down-able map — instead of static Mermaid
diagrams.

## Usage

    npm install
    npm run dev

Click any node that looks clickable (it has a `childDiagram`) to drill down
one level. Use the breadcrumb at the top to go back up. The browser's back
button also works.

## Authoring diagrams

Every diagram is one JSON file under `diagrams/`. See `diagrams/deployment.json`
for the format: `nodes` (each with an `id`, `label`, `kind`, and optional
`childDiagram` to make it clickable) and `edges` (each with `from`/`to` and an
optional `label`). No coordinates needed — layout is computed automatically.

Run `npm run validate` after editing diagrams to catch typos: unknown node ids
in edges, or `childDiagram` references pointing at a file that doesn't exist.

## Reusing this for another project

Clone this repo, delete the contents of `diagrams/`, and author a new set of
JSON files for the other project. No source changes needed — `diagrams/` is
the only project-specific part of this tool.

## Adding a new visual "kind"

Node color is driven by the free-form `kind` field. Known kinds are styled in
`src/components/DiagramNode.tsx`'s `KIND_STYLES` map; anything else falls back
to a default gray. Add an entry there to give a new kind its own color.
```

- [ ] **Step 2: Run the full test suite and the validation script one last time**

Run: `npm test && npm run validate`
Expected: all tests pass, validation reports `✓ 3 diagram(s) validated OK`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```
