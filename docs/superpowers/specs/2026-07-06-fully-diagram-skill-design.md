# `sourceRefs` field + `/fully-diagram` skill — design spec

Date: 2026-07-06
Status: approved (sections confirmed in brainstorming session)

## Purpose

architecture-map (see the two prior design specs in this same directory) can render a rich,
semantically-shaped diagram, but every diagram today is hand-authored. The user wants a way to
point an agent at any codebase (a single repo, or a family of sibling repos that form one system)
and have it produce a **complete, deeply-detailed, drill-down diagram tree** automatically —
grounded in real code, not prose the agent made up.

This is two small, tightly-coupled pieces:

1. A schema addition to architecture-map itself: `sourceRefs` on nodes, so every claim a diagram
   makes ("this is what this component does") can be traced back to the exact file/function that
   justifies it.
2. A new, **global** Claude Code skill, `/fully-diagram`, usable against any project — not specific
   to any one codebase. `risk` (the multi-repo project this whole tool was born out of) is the
   first real test case, but nothing project-specific belongs in the skill itself.

## Non-goals

- Not a live/continuously-syncing generator (that's the previously-scoped, still-undesigned
  sub-project 3 "MCP agent" proposal) — this skill runs on demand, once, when invoked.
- Not a fixed depth ("always 3 levels") — depth is a function of real code complexity (see
  Depth and content gates below), not a configured number.
- Not multi-repo-aware by hardcoding — the skill detects whether it's looking at one repo or a
  family of sibling repos generically (presence of multiple immediate subdirectories that are each
  their own git repo), never by name.

## Schema addition: `sourceRefs`

```ts
export interface DiagramNodeData {
  // ...existing fields unchanged...
  sourceRefs?: string[]
}
```

Free-form strings, each pointing at real code: a bare path (`"internal/service/fraud/fraudService.go"`,
whole file), a path with a line range (`"internal/service/fraud/hft/detector.go:112-173"`), or a
path with a symbol (`"internal/service/fraud/fraudService.go#RunHFTReport"`). No structured
parsing/validation of the reference format itself (YAGNI — a human or a future tool can add
click-to-open later; today it's just a trusted string a diagram author, human or agent, wrote).

Shown in `DiagramDetailPanel`'s existing "ver más" panel, as a monospace list, only when present
(same optional-section pattern as `dataOwned`/`gotchas`).

`validateDiagramShape` gains one more optional-field check: if present, `sourceRefs` must be
`string[]` (same `isStringArray` helper already used for `techStack`/`gotchas`/`attributes`/
`operations`).

## The `/fully-diagram` skill

### Location and invocation

Global skill: `~/.claude/skills/fully-diagram/SKILL.md`. Invoked from within an architecture-map
checkout (i.e. `cwd` has `diagrams/`, `package.json` named `architecture-map`, `scripts/
validate-diagrams.ts`) with an argument pointing at the codebase to investigate — defaulting to
the checkout's parent directory if no argument is given (this matches how the tool is meant to be
set up per its own README: clone architecture-map as a sibling/child of the code you want to map).

### Scope detection (generic, no project names)

1. Resolve the target path (argument or default).
2. List immediate subdirectories of the target. For each one, check if it's its own git repository
   (has its own `.git`). If **two or more** are, treat the target as a **multi-repo system** — one
   top-level node per such subdirectory. If **zero or one** is (or the target itself is a git repo
   with no such subdirectories), treat the **target itself** as a **single-repo system** — the
   root diagram has exactly one top-level node (or, for a single repo, the root diagram can skip
   straight to that repo's own component breakdown, since a 1-node "deployment" diagram adds
   nothing).

### Indexing

For every repo now in scope (each multi-repo child, or the single repo), check
`codebase-memory-mcp`'s `list_projects`. If not present, index it with `index_repository`
(`mode: "moderate"` — richer than the navigation-only `"fast"` mode, because this skill's whole
job is depth). Do this before dispatching any investigation subagent — a subagent should never
have to wait on indexing itself.

### Orchestration flow

