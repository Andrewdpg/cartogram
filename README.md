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
