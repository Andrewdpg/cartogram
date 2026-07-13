# Rich node/edge content model (C4 + UML + technical datasheet) — design spec

Date: 2026-07-06
Status: approved (sections confirmed in brainstorming session)
Sub-project: 1 of 3 (see `docs/superpowers/specs/2026-07-06-backend-auth-proposal.md` and
`docs/superpowers/specs/2026-07-06-mcp-agent-proposal.md` for the other two — not designed yet,
scoping only)

## Purpose

The first version of architecture-map (see `2026-07-06-architecture-map-design.md`) renders every
node as the same rounded rectangle, differing only by border color per `kind`. User feedback after
using it: "a square with a title isn't engineering, it's a drawing — every box and every line needs
to mean something." This spec replaces the flat node/edge model with:

1. **Real semantic shapes per node kind** — a database looks like a database, a service looks like
   a service, not "a rectangle with a different color."
2. **A small, mostly-optional content model per node** — a one-line responsibility, tech-stack
   icons, and (behind a "view more" toggle) owned data and gotchas.
3. **A notation system per diagram** — C4 for high-level/basic diagrams, UML-structural (class
   diagram style) or UML-behavioral (sequence/process style) for detailed technical diagrams,
   selected per diagram file, not mixed within one canvas.

## Non-goals

- No inline/mixed notations within a single diagram (a diagram is C4 XOR uml-structural XOR
  uml-behavioral, never a blend) — keeps each canvas visually coherent.
- No live/generated diagrams from source code in this sub-project — data is still hand-authored
  JSON, one file per diagram (unchanged from the original design). Backend storage and
  agent-driven generation are explicitly out of scope here (sub-projects 2 and 3).
- No new relationship/notation types beyond what's specified below — YAGNI; add more later if a
  real diagram needs one, since this is just a lookup-map extension, not a schema rewrite.

## Node kind taxonomy and shapes

`kind` still exists on every node, but each value now maps to a distinct shape/renderer, not just a
border color:

| `kind` | Shape | Used in |
|---|---|---|
| `system` | Rounded rect, dashed border if external | C4 |
| `container` | Rect with a tech-icon strip | C4 |
| `component` | UML component notation (rect with two tab notches on the left edge) | C4, uml-structural |
| `service` | Rect with a colored header bar | C4, uml-behavioral |
| `server` | Distinct infra/rack icon shape | C4 |
| `database` | Cylinder | any |
| `class` | UML class box (name / attributes / operations compartments) | uml-structural |
| `external` | Existing actor/external shape (unchanged from v1) | any |