1. **Provisional root diagram.** The orchestrator (whoever is running this skill) writes a
   `deployment.json` (multi-repo case) with one node per repo — `label`/`kind` only, no edges yet,
   no `childDiagram` yet (added once its subagent reports back). Single-repo case: skip this file
   entirely, go straight to step 2 for the one repo.
2. **One subagent per top-level node**, dispatched with the full depth/content contract below.
   Each subagent:
   - Investigates its repo primarily via `codebase-memory-mcp` (`get_architecture`, `search_graph`,
     `trace_path`, `query_graph`) — Grep/Read only for text the graph doesn't cover (READMEs,
     config files, comments needed for `gotchas`).
   - Produces a full recursive diagram tree for its repo under architecture-map's `diagrams/`
     folder, following the depth/content gates below.
   - Reports back: the file(s) it wrote, its top-level `childDiagram` id (for the orchestrator to
     wire into the root node), and any **cross-repo signals** it found in its own code (an import
     of another repo's client package, a REST/gRPC call to a URL matching another repo's known
     host, an env var whose name/value points at another service) — each signal cites the file/line
     that evidenced it, same discipline as everything else in this skill.
3. **Finalize the root diagram.** The orchestrator sets each root node's `childDiagram` from step
   2's reports, and builds `edges` from the collected cross-repo signals — each edge gets a
   `label` and, where useful, `sourceRefs` pointing at the evidence (e.g. the env var line in the
   calling repo).
4. **Quality spot-check.** The orchestrator walks the full produced tree looking for
   suspiciously-shallow branches: a `components`-level diagram with only one node, or a repo/node
   with many source files but no `childDiagram` at all. For each one found, re-dispatch that
   specific subagent with a pointed instruction naming exactly what looked shallow and why (not a
   generic "try harder").
5. **Validate and report.** Run `npm run validate`. Report to the user: repos investigated,
   diagram file count, total node count, and any branches that needed a re-dispatch in step 4.

### Depth and content gates (the core anti-shallowness mechanism)

These bind every subagent (and the orchestrator's own quality spot-check uses them as its test):

1. **Objective depth gate.** A node must NOT be left as a leaf (no `childDiagram`) if its
   corresponding code spans more than one file, OR contains a single function/method longer than
   ~30-40 lines, OR exposes more than one public symbol worth distinguishing. Any of these →
   `childDiagram` is mandatory. Only genuinely small units (one small file, one function, a simple
   config) may terminate.
2. **Stopping-justification gate.** To mark a node as a leaf, the agent must be able to name the
   specific file(s)/function(s) it actually read that justify stopping. "This seemed simple enough"
   without a citation is not an acceptable reason — same evidentiary bar as a code-review finding.
3. **Content-completeness gate.** Every node, at whatever level it ends at, must have
   `responsibility` (grounded in code actually read, not invented) AND at least two of
   `{techStack, dataOwned, gotchas}` filled with concrete, source-cited content, AND `sourceRefs`
   pointing at what was read to write those fields. A node with only `label`+`kind` fails this gate
   automatically.
4. **Self-audit before reporting.** Before a subagent reports DONE, it re-reads its own produced
   diagram files and checks for: vague `responsibility` text (generic phrases like "handles
   things", "manages stuff"), or a node with clear multi-file complexity left as an unjustified
   leaf. Fix before reporting, don't report first and fix later.
5. **Orchestrator spot-check (already in the flow above, step 4)** — the outer loop that catches
   anything an individual subagent's self-audit missed.

## Testing / verification scope

- The `sourceRefs` schema addition follows the exact same TDD pattern as every other optional
  field added to `validateDiagramShape` in the prior rich-node-model plan — a unit test asserting
  it's accepted when a valid `string[]`, rejected otherwise.
- `DiagramDetailPanel` gains one more conditional section, tested the same way as its existing
  `dataOwned`/`gotchas` sections (renders when present, absent when not).
- The skill itself (a markdown instruction document, not application code) has no automated test —
  its "test" is running it once against a real multi-repo target (this spec's own author intends to
  run it against `risk`, indexed and cloned into `risk/archmap` already) and confirming the gates
  actually produced deep, cited content rather than shallow stubs.
