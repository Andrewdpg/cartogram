# Backend (Supabase) + MCP server — design

Date: 2026-07-12
Status: DESIGNED — approved by user, ready for implementation planning.

Supersedes the open questions in `2026-07-06-backend-auth-proposal.md` and
`2026-07-06-mcp-agent-proposal.md` (both scoped-only proposals from a prior
session). This document resolves every open question those two raised.

## Why this exists

architecture-map v1 stores every diagram as a JSON file under `diagrams/`,
discovered via Vite's `import.meta.glob` at build time. The user wants to turn
this from a personal, file-based prototype into a real multi-user product:
diagrams owned by accounts, shareable with collaborators, and generated/kept
up to date by an AI agent (Claude Code or similar) connected over MCP.

## Decisions made this session (with rationale)

- **Diagram format stays JSON, not TOON.** TOON's token savings come from
  uniform flat arrays (tabular data); this schema's `nodes`/`edges` are
  heterogeneous (optional fields vary by `kind`/`notation`). JSON also has
  first-class structured-output support in LLM tool calling; TOON does not.
  Not revisited unless diagram payload size becomes an actual measured
  problem.
- **Multi-tenancy: real multi-user product**, not a personal tool with
  multiple projects. Sharing model: owner + collaborators per project today,
  with the data model already shaped to grow into workspaces later without a
  breaking migration (see `workspace_id` below).
- **Backend: Supabase** (Postgres + Auth + RLS), not a hand-rolled server.
  RLS policies are a natural fit for the owner/collaborator model, Postgres
  underneath avoids data lock-in, and Supabase removes the need to build an
  OAuth authorization server from scratch. The MCP server itself is custom
  code in both cases — Supabase does not provide MCP support directly.
- **Frontend: stays Vite + React**, not a migration to Next.js. The core
  product (interactive React Flow canvas, drill-down) is fully client-side;
  Next's main advantage (SSR/SEO) doesn't apply because everything lives
  behind login with no public indexable content. Migrating frameworks here
  would be pure cost with no capability gained.
- **Source of truth: DB only, no local file mode.** Originally an open
  question in the prior proposal (file↔DB sync). Resolved: local
  `diagrams/*.json` as an editable source is dropped entirely — diagrams live
  exclusively in Supabase, edited via the web app or the MCP server. This
  eliminates the sync/reconciliation problem the prior proposal flagged as
  the hardest open question. The current repo's `diagrams/` example files
  become non-functional once this ships; the project itself will still be
  published open source (for auditability/self-hosting of the code), but the
  product is a hosted service, not something an end user needs to clone or
  install.
- **Conflict handling: optimistic locking**, not last-write-wins. Every
  diagram row carries a `version` counter; writes are conditioned on the
  version read, and a mismatch is rejected with an explicit conflict rather
  than silently overwritten. Matters specifically because an AI agent and a
  human can write to the same diagram concurrently — silent overwrite would
  be actively dangerous here, unlike a typical single-user CRUD app.
- **MCP transport: remote (Streamable HTTP), not local/stdio.** No filesystem
  access is needed (unlike `filesystem`/`git`-style local MCP servers) —
  source code is read by the Claude Code client itself, never sent to the
  MCP server; only the already-synthesized diagram JSON crosses the wire.
  Remote removes install friction and matches how most SaaS MCP integrations
  (Linear, Notion, Sentry) already work.
- **MCP auth: OAuth 2.1 + PKCE**, delegating to Supabase Auth as the identity
  provider. Matches the MCP spec's standard remote-auth mechanism natively
  supported by Claude Code.
- **Grouping: diagrams belong to a project.** A project is the unit of
  ownership and sharing (matches the real use case: "document this repo" or
  "share this repo's architecture with a teammate"), not per-diagram sharing.
- **Collaborator role: single role per project** (`viewer` or `editor`),
  applied uniformly to every diagram in that project. Per-diagram role
  overrides within a project were explicitly rejected as unneeded complexity.
- **MCP scopes: read / write / admin, separate.** `read` = view; `write` =
  create/update projects and diagrams; `admin` = manage collaborators and
  project lifecycle. An agent authorized for `write` cannot invite/remove
  collaborators or delete a project — that requires `admin` explicitly.
- **MCP can create new projects**, not just write into pre-existing ones —
  required for the "walk into a repo, ask the AI to document it" flow to work
  end to end without a prior trip to the web app.