Each shape is its own small render component, keyed by `kind` in a lookup map (same architectural
pattern as v1's `KIND_STYLES`, just mapping to a shape component instead of a color object).
Adding a new kind later means adding one entry to the map, not a schema change.

## Node content model

All new fields are optional — a node with just `id`/`label`/`kind` remains valid.

- **`responsibility?: string`** — one sentence, always visible on the node face alongside the label.
- **`techStack?: string[]`** — tech identifiers (e.g. `"go"`, `"react"`, `"postgres"`), rendered as
  real brand-logo icons (via the `simple-icons` package) in the bottom-right corner of the node,
  icons only, no text labels. An id not found in `simple-icons`' catalog falls back to a generic
  chip icon. Names appear only in the detail view.
- **`dataOwned?: string`** and **`gotchas?: string[]`** — never shown on the node face, only in
  the detail view.
- **Detail view trigger**: a small eye icon, top-right of the node. Opens a **side panel** (not a
  modal) so the diagram stays visible while reading — shows full responsibility, tech stack with
  names, `dataOwned`, `gotchas`, and any notation-specific fields (e.g. a `class` node's
  `attributes`/`operations` when the diagram's notation is `uml-structural`).
- **`interfaces` is explicitly NOT a generic field** — it isn't universal across node kinds/notations;
  where a notation needs it (e.g. a UML class's operations list), it's expressed via that
  notation's own fields (`operations`), not a shared cross-cutting field.

## Notation system

Every diagram file gains an optional root field:

```ts
notation?: 'c4' | 'uml-structural' | 'uml-behavioral'   // default 'c4' if absent
```

Notation is per-diagram, never per-node or mixed within one file. It controls two things:

1. **Which extra node fields are meaningful.** Only `class` nodes in a `uml-structural` diagram
   read `attributes`/`operations`. Other combinations ignore them if present (no validation error
   for setting them elsewhere — they're just inert).
2. **How edges render:**
   - `c4`: existing behavior — a plain arrow, optional free-text `label`.
   - `uml-structural`: edges carry `relationship: 'association' | 'composition' | 'inheritance' | 'dependency'`,
     each rendered with the correct UML arrowhead (open triangle for inheritance, filled diamond
     for composition, etc.) instead of a generic arrow.
   - `uml-behavioral`: edges carry `order?: number` (explicit sequence numbering when layout alone
     doesn't make it obvious), `async?: boolean` (dashed vs solid line, sequence-diagram style),
     and `condition?: string` (a branch label, e.g. "on failure").

Diagrams with no `notation` field behave exactly as v1 did (implicit `c4`, plain edges) — fully
backward compatible with the existing 3 sample diagrams without any required edits.

## Data schema (consolidated)

```ts
export type NodeKind =
  | 'system' | 'container' | 'component' | 'service'
  | 'server' | 'database' | 'class' | 'external'

export type Notation = 'c4' | 'uml-structural' | 'uml-behavioral'

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
  attributes?: string[]   // meaningful only when kind === 'class' && diagram notation === 'uml-structural'
  operations?: string[]   // ditto
}

export interface DiagramEdgeData {
  from: string
  to: string
  label?: string
  relationship?: 'association' | 'composition' | 'inheritance' | 'dependency'  // uml-structural
  order?: number      // uml-behavioral
  async?: boolean     // uml-behavioral
  condition?: string  // uml-behavioral
}

export interface Diagram {
  id: string
  title: string
  notation?: Notation
  nodes: DiagramNodeData[]
  edges: DiagramEdgeData[]
}
```

`NodeKind` replaces v1's free-form `kind: string` with a closed union — every value now has a
defined shape, so an unrecognized kind is a real validation error (via `validateDiagramShape`),
not a silent fallback to a default color as in v1. This is a deliberate tightening: v1's open
string + fallback style made sense when `kind` only drove color; now that it drives which shape
renders, an unknown kind is a real authoring mistake worth catching at `npm run validate` time.

## Validation changes

`validateDiagramShape` (existing, `src/lib/validateDiagram.ts`) extends to check, per node/edge,
only when the corresponding optional field is present:
- `kind` must be one of the eight `NodeKind` values (previously any string was accepted).
- `notation`, if present, must be one of the three valid values.
- `techStack`/`gotchas`/`attributes`/`operations`, if present, must be `string[]`.
- `relationship`, if present, must be one of the four valid values.
- `order`, if present, must be a number; `async`, if present, must be a boolean.

Same error style as today: throw `InvalidDiagramError` naming the diagram id, the node/edge, and
the specific problem — no new error type needed.

## Migration of the existing 3 sample diagrams

Not required for correctness (all three remain valid with no `notation` field, defaulting to
`c4`), but done anyway so the shipped examples demonstrate the new capability:

- `deployment.json` — stays `c4` (correct level for it); nodes gain `responsibility`/`techStack`.
- `api-service.components.json` — stays `c4`; same treatment.
- `auth-module.flow.json` — becomes `notation: "uml-behavioral"`; its edges gain `order`/`async` —
  this is the example that demonstrates a "complex process," per the original feedback.

## Testing scope

- Unit tests for the extended `validateDiagramShape` checks (new `NodeKind`/`Notation`/relationship
  enum validation, array-type checks on the new optional fields) — same file/pattern as v1's
  existing validation tests.
- A rendering test per new shape component (one node renders with the right shape/icon for each
  `NodeKind`), following the pattern of v1's `DiagramNode.test.tsx`.
- A test for the detail-panel toggle (eye icon opens/closes the panel, panel shows `dataOwned`/
  `gotchas` when present, hides the section when absent).
- A test confirming a diagram with no `notation` field renders identically to how v1 rendered it
  (backward-compatibility regression guard).
