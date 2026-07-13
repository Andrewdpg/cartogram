# Sub-project 3: MCP server for agent-driven diagram generation/maintenance — scope proposal

Date: 2026-07-06
Status: SCOPED ONLY — not designed. Requires its own full brainstorming session
(superpowers:brainstorming) before any implementation plan is written.

## Why this exists

Hand-authoring `diagrams/*.json` works, but the user's stated goal is for an agent (Claude Code or
similar, connected over MCP) to generate new diagrams from a real codebase and/or keep existing
diagrams in sync as that codebase changes — so architecture-map's content stays current without a
human re-drawing it by hand every time the system it documents evolves.

## Stated intent (from the user, verbatim scope — not yet refined into requirements)

- An MCP server that an agent (e.g. Claude Code) can connect to.
- The agent should be able to **generate** diagrams (presumably from analyzing a target codebase)
  and/or **maintain** them — keep them "always up to date" as the underlying code changes.

## Dependencies

- **Sub-project 1 (hard dependency):** an MCP tool surface needs a stable, well-typed diagram
  schema to read/write against — generating a diagram means producing valid
  `Diagram`/`DiagramNodeData`/`DiagramEdgeData` JSON (with the new `kind`/`notation`/content
  fields), and "maintaining" one means diffing/patching against that same shape. Building this
  before sub-project 1's schema is finalized would mean redoing the tool contract almost
  immediately.
- **Sub-project 2 (soft dependency, sequencing question for the future session to resolve):**
  "keep them always up to date" implies some notion of *where the diagram lives that the agent
  writes to* being the same place a human later views — if diagrams move server-side with
  per-user ownership (sub-project 2), the MCP server's write target is that backend's API, not
  files. If sub-project 2 never happens (or happens much later), the MCP server could instead
  operate directly on `diagrams/*.json` in a target repo. This sequencing question needs the
  earlier proposal's file↔DB sync question answered first.

## Open questions a future brainstorming session must resolve (not decided here)

- **Generation strategy:** does the agent generate diagrams purely from its own codebase
  understanding (reading source, inferring architecture), or does this project expose additional
  MCP tools that do structural analysis for it (e.g. reusing something like the `codegraph`/
  `codebase-memory-mcp` tooling this same user already relies on elsewhere) so the agent isn't
  re-deriving call-graphs from scratch every time?
- **"Always up to date" mechanism:** on-demand (agent is asked to refresh a diagram), or
  event-driven (some trigger — a git hook, a CI step — calls the agent/MCP automatically after
  changes land)? These imply very different architectures (a stateless tool the agent calls when
  asked, vs. a running service with its own triggers).
- **Tool surface:** what MCP tools does this server actually expose? Candidates to evaluate later:
  `create_diagram`, `update_diagram_node`, `list_diagrams`, `validate_diagram` (likely just
  wrapping sub-project 1's existing `validateDiagramShape`/`checkCrossFileReferences`),
  `diff_diagram_against_code` (the hardest one, if event-driven maintenance is in scope).
- **Conflict handling:** what happens when an agent's proposed diagram update conflicts with a
  human's manual edit to the same file? Silent overwrite is almost certainly wrong for a tool whose
  whole value proposition is human-readable architecture understanding.
- **Scope of "the codebase" an agent generates from:** one repo, or (like this same user's actual
  situation with `risk`/`props`) a family of related repos that only make sense together? If the
  latter, the MCP tool surface needs a way to describe multi-repo relationships, which the current
  diagram schema (one repo's `diagrams/` folder) doesn't obviously support yet.

## Recommended entry point for the future session

Start by resolving the "generation strategy" and "conflict handling" questions together — they're
the two that most determine whether this is a fairly small wrapper around existing codebase-
understanding tools (cheap, fast to build) or a genuinely new kind of system (agent + human both
writing to the same source of truth, needing real reconciliation logic).