- **MCP access scope is per-project, not just per-scope-tier.** A user who
  grants `write` does not thereby expose every project they own/edit to the
  MCP — they explicitly select which projects the MCP may touch. This is
  separate from and orthogonal to the read/write/admin scope tier. Editable
  after the fact from the web app (Settings), not fixed at OAuth consent
  time — matches how GitHub Apps / Google OAuth app permissions work.
- **Projects created by the MCP auto-grant MCP access to themselves.**
  Otherwise `create_project` via MCP would produce a project the same MCP
  connection couldn't subsequently read or write to, breaking the primary
  end-to-end flow. The grant-row insert is part of the same transaction as
  project creation.

## Data model (Postgres / Supabase)

```sql
projects
  id              uuid pk default gen_random_uuid()
  owner_id        uuid not null references auth.users(id)
  name            text not null
  workspace_id    uuid null   -- reserved, unused today; lets workspaces be
                              -- added later as a pure additive migration
  created_at      timestamptz not null default now()

project_members
  project_id      uuid not null references projects(id) on delete cascade
  user_id         uuid not null references auth.users(id)
  role            text not null check (role in ('viewer','editor'))
  primary key (project_id, user_id)

diagrams
  id              uuid pk default gen_random_uuid()
  project_id      uuid not null references projects(id) on delete cascade
  slug            text not null       -- replaces today's file-derived id (e.g. "deployment")
  title           text not null
  notation        text not null check (notation in ('c4','uml-structural','uml-behavioral'))
  content         jsonb not null      -- { nodes: DiagramNodeData[], edges: DiagramEdgeData[] }
  version         integer not null default 1   -- optimistic locking
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()
  unique (project_id, slug)

mcp_project_grants
  id              uuid pk default gen_random_uuid()
  user_id         uuid not null references auth.users(id)
  project_id      uuid not null references projects(id) on delete cascade
  granted_at      timestamptz not null default now()
  unique (user_id, project_id)
```

Notes:
- `content` stays a single `jsonb` document (not normalized `nodes`/`edges`
  tables). The app always reads/writes a diagram as one whole document
  (including the raw-JSON edit tab), node/edge shape is heterogeneous by
  `kind`/`notation`, and there's no query pattern that needs cross-diagram
  node search. GIN indexing is available later if that ever changes.
- `childDiagram` inside a node's `content` stays a plain `slug` string (same
  role today's filename reference plays) — resolved to another `diagrams.id`
  via `project_id + slug` at click time. No separate diagram-graph table
  needed.
- `sourceRefs` remains an unvalidated free-text string array, unchanged from
  today's behavior — still just a citation, not a live link.

## Row-Level Security

Ownership/membership check (used throughout): a user can act on a `project`
if `owner_id = auth.uid()` OR they have a `project_members` row for it.
`diagrams` inherit permissions from their `project_id` — no independent
policy.

```sql
-- projects: readable by owner or any member
create policy "select own or member projects" on projects
  for select using (
    owner_id = auth.uid()
    or exists (select 1 from project_members m
               where m.project_id = projects.id and m.user_id = auth.uid())
  );

-- projects: only the owner manages lifecycle (maps to "admin" MCP scope)
create policy "only owner manages project" on projects
  for update using (owner_id = auth.uid());
create policy "only owner deletes project" on projects
  for delete using (owner_id = auth.uid());

-- diagrams: readable if the user can access the parent project at all
create policy "select diagrams of accessible projects" on diagrams
  for select using (
    exists (select 1 from projects p
            where p.id = diagrams.project_id
            and (p.owner_id = auth.uid()
                 or exists (select 1 from project_members m
                            where m.project_id = p.id and m.user_id = auth.uid())))
  );

-- diagrams: writable if owner or member with role='editor'
create policy "write diagrams if owner or editor" on diagrams
  for insert, update using (
    exists (select 1 from projects p
            where p.id = diagrams.project_id
            and (p.owner_id = auth.uid()
                 or exists (select 1 from project_members m
                            where m.project_id = p.id and m.user_id = auth.uid()
                            and m.role = 'editor')))
  );
```

**MCP per-project scoping**: MCP-originated requests carry an additional JWT
claim (e.g. `is_mcp_request: true`) set by the MCP server when it mints a
Supabase-scoped token for a tool call. An additional RLS policy applies only
when that claim is present, requiring a matching `mcp_project_grants` row:

```sql
create policy "mcp requests require an explicit grant" on diagrams
  for all using (
    not (auth.jwt() ->> 'is_mcp_request')::boolean
    or exists (select 1 from mcp_project_grants g
               where g.project_id = diagrams.project_id
               and g.user_id = auth.uid())
  );
-- same shape applied to projects
```

