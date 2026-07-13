# architecture-map

Personal, project-agnostic tool to explore a codebase's architecture as an
interactive, recursively drill-down-able map — instead of static Mermaid
diagrams. Every box has a real semantic shape and real engineering content
(responsibility, tech stack, data owned, gotchas), not just a colored
rectangle with a title.

## Usage

    npm install
    supabase start  # Start the backend (see "Backend (Supabase)" section)
    npm run dev

Click any node that looks clickable (it has a `childDiagram`) to drill down
one level. Use the breadcrumb at the top to go back up — the browser's back
button also works. Click the eye icon on a node to open its detail panel.

The side panel has three tabs:
- **Details** — the selected node's responsibility, tech stack, data owned,
  gotchas, and (for UML class nodes) attributes/operations.
- **Edit JSON** — the current diagram's raw JSON, editable in-session (Apply
  re-validates and re-renders; changes are not written back to disk).
- **Legend** — every node shape and edge style rendered live, so it can't
  drift from what's actually on screen.

## Backend (Supabase)

Diagrams are stored in Supabase (Postgres), not local files. To run the
backend locally:

    supabase start

This starts a local Postgres + Auth stack via Docker and prints an API URL,
anon key, and service_role key. Apply schema changes with:

    supabase db reset

Run the RLS/access-control test suite with:

    supabase test db

Schema and policies live under `supabase/migrations/`; access-control tests
live under `supabase/tests/database/`.

## Authoring diagrams

Diagrams are stored in Supabase, not local files — create and edit them from
the web app, or via the MCP server. `diagrams/*.json` in this repo are
reference examples of the JSON shape only (used by `scripts/validate-diagrams.ts`
as a schema-validation fixture) — editing them has no effect on the running
app. A diagram has:

- `notation` (optional, defaults to `"c4"`): `"c4"` for a high-level
  system/container/component view, `"uml-structural"` for a class-diagram-style
  detailed design, or `"uml-behavioral"` for a sequence/process view. One
  notation per diagram file — never mixed within one.
- `nodes`: each with `id`, `label`, `kind`, and optionally `childDiagram` (to
  make it clickable), plus the content fields below.
- `edges`: each with `from`/`to`, an optional `label`, and (depending on
  notation) `relationship`, `order`, `async`, `condition`.

No coordinates needed — layout is computed automatically; a node may set its
own `x`/`y` to override the computed position.

### Node `kind` (drives the shape, not just the color)

`system`, `container`, `component`, `service`, `server`, `database`, `class`,
`external`, `bridge` — each renders as a genuinely distinct shape (a database
is a cylinder, a class is a 3-compartment UML box, a bridge has connector
notches on both sides, etc.). See `src/components/nodeShapes.tsx`, or the
Legend tab in the running app, to see them all.

### Node content fields (all optional)

- `responsibility` — one sentence, always visible on the node face.
- `techStack` — array of tech ids (e.g. `"go"`, `"react"`, `"postgresql"`);
  rendered as real brand-logo icons (via `simple-icons`, with a colored
  monogram fallback for anything not in its catalog) in the node's corner and
  by name in the detail panel.
- `dataOwned`, `gotchas` — shown only in the detail panel.
- `attributes`, `operations` — shown only for a `class`-kind node in a
  `uml-structural` diagram, in both the node face and the detail panel.
- `sourceRefs` — array of strings pointing at the real code a node's claims
  are grounded in (a bare path, a path with a line range, or a path with a
  `#symbol`), shown as a monospace list in the detail panel. Not validated
  beyond "is a string[]" — it's a trusted citation, not a parsed reference.

Run `npm run validate` after editing diagrams to catch typos: an unknown
`kind`/`notation`/`relationship`, a malformed optional field, an edge
referencing an unknown node id, or a `childDiagram` pointing at a file that
doesn't exist.

## Reusing this for another project

Clone this repo, delete the contents of `diagrams/`, and author a new set of
JSON files for the other project. No source changes needed — `diagrams/` is
the only project-specific part of this tool.

## Adding a new shape

Node shape is driven by the closed `NodeKind` enum (`src/lib/types.ts`), each
mapped to its own render component in `src/components/nodeShapes.tsx`'s
`NODE_SHAPES` map. Add a new `NodeKind` value and a matching shape component
there to introduce a new visual category — `validateDiagramShape` rejects any
`kind` not in the enum, so an unrecognized kind is a caught authoring mistake,
not a silent fallback.

## Known limitation

`npm run build` (`tsc -b`) currently fails on a `vite`/`vitest` type-version
mismatch unrelated to this project's own code — `npm run dev`, `npm test`, and
`npm run validate` are all unaffected. Not yet fixed since nothing in this
project's own workflow calls `npm run build`.
