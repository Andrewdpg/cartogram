# architecture-map — design spec

Date: 2026-07-06
Status: approved (sections confirmed in brainstorming session)

## Purpose

Personal, reusable tool to explore the architecture of a codebase as an interactive,
recursive drill-down map, instead of static Mermaid diagrams. Three conceptual levels
(deployment → components → flow) are not hardcoded — the same diagram file format
supports any depth, any "kind" of diagram, recursively.

Built once, reused across projects by swapping the `diagrams/` content folder only.
No project-specific code.

## Non-goals

- Not a live/auto-generated diagram from source code (data is hand-authored).
- Not multi-user / hosted — runs locally via `npm run dev` for a single person.
- Not inline/nested rendering (a node does not expand in-place to show its child
  diagram) — navigation is full drill-down (see Navigation).

## Architecture

Vite + React + TypeScript SPA. Diagram rendering via `@xyflow/react` (React Flow),
auto-layout via `dagre`. Client-side routing via React Router, where the URL path
IS the drill-down stack.

```
architecture-map/
├── diagrams/                        # content — the only thing that changes between projects
│   ├── deployment.json
│   ├── sfrcoreback.components.json
│   ├── fraud-service.flow.json
│   └── ...
├── scripts/
│   └── validate-diagrams.ts         # npm run validate — checks referential integrity
├── src/
│   ├── components/
│   │   ├── DiagramCanvas.tsx        # generic React Flow wrapper
│   │   ├── DiagramNode.tsx          # custom node, styled by `kind`
│   │   ├── Breadcrumb.tsx           # derived from URL, no own state
│   │   └── DiagramPage.tsx          # resolves current diagram file from route, loads it
│   ├── lib/
│   │   ├── loadDiagram.ts           # fetch/import + shape check of a diagram file
│   │   ├── autoLayout.ts            # dagre wrapper, LR rankdir
│   │   └── types.ts                 # Diagram, DiagramNode, DiagramEdge
│   └── App.tsx                      # routes
└── package.json
```

## Data format

One JSON file per diagram, regardless of conceptual "level" — level is a naming
convention for the human author, not a concept the code enforces.

```jsonc
{
  "id": "sfrcoreback.components",
  "title": "sfrcoreback — Components",
  "nodes": [
    {
      "id": "fraud-service",
      "label": "Fraud Service",
      "kind": "service",
      "childDiagram": "fraud-service.flow"   // optional — presence makes the node clickable
      // "x": 120, "y": 40                   // optional — overrides auto-layout for this node
    },
    { "id": "risk-service", "label": "Risk Service", "kind": "service" }
  ],
  "edges": [
    { "from": "fraud-service", "to": "risk-service", "label": "reads trading_properties" }
  ]
}
```

A node with no `childDiagram` is a leaf — end of recursion on that branch. There is
no limit on depth; a `flow` diagram's node could itself have a `childDiagram` if the
author wants to go deeper.

## Navigation

React Router path segments are the drill-down stack, one segment per clicked node id:

```
/                                  → diagrams/deployment.json
/sfrcoreback                       → diagrams/sfrcoreback.components.json
/sfrcoreback/fraud-service         → diagrams/fraud-service.flow.json
```

Clicking a node with `childDiagram` navigates to `<currentPath>/<nodeId>`.
`DiagramPage` resolves the diagram file to load from the last path segment's
`childDiagram` reference (root path always loads `deployment`). Browser back/forward
work for free because navigation is real routing, not client-only state.
`Breadcrumb` derives its trail from `useLocation().pathname`, no separate state.

## Styling

`kind` is a free-form string. A style map in `DiagramNode.tsx` associates known kinds
(`service`, `bridge`, `database`, `component`, `external`, ...) with a color/icon;
unknown kinds fall back to a default gray style. Adding a new visual category means
editing the style map; using an existing kind in a new diagram requires no code
change.

## Layout

`autoLayout.ts` wraps `dagre` (`rankdir: 'LR'`) to compute `x`/`y` for every node from
`nodes`/`edges` alone — diagram JSON files normally carry no coordinates. A node may
set `x`/`y` explicitly to override the computed position for that one node.

## Error handling

If `childDiagram` references a file that does not exist, `loadDiagram.ts` surfaces
this as a typed error and `DiagramPage` renders a "diagram not found: `<id>`" state
instead of crashing — the expected failure mode given these files are hand-edited.

## Reusability across projects

`diagrams/` is discovered via Vite's `import.meta.glob('./diagrams/*.json')` — no
central registry/index file to maintain. Reusing the tool for a different project
means cloning the repo and replacing the contents of `diagrams/` only; no source
change required.

## Validation script (the non-trivial-logic check)

`scripts/validate-diagrams.ts` (`npm run validate`) walks every file in `diagrams/`
and checks:
1. every `edges[].from` / `edges[].to` matches a `nodes[].id` in the same file;
2. every `nodes[].childDiagram` matches an existing file in `diagrams/`.

Exits non-zero with the offending file + id on any failure. This is the graph-parsing
logic in the project or all data files, so it gets a check.

## Testing scope

No component/unit test framework for this personal tool — the validation script is
the single runnable check for referential integrity (the one place with real logic:
graph reference resolution). UI is verified manually via `npm run dev`.