This keeps normal web-app access (no `is_mcp_request` claim) completely
unaffected — only MCP tool calls are additionally filtered by
`mcp_project_grants`.

**Scope → RLS mapping**:
- `read` → `select` policies only.
- `write` → adds `insert`/`update` on `diagrams`, `insert` on `projects`
  (project creation).
- `admin` → adds `update`/`delete` on `projects`, write access to
  `project_members`.

**Optimistic locking** (separate from RLS): every diagram update is
`update diagrams set content = $1, version = version + 1, updated_at = now()
where id = $2 and version = $3`. Zero rows affected → the client/MCP server
surfaces an explicit conflict (HTTP 409 equivalent), never a silent
overwrite. Applies uniformly whether the conflicting writer is a human (web
"Edit JSON" tab) or the MCP.

## Frontend (Vite + React, additive changes only)

- Add `@supabase/supabase-js`; replace the current
  `import.meta.glob('/diagrams/*.json')` loading with queries against
  `projects`/`diagrams`.
- New routes (react-router is already a dependency):
  - `/login`
  - `/projects` — dashboard: owned + shared-with-me projects
  - `/projects/:projectId/:diagramSlug` — replaces today's diagram route
  - `/settings/integrations` — MCP per-project access toggles (CRUD over
    `mcp_project_grants`)
- Simple auth route guard: no Supabase session → redirect to `/login`.
  Standard SPA pattern, same as Linear/Notion/Figma's own client apps.
- "Edit JSON" tab now actually persists: save performs the versioned update
  above; a 409 surfaces the conflict to the user instead of silently
  overwriting (exact UX for conflict resolution — e.g. "reload and reapply"
  vs. a diff view — is left to the implementation plan, not decided here).
- New "share" screen: invite by email to a project with `viewer`/`editor`
  role — plain CRUD over `project_members`.

Unchanged: `nodeShapes.tsx`, `dagre` layout, `childDiagram` drill-down logic,
the Legend tab — all operate on the same `Diagram` shape, now arriving over
the network instead of a static import.

## MCP server (remote, OAuth 2.1)

- Transport: Streamable HTTP, deployed as its own service (separate process/
  deploy from the frontend; same repo).
- Auth: OAuth 2.1 + PKCE, delegating identity to Supabase Auth — same login
  as the web app. The consent screen lets the user pick both the scope tier
  (read/write/admin) and which specific projects the connection may touch
  (backed by `mcp_project_grants`, editable later from
  `/settings/integrations` without re-authorizing).
- Every tool call runs as the authenticated user (their `auth.uid()`), never
  via a `service_role` key that would bypass RLS — authorization is enforced
  by Postgres, not re-implemented in application code.

**Tool surface (first cut):**

| Tool | Scope | Behavior |
|---|---|---|
| `list_projects` | read | Lists accessible projects (owned + shared) within the MCP's granted set |
| `get_diagram` | read | Fetch by `project_id` + `slug`, includes current `version` |
| `create_project` | write | Creates a project (caller becomes owner); auto-inserts a `mcp_project_grants` row in the same transaction |
| `create_diagram` | write | Creates a diagram within a project |
| `update_diagram` | write | Updates `content`; requires the `version` read previously — mismatch returns an explicit conflict, agent decides whether to re-read and retry or surface to the user |
| `validate_diagram` | none (no DB write) | Wraps the existing `validateDiagramShape`/cross-file-reference checks against a `content` payload before writing |
| `invite_collaborator` | admin | Inserts a `project_members` row |

Explicitly out of scope for this design (YAGNI — add later if needed, not
speculatively now): `delete_project`, `remove_collaborator`. Destructive,
low-value for the "document a repo" flow this is built around.

**End-to-end flow**: Claude Code reads the local repo with its own
filesystem tools (not via this MCP) → synthesizes diagram JSON → calls
`create_project` if needed → `create_diagram`/`update_diagram` with the
content. Source code never crosses the wire to the MCP server — only the
already-synthesized diagram.

## Explicitly deferred / out of scope

- Workspaces (the `workspace_id` column exists but nothing reads/writes it
  yet — deferred until there's a real need, per YAGNI).
- `delete_project` / `remove_collaborator` MCP tools.
- Any public/unauthenticated diagram sharing (everything lives behind
  login — confirmed, no SSR/SEO need).
- Local file-based diagram editing/sync (dropped entirely — DB is the sole
  source of truth).
- Conflict-resolution UX details in the web app (409 handling exists at the
  API contract level; the actual resolution flow — reload-and-reapply vs.
  diff view — is an implementation-plan decision, not a design one).
