# Rich Node/Edge Content Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace architecture-map's flat "colored rectangle" node model with real semantic shapes per node kind, an optional per-node technical datasheet (responsibility/tech stack/data owned/gotchas), and a per-diagram notation system (C4 / UML-structural / UML-behavioral) that changes how edges render.

**Architecture:** Extend the existing `Diagram`/`DiagramNodeData`/`DiagramEdgeData` types (additive, all new fields optional) and `validateDiagramShape` (tightened `kind` validation, new optional-field checks). Add a `kind → shape component` lookup (`nodeShapes.tsx`, same pattern as the old `KIND_STYLES` map but producing distinct silhouettes, not colors). Add a side-panel component for the "view more" detail. Extend `DiagramCanvas`'s existing node/edge mapping to carry the new fields and render UML-correct edge markers. No new dependencies, no backend, no schema-breaking change to the 3 existing sample diagrams (they remain valid with no edits, though this plan migrates them anyway per the spec).

**Tech Stack:** Same as the existing project (React 18, TypeScript 5, Vite 6, `@xyflow/react`, `react-router-dom`, Vitest + Testing Library). No new npm dependencies — tech-stack icons are hand-authored colored monogram badges (see Task 3), not a third-party icon package.

## Global Constraints

- All new fields on `DiagramNodeData`/`DiagramEdgeData`/`Diagram` are optional — a diagram with none of them must keep working exactly as before (spec: Non-goals, backward compatibility).
- A diagram's `notation` is a single value for the whole file (`c4` | `uml-structural` | `uml-behavioral`), never mixed within one diagram, defaulting to `c4` when absent (spec: Notation system).
- `kind` becomes a closed enum of 9 values: `system`, `container`, `component`, `service`, `server`, `database`, `class`, `external`, `bridge` (spec's original 8 + `bridge`, confirmed with the user). An unrecognized `kind` is now a real validation error, not a silent color fallback (spec: Data schema — deliberate tightening).
- `interfaces` is explicitly NOT a generic node field — where a notation needs it (a UML class's operations), it's expressed via that notation's own fields (`operations`), never a shared cross-cutting field (spec: Node content model).
- The "view more" detail view is a side panel, not a modal, triggered by an eye icon top-right of the node (spec: Node content model).
- `techStack` icons are icons only on the node face (no text label), names appear only in the detail panel (spec: Node content model).
- No new npm dependency for tech-stack icons — colored monogram badges instead of a third-party icon package, to avoid depending on an external package's exact export API that can't be verified against this plan (documented engineering substitution, not a silent scope cut).

---

## Task 1: Extend core types

**Files:**
- Modify: `src/lib/types.ts` (full file, currently 29 lines)

**Interfaces:**
- Produces: `NodeKind`, `NODE_KINDS`, `Notation`, `NOTATIONS`, `UmlRelationship`, `UML_RELATIONSHIPS` (new exports); extended `DiagramNodeData`, `DiagramEdgeData`, `Diagram` (same names as before, more optional fields).

This task has no dedicated test file — it's pure type/const declarations, verified by the existing suite continuing to typecheck and pass (Step 3) and by Task 2's tests exercising the new consts at runtime.

- [ ] **Step 1: Replace the full contents of `src/lib/types.ts`**

```ts
export type NodeKind =
  | 'system'
  | 'container'
  | 'component'
  | 'service'
  | 'server'
  | 'database'
  | 'class'
  | 'external'
  | 'bridge'

export const NODE_KINDS: readonly NodeKind[] = [
  'system',
  'container',
  'component',
  'service',
  'server',
  'database',
  'class',
  'external',
  'bridge',
]

export type Notation = 'c4' | 'uml-structural' | 'uml-behavioral'

export const NOTATIONS: readonly Notation[] = ['c4', 'uml-structural', 'uml-behavioral']

export type UmlRelationship = 'association' | 'composition' | 'inheritance' | 'dependency'

export const UML_RELATIONSHIPS: readonly UmlRelationship[] = [
  'association',
  'composition',
  'inheritance',
  'dependency',
]

export interface DiagramNodeData {
  id: string
  label: string
  kind: NodeKind
  childDiagram?: string
  x?: number
  y?: number
  responsibility?: string
  techStack?: string[]
  dataOwned?: string
  gotchas?: string[]
  attributes?: string[]
  operations?: string[]
}

export interface DiagramEdgeData {
  from: string
  to: string
  label?: string
  relationship?: UmlRelationship
  order?: number
  async?: boolean
  condition?: string
}

export interface Diagram {
  id: string
  title: string
  notation?: Notation
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

- [ ] **Step 2: Run the full suite to confirm it still typechecks and passes**

Run: `npm test`
Expected: Some failures are EXPECTED at this point — `src/lib/validateDiagram.ts` (Task 2) and `src/components/DiagramNode.tsx` (Task 6) haven't been updated yet to match the new `kind: NodeKind` type, so TypeScript may report type errors in those files when Vitest transforms them. If `npm test` fails here, confirm the failures are TS type errors in `validateDiagram.ts`/`DiagramNode.tsx`/`DiagramCanvas.tsx` specifically (not in `types.ts` itself) — that's expected and Task 2/6/7 fix them. Do not attempt to fix those other files in this task.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: extend diagram types with kind enum, notation, and content fields"
```

---

## Task 2: Extend validation

**Files:**
- Modify: `src/lib/validateDiagram.ts` (full file, currently 72 lines)
- Modify: `src/lib/validateDiagram.test.ts` (add new test cases; keep all 9 existing tests)

**Interfaces:**
- Consumes: `NodeKind`, `NODE_KINDS`, `Notation`, `NOTATIONS`, `UmlRelationship`, `UML_RELATIONSHIPS` (Task 1)
- Produces: `validateDiagramShape(raw: unknown, diagramId: string): Diagram` (same signature as before, stricter body), `checkCrossFileReferences` (unchanged), `InvalidDiagramError` (unchanged)

- [ ] **Step 1: Write the failing tests — append to `src/lib/validateDiagram.test.ts`**

Add these `it` blocks inside the existing `describe('validateDiagramShape', ...)` block (do not remove any of the 6 existing tests in that block):

```ts
  it('rejects a node with an unrecognized kind', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [{ id: 'a', label: 'A', kind: 'not-a-real-kind' }],
      edges: [],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/kind/)
  })

  it('accepts every value in NODE_KINDS', () => {
    for (const kind of NODE_KINDS) {
      const raw = {
        id: 'x',
        title: 'X',
        nodes: [{ id: 'a', label: 'A', kind }],
        edges: [],
      }
      expect(() => validateDiagramShape(raw, 'x')).not.toThrow()
    }
  })

  it('rejects an invalid "notation"', () => {
    const raw = { id: 'x', title: 'X', notation: 'not-a-notation', nodes: [], edges: [] }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/notation/)
  })

  it('accepts a diagram with no "notation" (defaults are the caller\'s concern, not validation\'s)', () => {
    const raw = { id: 'x', title: 'X', nodes: [], edges: [] }
    expect(() => validateDiagramShape(raw, 'x')).not.toThrow()
  })

  it('rejects a node with a non-array "techStack"', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [{ id: 'a', label: 'A', kind: 'service', techStack: 'go' }],
      edges: [],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/techStack/)
  })

  it('accepts a node with valid optional content fields', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [
        {
          id: 'a',
          label: 'A',
          kind: 'class',
          responsibility: 'Does a thing',
          techStack: ['go'],
          dataOwned: 'widgets table',
          gotchas: ['careful with X'],
          attributes: ['name: string'],
          operations: ['save(): void'],
        },
      ],
      edges: [],
    }
    expect(() => validateDiagramShape(raw, 'x')).not.toThrow()
  })

  it('rejects an edge with an invalid "relationship"', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [
        { id: 'a', label: 'A', kind: 'class' },
        { id: 'b', label: 'B', kind: 'class' },
      ],
      edges: [{ from: 'a', to: 'b', relationship: 'not-a-relationship' }],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/relationship/)
  })

  it('accepts every value in UML_RELATIONSHIPS on an edge', () => {
    for (const relationship of UML_RELATIONSHIPS) {
      const raw = {
        id: 'x',
        title: 'X',
        nodes: [
          { id: 'a', label: 'A', kind: 'class' },
          { id: 'b', label: 'B', kind: 'class' },
        ],
        edges: [{ from: 'a', to: 'b', relationship }],
      }
      expect(() => validateDiagramShape(raw, 'x')).not.toThrow()
    }
  })

  it('rejects an edge with a non-number "order"', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [
        { id: 'a', label: 'A', kind: 'component' },
        { id: 'b', label: 'B', kind: 'component' },
      ],
      edges: [{ from: 'a', to: 'b', order: 'first' }],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/order/)
  })

  it('rejects an edge with a non-boolean "async"', () => {
    const raw = {
      id: 'x',
      title: 'X',
      nodes: [
        { id: 'a', label: 'A', kind: 'component' },
        { id: 'b', label: 'B', kind: 'component' },
      ],
      edges: [{ from: 'a', to: 'b', async: 'yes' }],
    }
    expect(() => validateDiagramShape(raw, 'x')).toThrow(/async/)
  })
```

Add this import at the top of the file alongside the existing `validateDiagramShape`/`checkCrossFileReferences`/`InvalidDiagramError` import:

```ts
import { NODE_KINDS, UML_RELATIONSHIPS } from './types'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- validateDiagram`
Expected: FAIL — `validateDiagramShape` doesn't yet check `kind` against `NODE_KINDS`, doesn't check `notation`/`techStack`/`relationship`/`order`/`async`.

- [ ] **Step 3: Replace the full contents of `src/lib/validateDiagram.ts`**

```ts
import type { Diagram, NodeKind, Notation, UmlRelationship } from './types'
import { NODE_KINDS, NOTATIONS, UML_RELATIONSHIPS } from './types'

export class InvalidDiagramError extends Error {
  constructor(diagramId: string, reason: string) {
    super(`Invalid diagram "${diagramId}": ${reason}`)
    this.name = 'InvalidDiagramError'
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

export function validateDiagramShape(raw: unknown, diagramId: string): Diagram {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidDiagramError(diagramId, 'not an object')
  }
  const d = raw as Partial<Diagram>

  if (typeof d.id !== 'string') throw new InvalidDiagramError(diagramId, 'missing "id"')
  if (typeof d.title !== 'string') throw new InvalidDiagramError(diagramId, 'missing "title"')
  if (d.notation !== undefined && !NOTATIONS.includes(d.notation as Notation)) {
    throw new InvalidDiagramError(diagramId, `invalid "notation": ${JSON.stringify(d.notation)}`)
  }
  if (!Array.isArray(d.nodes)) throw new InvalidDiagramError(diagramId, 'missing "nodes" array')
  if (!Array.isArray(d.edges)) throw new InvalidDiagramError(diagramId, 'missing "edges" array')

  d.nodes.forEach((n, i) => {
    if (typeof n !== 'object' || n === null) {
      throw new InvalidDiagramError(diagramId, `node at index ${i} is not an object`)
    }
    const node = n as Record<string, unknown>
    if (typeof node.id !== 'string') {
      throw new InvalidDiagramError(diagramId, `node at index ${i} missing "id"`)
    }
    if (typeof node.label !== 'string') {
      throw new InvalidDiagramError(diagramId, `node at index ${i} missing "label"`)
    }
    if (typeof node.kind !== 'string' || !NODE_KINDS.includes(node.kind as NodeKind)) {
      throw new InvalidDiagramError(
        diagramId,
        `node "${node.id ?? i}" has invalid "kind": ${JSON.stringify(node.kind)}`
      )
    }
    if (node.responsibility !== undefined && typeof node.responsibility !== 'string') {
      throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "responsibility" (must be string)`)
    }
    if (node.dataOwned !== undefined && typeof node.dataOwned !== 'string') {
      throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "dataOwned" (must be string)`)
    }
    for (const field of ['techStack', 'gotchas', 'attributes', 'operations'] as const) {
      if (node[field] !== undefined && !isStringArray(node[field])) {
        throw new InvalidDiagramError(diagramId, `node "${node.id}" has invalid "${field}" (must be string[])`)
      }
    }
  })

  d.edges.forEach((e, i) => {
    if (typeof e !== 'object' || e === null) {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} is not an object`)
    }
    const edge = e as Record<string, unknown>
    if (typeof edge.from !== 'string') {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} missing "from"`)
    }
    if (typeof edge.to !== 'string') {
      throw new InvalidDiagramError(diagramId, `edge at index ${i} missing "to"`)
    }
    if (edge.relationship !== undefined && !UML_RELATIONSHIPS.includes(edge.relationship as UmlRelationship)) {
      throw new InvalidDiagramError(
        diagramId,
        `edge "${edge.from}->${edge.to}" has invalid "relationship": ${JSON.stringify(edge.relationship)}`
      )
    }
    if (edge.order !== undefined && typeof edge.order !== 'number') {
      throw new InvalidDiagramError(diagramId, `edge "${edge.from}->${edge.to}" has invalid "order" (must be number)`)
    }
    if (edge.async !== undefined && typeof edge.async !== 'boolean') {
      throw new InvalidDiagramError(diagramId, `edge "${edge.from}->${edge.to}" has invalid "async" (must be boolean)`)
    }
    if (edge.condition !== undefined && typeof edge.condition !== 'string') {
      throw new InvalidDiagramError(
        diagramId,
        `edge "${edge.from}->${edge.to}" has invalid "condition" (must be string)`
      )
    }
  })

  const nodeIds = new Set(d.nodes.map((n) => (n as { id: string }).id))
  for (const edge of d.edges as Array<{ from: string; to: string }>) {
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

Add the matching import at the top of `src/lib/validateDiagram.test.ts` (alongside its existing imports):

```ts
import { NODE_KINDS, UML_RELATIONSHIPS } from './types'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- validateDiagram`
Expected: PASS — all 16 tests (6 original for shape/edges + 3 original for `checkCrossFileReferences` + 10 new)

- [ ] **Step 5: Commit**

```bash
git add src/lib/validateDiagram.ts src/lib/validateDiagram.test.ts
git commit -m "feat: validate node kind enum, notation, and new optional content fields"
```

---

## Task 3: Tech-stack icon lookup

**Files:**
- Create: `src/lib/techIcons.ts`
- Create: `src/lib/techIcons.test.ts`

**Interfaces:**
- Produces: `TechIcon { label: string; short: string; fg: string; bg: string }`, `getTechIcon(id: string): TechIcon`

- [ ] **Step 1: Write the failing test `src/lib/techIcons.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { getTechIcon } from './techIcons'

describe('getTechIcon', () => {
  it('returns the known icon for a recognized id', () => {
    const icon = getTechIcon('go')
    expect(icon.label).toBe('Go')
    expect(icon.short).toBe('Go')
  })

  it('is case-insensitive', () => {
    expect(getTechIcon('GO')).toEqual(getTechIcon('go'))
  })

  it('falls back to a generic icon for an unrecognized id', () => {
    const icon = getTechIcon('cobol')
    expect(icon.short).toBe('?')
    expect(icon.label).toBe('Unknown tech')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- techIcons`
Expected: FAIL — `techIcons.ts` does not exist yet

- [ ] **Step 3: Write `src/lib/techIcons.ts`**

```ts
export interface TechIcon {
  label: string
  short: string
  fg: string
  bg: string
}

const TECH_ICONS: Record<string, TechIcon> = {
  go: { label: 'Go', short: 'Go', fg: '#00ADD8', bg: '#0b2b30' },
  react: { label: 'React', short: 'Re', fg: '#61DAFB', bg: '#0b2a30' },
  typescript: { label: 'TypeScript', short: 'TS', fg: '#3178C6', bg: '#0e1f33' },
  javascript: { label: 'JavaScript', short: 'JS', fg: '#F7DF1E', bg: '#332f0e' },
  postgresql: { label: 'PostgreSQL', short: 'Pg', fg: '#4169E1', bg: '#101a33' },
  mysql: { label: 'MySQL', short: 'My', fg: '#4479A1', bg: '#101c26' },
  aws: { label: 'AWS', short: 'AWS', fg: '#FF9900', bg: '#2e2109' },
  docker: { label: 'Docker', short: 'Do', fg: '#2496ED', bg: '#0c2436' },
  nodejs: { label: 'Node.js', short: 'Nd', fg: '#5FA04E', bg: '#132211' },
  python: { label: 'Python', short: 'Py', fg: '#3776AB', bg: '#0f1d2e' },
}

const FALLBACK_ICON: TechIcon = { label: 'Unknown tech', short: '?', fg: '#9096a8', bg: '#23252c' }

// ponytail: colored monogram badges instead of real vector brand logos —
// avoids a new dependency (e.g. simple-icons) whose exact export API
// changes across major versions, and avoids hand-transcribing SVG path
// data that can't be visually verified here. Swap this file's internals
// for real logos later if wanted; callers only ever see `getTechIcon`.
export function getTechIcon(id: string): TechIcon {
  return TECH_ICONS[id.toLowerCase()] ?? FALLBACK_ICON
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- techIcons`
Expected: PASS — all 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/techIcons.ts src/lib/techIcons.test.ts
git commit -m "feat: add tech-stack icon lookup (colored monogram badges)"
```

---

## Task 4: Node shape components + theme tokens

**Files:**
- Create: `src/components/nodeShapes.tsx`
- Create: `src/components/nodeShapes.test.tsx`
- Modify: `src/theme.css:13-22` (the existing `--kind-*` block)

**Interfaces:**
- Consumes: `DiagramNodeData`, `NodeKind` (Task 1)
- Produces: `NODE_SHAPES: Record<NodeKind, (props: { node: DiagramNodeData; children: ReactNode }) => JSX.Element>`

- [ ] **Step 1: Extend `src/theme.css`'s `:root` block**

Replace lines 13-22 (the existing `--kind-service-fg` ... `--kind-external-bg` block) with:

```css
  --kind-system-fg: #7fd4c1;
  --kind-system-bg: #0f2b26;
  --kind-container-fg: #6fa8dc;
  --kind-container-bg: #101f2e;
  --kind-component-fg: #c98bd6;
  --kind-component-bg: #2a2130;
  --kind-service-fg: #8b93f8;
  --kind-service-bg: #23253a;
  --kind-server-fg: #d68b6a;
  --kind-server-bg: #2c2117;
  --kind-database-fg: #6fbf8f;
  --kind-database-bg: #1f2b24;
  --kind-class-fg: #e6c15c;
  --kind-class-bg: #2c260f;
  --kind-external-fg: #9096a8;
  --kind-external-bg: #23252c;
  --kind-bridge-fg: #e0a45e;
  --kind-bridge-bg: #2c2620;
```

- [ ] **Step 2: Write the failing test `src/components/nodeShapes.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NODE_SHAPES } from './nodeShapes'
import type { DiagramNodeData, NodeKind } from '../lib/types'
import { NODE_KINDS } from '../lib/types'

function baseNode(kind: NodeKind): DiagramNodeData {
  return { id: 'n1', label: 'N1', kind }
}

describe('NODE_SHAPES', () => {
  it('has one shape component per NodeKind', () => {
    for (const kind of NODE_KINDS) {
      expect(NODE_SHAPES[kind]).toBeDefined()
    }
  })

  it.each(NODE_KINDS)('renders a distinct data-shape="%s" root element with its children', (kind) => {
    const Shape = NODE_SHAPES[kind]
    render(<Shape node={baseNode(kind)}>hello</Shape>)
    expect(screen.getByText('hello')).toBeInTheDocument()
    const el = document.querySelector(`[data-shape="${kind}"]`)
    expect(el).not.toBeNull()
  })

  it('renders attributes and operations for the class shape when present', () => {
    const Shape = NODE_SHAPES.class
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'N1',
      kind: 'class',
      attributes: ['name: string'],
      operations: ['save(): void'],
    }
    render(<Shape node={node}>N1</Shape>)
    expect(screen.getByText('name: string')).toBeInTheDocument()
    expect(screen.getByText('save(): void')).toBeInTheDocument()
  })

  it('does not render attribute/operation sections for the class shape when absent', () => {
    const Shape = NODE_SHAPES.class
    render(<Shape node={baseNode('class')}>N1</Shape>)
    expect(screen.queryByText('name: string')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- nodeShapes`
Expected: FAIL — `nodeShapes.tsx` does not exist yet

- [ ] **Step 4: Write `src/components/nodeShapes.tsx`**

```tsx
import type { CSSProperties, ReactNode } from 'react'
import type { DiagramNodeData, NodeKind } from '../lib/types'

export interface ShapeProps {
  node: DiagramNodeData
  children: ReactNode
}

const baseBoxStyle = (kind: NodeKind): CSSProperties => ({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  padding: '10px 14px',
  minWidth: 160,
  color: 'var(--text)',
  fontFamily: 'var(--font-ui)',
  background: `var(--kind-${kind}-bg)`,
  border: `1px solid var(--kind-${kind}-fg)`,
})

function SystemShape({ children }: ShapeProps) {
  return (
    <div data-shape="system" style={{ ...baseBoxStyle('system'), borderRadius: 16 }}>
      {children}
    </div>
  )
}

function ContainerShape({ children }: ShapeProps) {
  return (
    <div data-shape="container" style={{ ...baseBoxStyle('container'), borderRadius: 8, borderBottomWidth: 4 }}>
      {children}
    </div>
  )
}

function ComponentShape({ children }: ShapeProps) {
  return (
    <div data-shape="component" style={{ ...baseBoxStyle('component'), borderRadius: 4, paddingLeft: 20 }}>
      <span
        style={{
          position: 'absolute',
          left: -4,
          top: 8,
          width: 12,
          height: 6,
          background: 'var(--kind-component-fg)',
          borderRadius: 2,
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: -4,
          top: 20,
          width: 12,
          height: 6,
          background: 'var(--kind-component-fg)',
          borderRadius: 2,
        }}
      />
      {children}
    </div>
  )
}

function ServiceShape({ children }: ShapeProps) {
  return (
    <div data-shape="service" style={{ ...baseBoxStyle('service'), borderRadius: 8, borderTopWidth: 4 }}>
      {children}
    </div>
  )
}

function ServerShape({ children }: ShapeProps) {
  return (
    <div data-shape="server" style={{ ...baseBoxStyle('server'), borderRadius: 2, paddingLeft: 22 }}>
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 8,
          bottom: 8,
          width: 8,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ height: 2, background: 'var(--kind-server-fg)' }} />
        <span style={{ height: 2, background: 'var(--kind-server-fg)' }} />
        <span style={{ height: 2, background: 'var(--kind-server-fg)' }} />
      </div>
      {children}
    </div>
  )
}

function DatabaseShape({ children }: ShapeProps) {
  return (
    <div data-shape="database" style={{ position: 'relative', minWidth: 160, color: 'var(--text)', fontFamily: 'var(--font-ui)' }}>
      <svg width="100%" height="16" style={{ position: 'absolute', top: -8, left: 0 }} viewBox="0 0 100 16" preserveAspectRatio="none">
        <ellipse cx="50" cy="8" rx="49" ry="7" fill="var(--kind-database-bg)" stroke="var(--kind-database-fg)" />
      </svg>
      <div
        style={{
          background: 'var(--kind-database-bg)',
          borderLeft: '1px solid var(--kind-database-fg)',
          borderRight: '1px solid var(--kind-database-fg)',
          padding: '14px 14px 10px',
        }}
      >
        {children}
      </div>
      <svg width="100%" height="16" style={{ position: 'absolute', bottom: -8, left: 0 }} viewBox="0 0 100 16" preserveAspectRatio="none">
        <path d="M1 0 A49 7 0 0 0 99 0 L99 8 A49 7 0 0 1 1 8 Z" fill="var(--kind-database-bg)" stroke="var(--kind-database-fg)" />
      </svg>
    </div>
  )
}

function ClassShape({ node, children }: ShapeProps) {
  return (
    <div data-shape="class" style={{ ...baseBoxStyle('class'), borderRadius: 2, padding: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--kind-class-fg)' }}>{children}</div>
      {node.attributes && node.attributes.length > 0 && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--kind-class-fg)', fontSize: 11 }}>
          {node.attributes.map((a, i) => (
            <div key={i}>{a}</div>
          ))}
        </div>
      )}
      {node.operations && node.operations.length > 0 && (
        <div style={{ padding: '6px 12px', fontSize: 11 }}>
          {node.operations.map((o, i) => (
            <div key={i}>{o}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function ExternalShape({ children }: ShapeProps) {
  return (
    <div data-shape="external" style={{ ...baseBoxStyle('external'), borderRadius: 16, borderStyle: 'dashed' }}>
      {children}
    </div>
  )
}

function BridgeShape({ children }: ShapeProps) {
  return (
    <div data-shape="bridge" style={{ ...baseBoxStyle('bridge'), borderRadius: 4, paddingLeft: 20, paddingRight: 20 }}>
      <span
        style={{
          position: 'absolute',
          left: -6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderRight: '6px solid var(--kind-bridge-fg)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          right: -6,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderLeft: '6px solid var(--kind-bridge-fg)',
        }}
      />
      {children}
    </div>
  )
}

export const NODE_SHAPES: Record<NodeKind, (props: ShapeProps) => JSX.Element> = {
  system: SystemShape,
  container: ContainerShape,
  component: ComponentShape,
  service: ServiceShape,
  server: ServerShape,
  database: DatabaseShape,
  class: ClassShape,
  external: ExternalShape,
  bridge: BridgeShape,
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- nodeShapes`
Expected: PASS — all 12 tests (1 + 9 from `it.each` + 2)

- [ ] **Step 6: Commit**

```bash
git add src/components/nodeShapes.tsx src/components/nodeShapes.test.tsx src/theme.css
git commit -m "feat: add semantic shape-per-kind node renderers"
```

---

## Task 5: Rewrite DiagramNode as a shape dispatcher

**Files:**
- Modify: `src/components/DiagramNode.tsx` (full file, currently 62 lines — replaces the local `DiagramNodeData`/`KIND_STYLES` with the shared types and shape dispatch)
- Modify: `src/components/DiagramNode.test.tsx` (full file, currently 34 lines)

**Interfaces:**
- Consumes: `DiagramNodeData` (Task 1, now the shared `src/lib/types.ts` version, not a local redefinition), `NODE_SHAPES` (Task 4), `getTechIcon` (Task 3)
- Produces: `DiagramNode(props: { data: DiagramNodeData & { onOpenDetail?: (nodeId: string) => void } })` — same component name as before, new prop shape (drops the old local `DiagramNodeData { label; kind }`, uses the full shared one, and adds the optional detail-view callback carried through `data` since that's how React Flow threads extra data into custom nodes)

- [ ] **Step 1: Write the failing tests — replace `src/components/DiagramNode.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { DiagramNode } from './DiagramNode'
import type { DiagramNodeData } from '../lib/types'

function renderNode(data: DiagramNodeData & { onOpenDetail?: (nodeId: string) => void }) {
  return render(
    <ReactFlowProvider>
      <DiagramNode data={data} />
    </ReactFlowProvider>
  )
}

describe('DiagramNode', () => {
  it('renders the label', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service' })
    expect(screen.getByText('My Node')).toBeInTheDocument()
  })

  it('dispatches to the shape matching its kind', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'database' })
    expect(document.querySelector('[data-shape="database"]')).not.toBeNull()
  })

  it('renders the responsibility line when present', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service', responsibility: 'Does the thing' })
    expect(screen.getByText('Does the thing')).toBeInTheDocument()
  })

  it('does not render a responsibility line when absent', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service' })
    expect(screen.queryByText('Does the thing')).not.toBeInTheDocument()
  })

  it('renders one tech icon badge per techStack entry', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service', techStack: ['go', 'postgresql'] })
    expect(screen.getByTitle('Go')).toBeInTheDocument()
    expect(screen.getByTitle('PostgreSQL')).toBeInTheDocument()
  })

  it('calls onOpenDetail with the node id when the view-more button is clicked', async () => {
    const onOpenDetail = vi.fn()
    renderNode({ id: 'n1', label: 'My Node', kind: 'service', onOpenDetail })
    await userEvent.click(screen.getByLabelText('View details for My Node'))
    expect(onOpenDetail).toHaveBeenCalledWith('n1')
  })

  it('does not render a view-more button when onOpenDetail is absent', () => {
    renderNode({ id: 'n1', label: 'My Node', kind: 'service' })
    expect(screen.queryByLabelText('View details for My Node')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- DiagramNode`
Expected: FAIL — current `DiagramNode.tsx` still uses the old local `{ label; kind }` data shape and `KIND_STYLES` map, not `NODE_SHAPES`/the new fields

- [ ] **Step 3: Replace the full contents of `src/components/DiagramNode.tsx`**

```tsx
import { Handle, Position } from '@xyflow/react'
import type { DiagramNodeData } from '../lib/types'
import { NODE_SHAPES } from './nodeShapes'
import { getTechIcon } from '../lib/techIcons'

export interface DiagramNodeProps {
  data: DiagramNodeData & { onOpenDetail?: (nodeId: string) => void }
}

// ponytail: typed against our own DiagramNodeData, not @xyflow/react's
// NodeProps — React Flow calls this with more props at runtime (id,
// selected, dragging, ...), which we simply don't declare or use. Avoids
// coupling to a type shape that has changed across major versions of the
// library.
export function DiagramNode({ data }: DiagramNodeProps) {
  const Shape = NODE_SHAPES[data.kind]

  return (
    <Shape node={data}>
      <Handle type="target" position={Position.Left} />
      {data.onOpenDetail && (
        <button
          aria-label={`View details for ${data.label}`}
          onClick={(e) => {
            e.stopPropagation()
            data.onOpenDetail?.(data.id)
          }}
          style={{
            position: 'absolute',
            top: -6,
            right: -6,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            padding: 2,
          }}
        >
          👁
        </button>
      )}
      <span style={{ fontWeight: 600, fontSize: 13 }}>{data.label}</span>
      {data.responsibility && (
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{data.responsibility}</span>
      )}
      {data.techStack && data.techStack.length > 0 && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
          {data.techStack.map((id) => {
            const icon = getTechIcon(id)
            return (
              <span
                key={id}
                title={icon.label}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: icon.bg,
                  color: icon.fg,
                  fontSize: 8,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {icon.short}
              </span>
            )
          })}
        </div>
      )}
      <Handle type="source" position={Position.Right} />
    </Shape>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- DiagramNode`
Expected: PASS — all 7 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/DiagramNode.tsx src/components/DiagramNode.test.tsx
git commit -m "feat: rewrite DiagramNode as a shape dispatcher with responsibility/tech/detail-view"
```

---

## Task 6: UML edge markers + DiagramCanvas wiring

**Files:**
- Create: `src/components/umlMarkers.tsx`
- Create: `src/components/umlMarkers.test.tsx`
- Modify: `src/components/DiagramCanvas.tsx` (full file, currently 55 lines)
- Modify: `src/components/DiagramCanvas.test.tsx` (add new test cases; keep the 2 existing tests)

**Interfaces:**
- Consumes: `UmlRelationship` (Task 1), `DiagramEdgeData` (Task 1, extended)
- Produces: `RELATIONSHIP_MARKER_IDS: Record<UmlRelationship, string | undefined>`, `UmlMarkerDefs()` (a component rendering the SVG `<defs>` for the custom markers); extended `DiagramCanvasProps` gains `onNodeDetailRequest?: (nodeId: string) => void`

- [ ] **Step 1: Write the failing test `src/components/umlMarkers.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { RELATIONSHIP_MARKER_IDS, UmlMarkerDefs } from './umlMarkers'

describe('RELATIONSHIP_MARKER_IDS', () => {
  it('maps composition and inheritance to custom marker ids', () => {
    expect(RELATIONSHIP_MARKER_IDS.composition).toBe('uml-composition')
    expect(RELATIONSHIP_MARKER_IDS.inheritance).toBe('uml-inheritance')
  })

  it('leaves association and dependency without a custom marker id', () => {
    expect(RELATIONSHIP_MARKER_IDS.association).toBeUndefined()
    expect(RELATIONSHIP_MARKER_IDS.dependency).toBeUndefined()
  })
})

describe('UmlMarkerDefs', () => {
  it('renders both custom marker definitions', () => {
    const { container } = render(<UmlMarkerDefs />)
    expect(container.querySelector('#uml-composition')).not.toBeNull()
    expect(container.querySelector('#uml-inheritance')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- umlMarkers`
Expected: FAIL — `umlMarkers.tsx` does not exist yet

- [ ] **Step 3: Write `src/components/umlMarkers.tsx`**

```tsx
import type { UmlRelationship } from '../lib/types'

export const RELATIONSHIP_MARKER_IDS: Record<UmlRelationship, string | undefined> = {
  association: undefined,
  composition: 'uml-composition',
  inheritance: 'uml-inheritance',
  dependency: undefined,
}

export function UmlMarkerDefs() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
      <defs>
        <marker
          id="uml-composition"
          viewBox="0 0 20 10"
          refX="18"
          refY="5"
          markerWidth="16"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M0 5 L9 0 L18 5 L9 10 Z" fill="var(--kind-component-fg, #c98bd6)" />
        </marker>
        <marker
          id="uml-inheritance"
          viewBox="0 0 20 14"
          refX="18"
          refY="7"
          markerWidth="18"
          markerHeight="12"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L18 7 L0 14 Z" fill="none" stroke="var(--kind-component-fg, #c98bd6)" strokeWidth="1.5" />
        </marker>
      </defs>
    </svg>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- umlMarkers`
Expected: PASS — all 3 tests

- [ ] **Step 5: Write the failing tests — append to `src/components/DiagramCanvas.test.tsx`**

Add these to the existing `describe('DiagramCanvas', ...)` block (keep the 2 existing tests), and add `type { DiagramEdgeData }` is already imported — extend the test file's edge fixtures per test as needed:

```tsx
  it('applies the composition marker for a uml-structural composition edge', () => {
    const umlEdges: DiagramEdgeData[] = [{ from: 'a', to: 'b', relationship: 'composition' }]
    const { container } = render(<DiagramCanvas nodes={nodes} edges={umlEdges} onNodeClick={() => {}} />)
    const path = container.querySelector('.react-flow__edge-path')
    expect(path?.getAttribute('marker-end')).toBe('url(#uml-composition)')
  })

  it('renders a dashed stroke for an async uml-behavioral edge', () => {
    const asyncEdges: DiagramEdgeData[] = [{ from: 'a', to: 'b', async: true }]
    const { container } = render(<DiagramCanvas nodes={nodes} edges={asyncEdges} onNodeClick={() => {}} />)
    const path = container.querySelector('.react-flow__edge-path')
    // strokeDasharray arrives via the edge's `style` prop, so it's part of the element's
    // inline `style` attribute, not a standalone XML attribute — toHaveStyle parses that
    // correctly (same pattern already used successfully in DiagramNode.test.tsx).
    expect(path).toHaveStyle({ strokeDasharray: '4 3' })
  })

  it('combines order, label, and condition into the edge label text', () => {
    const labeledEdges: DiagramEdgeData[] = [
      { from: 'a', to: 'b', label: 'calls', order: 2, condition: 'on retry' },
    ]
    render(<DiagramCanvas nodes={nodes} edges={labeledEdges} onNodeClick={() => {}} />)
    expect(screen.getByText('2. calls [on retry]')).toBeInTheDocument()
  })

  it('passes onNodeDetailRequest through to node data', async () => {
    const onNodeDetailRequest = vi.fn()
    render(
      <DiagramCanvas nodes={nodes} edges={edges} onNodeClick={() => {}} onNodeDetailRequest={onNodeDetailRequest} />
    )
    await userEvent.click(screen.getByLabelText('View details for A'))
    expect(onNodeDetailRequest).toHaveBeenCalledWith('a')
  })
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npm test -- DiagramCanvas`
Expected: FAIL — `DiagramCanvas.tsx` doesn't yet accept `onNodeDetailRequest` or translate `relationship`/`order`/`async`/`condition` into marker/style/label

- [ ] **Step 7: Replace the full contents of `src/components/DiagramCanvas.tsx`**

```tsx
import type { ComponentType } from 'react'
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DiagramNode } from './DiagramNode'
import { RELATIONSHIP_MARKER_IDS, UmlMarkerDefs } from './umlMarkers'
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
  onNodeDetailRequest?: (nodeId: string) => void
}

function buildEdgeLabel(e: DiagramEdgeData): string | undefined {
  const parts = [
    e.order !== undefined ? `${e.order}.` : null,
    e.label ?? null,
    e.condition ? `[${e.condition}]` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' ') : undefined
}

export function DiagramCanvas({ nodes, edges, onNodeClick, onNodeDetailRequest }: DiagramCanvasProps) {
  const flowNodes: Node[] = nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: {
      id: n.id,
      label: n.label,
      kind: n.kind,
      responsibility: n.responsibility,
      techStack: n.techStack,
      dataOwned: n.dataOwned,
      gotchas: n.gotchas,
      attributes: n.attributes,
      operations: n.operations,
      onOpenDetail: onNodeDetailRequest,
    },
    type: 'diagramNode',
  }))

  const flowEdges: Edge[] = edges.map((e) => {
    const markerId = e.relationship ? RELATIONSHIP_MARKER_IDS[e.relationship] : undefined
    const dashed = e.relationship === 'dependency' || e.async === true
    return {
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      label: buildEdgeLabel(e),
      markerEnd: markerId ? `url(#${markerId})` : undefined,
      style: { stroke: '#3a3e4b', strokeDasharray: dashed ? '4 3' : undefined },
      labelStyle: { fill: '#9096a8', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
      labelBgStyle: { fill: '#1b1d24' },
    }
  })

  return (
    <div style={{ width: '100%', height: '100%', background: '#14151a' }}>
      <UmlMarkerDefs />
      <ReactFlowProvider>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          fitView
          defaultEdgeOptions={{ style: { stroke: '#3a3e4b' } }}
        >
          <Background variant={BackgroundVariant.Dots} color="#2d303b" gap={20} />
          <Controls style={{ filter: 'invert(0.9) hue-rotate(180deg)' }} />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}
```

Note: `nodes: PositionedNode[]` (from `src/lib/autoLayout.ts`) already extends `DiagramNodeData`, so `n.responsibility`/`n.techStack`/etc. are already available on each positioned node without any change to `autoLayout.ts` in this plan.

- [ ] **Step 8: Update the test fixtures at the top of `src/components/DiagramCanvas.test.tsx`**

The existing `nodes` fixture (`{ id: 'a', label: 'A', kind: 'service', x: 0, y: 0 }`, `{ id: 'b', ... }`) needs no change — `kind: 'service'` is still valid. Add `userEvent` to the existing imports if not already imported (Task 7 in the original plan already imports it for the click test), and add `vi` if not already imported (it already is, from the `onNodeClick` test).

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm test -- DiagramCanvas`
Expected: PASS — all 6 tests (2 original + 4 new)

- [ ] **Step 10: Run the full suite**

Run: `npm test`
Expected: PASS — every test file green (some earlier tasks' files may still reference old field names if this step surfaces a mismatch — if so, stop and report, don't silently patch around it)

- [ ] **Step 11: Commit**

```bash
git add src/components/umlMarkers.tsx src/components/umlMarkers.test.tsx src/components/DiagramCanvas.tsx src/components/DiagramCanvas.test.tsx
git commit -m "feat: render UML relationship markers and behavioral edge decorations"
```

---

## Task 7: Detail side panel

**Files:**
- Create: `src/components/DiagramDetailPanel.tsx`
- Create: `src/components/DiagramDetailPanel.test.tsx`

**Interfaces:**
- Consumes: `DiagramNodeData`, `Notation` (Task 1)
- Produces: `DiagramDetailPanel(props: { node: DiagramNodeData | null; notation: Notation; onClose: () => void })`

- [ ] **Step 1: Write the failing test `src/components/DiagramDetailPanel.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiagramDetailPanel } from './DiagramDetailPanel'
import type { DiagramNodeData } from '../lib/types'

describe('DiagramDetailPanel', () => {
  it('renders nothing when node is null', () => {
    const { container } = render(<DiagramDetailPanel node={null} notation="c4" onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders responsibility, tech stack names, dataOwned, and gotchas when present', () => {
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'Fraud Service',
      kind: 'service',
      responsibility: 'Detects fraud',
      techStack: ['go'],
      dataOwned: 'fraud_reports',
      gotchas: ['Martingale scanner is disabled'],
    }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={() => {}} />)
    expect(screen.getByText('Fraud Service')).toBeInTheDocument()
    expect(screen.getByText('Detects fraud')).toBeInTheDocument()
    expect(screen.getByText('Go')).toBeInTheDocument()
    expect(screen.getByText('fraud_reports')).toBeInTheDocument()
    expect(screen.getByText('Martingale scanner is disabled')).toBeInTheDocument()
  })

  it('hides sections whose fields are absent', () => {
    const node: DiagramNodeData = { id: 'n1', label: 'Minimal', kind: 'service' }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={() => {}} />)
    expect(screen.queryByText('Tech stack')).not.toBeInTheDocument()
    expect(screen.queryByText('Data owned')).not.toBeInTheDocument()
    expect(screen.queryByText('Gotchas')).not.toBeInTheDocument()
  })

  it('shows attributes/operations for a class node in a uml-structural diagram', () => {
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'User',
      kind: 'class',
      attributes: ['name: string'],
      operations: ['save(): void'],
    }
    render(<DiagramDetailPanel node={node} notation="uml-structural" onClose={() => {}} />)
    expect(screen.getByText('name: string')).toBeInTheDocument()
    expect(screen.getByText('save(): void')).toBeInTheDocument()
  })

  it('hides attributes/operations for a class node when the diagram notation is not uml-structural', () => {
    const node: DiagramNodeData = {
      id: 'n1',
      label: 'User',
      kind: 'class',
      attributes: ['name: string'],
    }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={() => {}} />)
    expect(screen.queryByText('name: string')).not.toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    const node: DiagramNodeData = { id: 'n1', label: 'Minimal', kind: 'service' }
    render(<DiagramDetailPanel node={node} notation="c4" onClose={onClose} />)
    await userEvent.click(screen.getByLabelText('Close details'))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- DiagramDetailPanel`
Expected: FAIL — `DiagramDetailPanel.tsx` does not exist yet

- [ ] **Step 3: Write `src/components/DiagramDetailPanel.tsx`**

```tsx
import type { DiagramNodeData, Notation } from '../lib/types'
import { getTechIcon } from '../lib/techIcons'

export interface DiagramDetailPanelProps {
  node: DiagramNodeData | null
  notation: Notation
  onClose: () => void
}

const sectionHeadingStyle = { fontSize: 12, textTransform: 'uppercase' as const, color: 'var(--text-muted)' }

export function DiagramDetailPanel({ node, notation, onClose }: DiagramDetailPanelProps) {
  if (!node) return null

  const showClassMembers = node.kind === 'class' && notation === 'uml-structural'

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        padding: 16,
        overflowY: 'auto',
      }}
    >
      <button
        aria-label="Close details"
        onClick={onClose}
        style={{ float: 'right', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14 }}
      >
        ✕
      </button>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>{node.label}</h2>
      {node.responsibility && <p>{node.responsibility}</p>}

      {node.techStack && node.techStack.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Tech stack</h3>
          <ul>
            {node.techStack.map((id) => (
              <li key={id}>{getTechIcon(id).label}</li>
            ))}
          </ul>
        </section>
      )}

      {node.dataOwned && (
        <section>
          <h3 style={sectionHeadingStyle}>Data owned</h3>
          <p>{node.dataOwned}</p>
        </section>
      )}

      {node.gotchas && node.gotchas.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Gotchas</h3>
          <ul>
            {node.gotchas.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}

      {showClassMembers && node.attributes && node.attributes.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Attributes</h3>
          <ul>
            {node.attributes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {showClassMembers && node.operations && node.operations.length > 0 && (
        <section>
          <h3 style={sectionHeadingStyle}>Operations</h3>
          <ul>
            {node.operations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- DiagramDetailPanel`
Expected: PASS — all 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/DiagramDetailPanel.tsx src/components/DiagramDetailPanel.test.tsx
git commit -m "feat: add node detail side panel"
```

---

## Task 8: Wire DiagramPage to the detail panel

**Files:**
- Modify: `src/components/DiagramPage.tsx` (full file, currently 77 lines)
- Modify: `src/components/DiagramPage.test.tsx` (add new test cases; keep the 3 existing tests)

**Interfaces:**
- Consumes: `DiagramDetailPanel` (Task 7), `onNodeDetailRequest` prop on `DiagramCanvas` (Task 6)

- [ ] **Step 1: Write the failing tests — append to `src/components/DiagramPage.test.tsx`**

Add these to the existing `describe('DiagramPage', ...)` block:

```tsx
  it('opens the detail panel when a node\'s view-more button is clicked', async () => {
    renderAt('/')
    await userEvent.click(screen.getByLabelText('View details for API Service'))
    expect(await screen.findByLabelText('Close details')).toBeInTheDocument()
  })

  it('closes the detail panel when its close button is clicked', async () => {
    renderAt('/')
    await userEvent.click(screen.getByLabelText('View details for API Service'))
    await userEvent.click(await screen.findByLabelText('Close details'))
    expect(screen.queryByLabelText('Close details')).not.toBeInTheDocument()
  })

  it('renders the root deployment diagram with the same content as before this feature', () => {
    // Regression guard: `notation` defaults to 'c4' when absent, so a diagram with no
    // `notation` field must render identically to one with `notation: "c4"` set explicitly
    // (Task 9 sets it explicitly on deployment.json — either way this assertion holds).
    // Asserts the same "Home"/"API Service" content the original v1 test checked.
    renderAt('/')
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('API Service')).toBeInTheDocument()
  })
```

`userEvent` needs to be imported in this test file if it isn't already — check the top of `src/components/DiagramPage.test.tsx`; if missing, add `import userEvent from '@testing-library/user-event'` alongside the existing `@testing-library/react` import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- DiagramPage`
Expected: FAIL — `DiagramPage.tsx` doesn't yet render a detail panel or pass `onNodeDetailRequest`

- [ ] **Step 3: Replace the full contents of `src/components/DiagramPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadDiagram } from '../lib/loadDiagram'
import { resolveDiagramPath } from '../lib/resolveDiagramPath'
import { DiagramNotFoundError } from '../lib/types'
import type { Diagram } from '../lib/types'
import { layoutDiagram } from '../lib/autoLayout'
import { DiagramCanvas } from './DiagramCanvas'
import { Breadcrumb } from './Breadcrumb'
import { DiagramDetailPanel } from './DiagramDetailPanel'

type Resolution = { chain: Diagram[] } | { notFoundId: string }

export function DiagramPage() {
  const params = useParams()
  const navigate = useNavigate()
  const segments = useMemo(
    () => (params['*'] ?? '').split('/').filter(Boolean),
    [params['*']]
  )
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

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
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100dvh',
          gap: 8,
          background: '#14151a',
          color: '#e7e8ed',
          fontFamily: "'Outfit', system-ui, sans-serif",
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>Diagram not found</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#9096a8' }}>
          {resolution.notFoundId}
        </span>
      </div>
    )
  }

  const current = resolution.chain[resolution.chain.length - 1]
  const positionedNodes = layoutDiagram(current.nodes, current.edges)
  const labels = ['Home', ...resolution.chain.slice(1).map((d) => d.title)]
  const selectedNode = current.nodes.find((n) => n.id === selectedNodeId) ?? null

  function handleNodeClick(nodeId: string) {
    const node = current.nodes.find((n) => n.id === nodeId)
    if (!node?.childDiagram) return
    navigate(`/${[...segments, nodeId].join('/')}`)
  }

  function handleBreadcrumbNavigate(index: number) {
    setSelectedNodeId(null)
    navigate(`/${segments.slice(0, index).join('/')}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      <Breadcrumb labels={labels} onNavigate={handleBreadcrumbNavigate} />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1 }}>
          <DiagramCanvas
            nodes={positionedNodes}
            edges={current.edges}
            onNodeClick={handleNodeClick}
            onNodeDetailRequest={setSelectedNodeId}
          />
        </div>
        <DiagramDetailPanel
          node={selectedNode}
          notation={current.notation ?? 'c4'}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
    </div>
  )
}
```

Note: `handleBreadcrumbNavigate` now also clears `selectedNodeId` — navigating to a different diagram level while a stale node id from the previous diagram stays "selected" would either show nothing (id doesn't match any node in the new diagram) or, worse, coincidentally match an unrelated node with the same id in the new diagram. Clearing on navigation avoids both.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- DiagramPage`
Expected: PASS — all 6 tests (3 original + 3 new)

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS — every test file green

- [ ] **Step 6: Commit**

```bash
git add src/components/DiagramPage.tsx src/components/DiagramPage.test.tsx
git commit -m "feat: wire diagram page to the node detail panel"
```

---

## Task 9: Migrate the sample diagrams

**Files:**
- Modify: `diagrams/deployment.json`
- Modify: `diagrams/api-service.components.json`
- Modify: `diagrams/auth-module.flow.json`

**Interfaces:**
- Consumes: everything above — this task is content-only, no code changes

- [ ] **Step 1: Replace `diagrams/deployment.json`**

```json
{
  "id": "deployment",
  "title": "Deployment",
  "notation": "c4",
  "nodes": [
    {
      "id": "web-frontend",
      "label": "Web Frontend",
      "kind": "external",
      "responsibility": "Browser client used by end users"
    },
    {
      "id": "api-service",
      "label": "API Service",
      "kind": "service",
      "childDiagram": "api-service.components",
      "responsibility": "Serves the public HTTP API",
      "techStack": ["typescript", "nodejs"]
    },
    {
      "id": "database",
      "label": "Database",
      "kind": "database",
      "responsibility": "Stores persistent application data",
      "techStack": ["postgresql"]
    }
  ],
  "edges": [
    { "from": "web-frontend", "to": "api-service", "label": "HTTPS" },
    { "from": "api-service", "to": "database", "label": "SQL" }
  ]
}
```

- [ ] **Step 2: Replace `diagrams/api-service.components.json`**

```json
{
  "id": "api-service.components",
  "title": "API Service — Components",
  "notation": "c4",
  "nodes": [
    {
      "id": "auth-module",
      "label": "Auth Module",
      "kind": "component",
      "childDiagram": "auth-module.flow",
      "responsibility": "Authenticates requests and issues tokens",
      "techStack": ["typescript"]
    },
    {
      "id": "orders-module",
      "label": "Orders Module",
      "kind": "component",
      "responsibility": "Manages order lifecycle",
      "techStack": ["typescript"]
    }
  ],
  "edges": [
    { "from": "auth-module", "to": "orders-module", "label": "authorizes" }
  ]
}
```

- [ ] **Step 3: Replace `diagrams/auth-module.flow.json`**

```json
{
  "id": "auth-module.flow",
  "title": "Auth Module — Flow",
  "notation": "uml-behavioral",
  "nodes": [
    { "id": "validate-credentials", "label": "Validate credentials", "kind": "component" },
    { "id": "issue-token", "label": "Issue token", "kind": "component" }
  ],
  "edges": [
    {
      "from": "validate-credentials",
      "to": "issue-token",
      "label": "on success",
      "order": 1,
      "async": false,
      "condition": "credentials valid"
    }
  ]
}
```

- [ ] **Step 4: Run the full suite and the validation script**

Run: `npm test && npm run validate`
Expected: all tests pass; `✓ 3 diagram(s) validated OK`

- [ ] **Step 5: Manually verify in the browser**

Run: `npm run dev`, open the printed local URL. Confirm: `Web Frontend` renders as a dashed rounded box (external shape), `API Service` renders with a top header bar (service shape) and two small tech-icon badges bottom-right, `Database` renders as a cylinder. Click the eye icon on `API Service` — a side panel opens showing its responsibility and tech stack names. Close it. Drill into `API Service` → `Auth Module` → confirm `Auth Module`'s flow diagram edge shows "1. on success [credentials valid]" as its label (the `order`/`condition` combination). Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add diagrams/deployment.json diagrams/api-service.components.json diagrams/auth-module.flow.json
git commit -m "feat: migrate sample diagrams to the rich content model"
```

---

## Task 10: Final regression pass

**Files:** none (verification-only task)

- [ ] **Step 1: Run the full suite one more time**

Run: `npm test`
Expected: all tests across all 9 test files from this plan plus the original suite pass, pristine output (no unexpected warnings beyond the already-known, pre-existing react-router-dom future-flag notices).

- [ ] **Step 2: Run validation**

Run: `npm run validate`
Expected: `✓ 3 diagram(s) validated OK`

- [ ] **Step 3: Confirm no stray build artifacts were left uncommitted**

Run: `git status --short`
Expected: clean (no untracked `*.tsbuildinfo`/`vite.config.js`/`vite.config.d.ts` — if `npm run build` was run manually at any point during this plan's execution and left these, remove them; they are build byproducts, not source).

- [ ] **Step 4: Commit if Step 3 required cleanup, otherwise this task produces no commit**
