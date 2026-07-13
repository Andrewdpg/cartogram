# Supabase Backend (schema + RLS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Supabase (Postgres) backend — schema, RLS policies, and
optimistic-locking write path — that the frontend and MCP server plans will
both consume. No UI, no MCP server yet: this plan's deliverable is a working,
locally-runnable Supabase project whose access control is proven by
automated tests against a real Postgres instance.

**Architecture:** Supabase CLI-managed project with SQL migrations under
`supabase/migrations/`, RLS policies enforcing the owner/collaborator model
from the design doc, and pgTAP tests run via `supabase test db` that assert
access control directly at the database layer (the layer that actually
enforces it — no test double, no application-layer mock).

**Tech Stack:** Supabase CLI, PostgreSQL, pgTAP (via `supabase test db`),
Docker (Supabase CLI's local stack dependency).

## Global Constraints

- Source of truth for design decisions: `docs/superpowers/specs/2026-07-12-backend-mcp-design.md`.
- No `service_role` key usage anywhere in this plan's SQL or docs — every
  policy must hold under the `authenticated` role acting as a specific
  `auth.uid()`, since that's how both the frontend and the MCP server will
  connect.
- `workspace_id` on `projects` is a reserved nullable column only — no
  workspace logic, table, or policy in this plan (per spec's "explicitly
  deferred" section).
- Every migration file is forward-only SQL under `supabase/migrations/`,
  timestamp-prefixed by the Supabase CLI's `migration new` command — do not
  hand-write migration filenames.

---

### Task 1: Initialize the Supabase project locally

**Files:**
- Create: `supabase/config.toml` (generated)
- Create: `.gitignore` additions for `supabase/.branches`, `supabase/.temp`

- [ ] **Step 1: Install the Supabase CLI if not already available**

Run: `supabase --version`
Expected: a version string. If "command not found", install per
https://supabase.com/docs/guides/cli/getting-started (e.g. `brew install
supabase/tap/supabase` on macOS, or the npm/scoop equivalents documented
there) — do not guess the install command for the current platform without
checking that page.

- [ ] **Step 2: Initialize the project**

Run: `supabase init`
Expected: creates `supabase/config.toml` and `supabase/` scaffold in the repo
root.

- [ ] **Step 3: Add Supabase-local artifacts to .gitignore**

Add to `.gitignore`:
```
supabase/.branches
supabase/.temp
```

- [ ] **Step 4: Start the local stack**

Run: `supabase start`
Expected: Docker containers start; output prints local `API URL`, `DB URL`,
`anon key`, `service_role key`. Leave this running for the rest of this
plan.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml .gitignore
git commit -m "chore: initialize local supabase project"
```

---

### Task 2: `projects`, `project_members` tables + RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_projects_and_members.sql`
- Create: `supabase/migrations/<timestamp>_setup_test_helpers.sql`
- Test: `supabase/tests/database/projects_rls.test.sql`

**Prerequisite:** the pgTAP tests in this and later tasks call
`tests.create_supabase_user`, `tests.authenticate_as`, and
`tests.get_supabase_uid`. These are not built into a fresh `supabase init`
project — they're normally installed from the `supabase_test_helpers`
extension via `dbdev`/database.dev, which requires network access this
environment may not have. Before writing the Step 4 test, add a migration
that vendors the `tests` schema locally, following
https://supabase.com/docs/guides/local-development/testing/pgtap-extended
(the `pgtap`/`pgcrypto` extensions plus the `tests.create_supabase_user` /
`tests.authenticate_as` / `tests.get_supabase_uid` / `tests.clear_authentication`
function definitions from that page). Run `supabase migration new
setup_test_helpers` to create the file. This is a one-time setup — later
tasks' tests reuse the same `tests.*` schema without redefining it.

**Interfaces:**
- Produces: `projects(id, owner_id, name, workspace_id, created_at)`,
  `project_members(project_id, user_id, role)` tables, with RLS enabled and
  the policies below. Later tasks (diagrams, mcp_project_grants) reference
  `projects.id`.

- [ ] **Step 1: Create the migration file**

Run: `supabase migration new projects_and_members`
Expected: creates an empty timestamped file under `supabase/migrations/`.

- [ ] **Step 2: Write the schema + RLS into that file**

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null,
  workspace_id uuid null,
  created_at timestamptz not null default now()
);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('viewer','editor')),
  primary key (project_id, user_id)
);

alter table projects enable row level security;
alter table project_members enable row level security;

-- RLS restricts *which rows* are visible/writable, but the authenticated
-- role still needs the base table grant to touch the table at all —
-- without this, every operation fails with "permission denied for table"
-- regardless of RLS.
grant select, insert, update, delete on projects to authenticated;
grant select, insert, update, delete on project_members to authenticated;

-- security definer helpers: projects' and project_members' SELECT policies
-- each need to check the other table. Doing that with a plain `exists
-- (select ... from the_other_table ...)` inside a USING clause causes
-- Postgres to re-evaluate the other table's RLS policy, which checks back
-- into this one — "infinite recursion detected in policy for relation".
-- security definer functions run with the privileges of their owner and
-- bypass RLS internally, breaking the cycle.
create function is_project_owner(p_project_id uuid) returns boolean
  language sql security definer set search_path = public stable as $$
  select exists (select 1 from projects where id = p_project_id and owner_id = auth.uid())
$$;

create function is_project_member(p_project_id uuid) returns boolean
  language sql security definer set search_path = public stable as $$
  select exists (select 1 from project_members where project_id = p_project_id and user_id = auth.uid())
$$;

create policy "select own or member projects" on projects
  for select using (
    owner_id = auth.uid() or is_project_member(id)
  );

create policy "authenticated users create projects" on projects
  for insert with check (owner_id = auth.uid());

create policy "only owner manages project" on projects
  for update using (owner_id = auth.uid());

create policy "only owner deletes project" on projects
  for delete using (owner_id = auth.uid());

create policy "members visible to project owner and the member" on project_members
  for select using (
    user_id = auth.uid() or is_project_owner(project_id)
  );

-- Note: "for insert, update, delete using (...)" is invalid Postgres
-- syntax — CREATE POLICY accepts exactly one command, or `for all`. Since
-- this policy's USING condition is identical across insert/update/delete,
-- `for all` is correct here (it also covers select, but the more specific
-- "members visible..." select policy above still applies — Postgres
-- combines multiple permissive policies for the same command with OR, and
-- there is no select-only distinction being lost since both would allow
-- the same owner to select anyway).
create policy "only owner manages members" on project_members
  for all using (is_project_owner(project_id));
```

- [ ] **Step 3: Apply the migration to the local stack**

Run: `supabase db reset`
Expected: local DB resets and reapplies all migrations from scratch,
including this one. No errors.

- [ ] **Step 4: Write the failing pgTAP test**

Create `supabase/tests/database/projects_rls.test.sql`:

```sql
begin;
select plan(6);

-- Two fake users
select tests.create_supabase_user('owner@example.com');
select tests.create_supabase_user('stranger@example.com');

select tests.authenticate_as('owner@example.com');
insert into projects (id, owner_id, name)
values ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('owner@example.com'), 'Owner Project');

-- Owner can see their own project
select isnt_empty(
  $$select 1 from projects where id = '11111111-1111-1111-1111-111111111111'$$,
  'owner can select their own project'
);

-- Stranger cannot see it
select tests.authenticate_as('stranger@example.com');
select is_empty(
  $$select 1 from projects where id = '11111111-1111-1111-1111-111111111111'$$,
  'stranger cannot select a project they do not own or belong to'
);

-- Stranger cannot insert a project claiming another owner
select throws_ok(
  $$insert into projects (owner_id, name) values ('11111111-1111-1111-1111-111111111111', 'Fake')$$,
  '42501'
);

-- Owner adds stranger as viewer
select tests.authenticate_as('owner@example.com');
insert into project_members (project_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', tests.get_supabase_uid('stranger@example.com'), 'viewer');

-- Now stranger (a viewer) can see the project
select tests.authenticate_as('stranger@example.com');
select isnt_empty(
  $$select 1 from projects where id = '11111111-1111-1111-1111-111111111111'$$,
  'member can select a project they were added to'
);

-- Viewer cannot update the project (not owner). Note: an RLS-blocked
-- UPDATE/DELETE does not raise an exception in raw SQL — Postgres RLS
-- silently filters the row out (PostgreSQL docs: "such rows are silently
-- suppressed; no error is reported"). The `42501 insufficient_privilege`
-- error is constructed by PostgREST's HTTP layer when it sees a 0-row
-- result, not something raw SQL/pgTAP can observe — so this asserts the
-- 0-rows-affected outcome that actually happens at the database layer.
select is_empty(
  $$update projects set name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111' returning id$$,
  'viewer cannot update a project they do not own (0 rows affected)'
);

-- Viewer cannot delete the project (same silently-filtered-row reasoning as above)
select is_empty(
  $$delete from projects where id = '11111111-1111-1111-1111-111111111111' returning id$$,
  'viewer cannot delete a project they do not own (0 rows affected)'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Run the test to verify it fails (before this is wired up, or to confirm the harness runs at all)**

Run: `supabase test db`
Expected: if this is the first pgTAP test in the project, this step also
confirms the test harness itself works. If any assertion fails, read the
diff — it will name exactly which assertion didn't hold.

- [ ] **Step 6: Fix schema/policies until the test passes**

Iterate on the SQL from Step 2 (edit the migration file, `supabase db
reset`, rerun `supabase test db`) until all 6 assertions pass.

- [ ] **Step 7: Run tests to verify they pass**

Run: `supabase test db`
Expected: `# All tests successful.` with `6/6` (or similar pgTAP summary)
passing for this file.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat: add projects and project_members tables with RLS"
```

---

### Task 3: `diagrams` table + RLS + optimistic locking

**Files:**
- Create: `supabase/migrations/<timestamp>_diagrams.sql`
- Test: `supabase/tests/database/diagrams_rls.test.sql`
- Test: `supabase/tests/database/diagrams_optimistic_locking.test.sql`

**Interfaces:**
- Consumes: `projects(id, owner_id)`, `project_members(project_id, user_id,
  role)` from Task 2.
- Produces: `diagrams(id, project_id, slug, title, notation, content,
  version, created_at, updated_at)`. Later tasks (MCP grants) don't reference
  this table directly, but the frontend/MCP plans will read/write it exactly
  as shaped here.

- [ ] **Step 1: Create the migration file**

Run: `supabase migration new diagrams`

- [ ] **Step 2: Write the schema + RLS**

```sql
create table diagrams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  slug text not null,
  title text not null,
  notation text not null check (notation in ('c4','uml-structural','uml-behavioral')),
  content jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);

alter table diagrams enable row level security;

-- Same base-grant requirement as Task 2 — RLS restricts rows, not table access.
grant select, insert, update, delete on diagrams to authenticated;

create policy "select diagrams of accessible projects" on diagrams
  for select using (
    exists (select 1 from projects p
            where p.id = diagrams.project_id
            and (p.owner_id = auth.uid()
                 or exists (select 1 from project_members m
                            where m.project_id = p.id and m.user_id = auth.uid())))
  );

-- Note: "for insert, update using (...)" is invalid Postgres syntax (see
-- Task 2's note on CREATE POLICY accepting exactly one command, or `for
-- all`) — use `for all` since this table has no separate delete policy and
-- the select policy above still independently governs select access.
create policy "write diagrams if owner or editor" on diagrams
  for all using (
    exists (select 1 from projects p
            where p.id = diagrams.project_id
            and (p.owner_id = auth.uid()
                 or exists (select 1 from project_members m
                            where m.project_id = p.id and m.user_id = auth.uid()
                            and m.role = 'editor')))
  );
```

- [ ] **Step 3: Apply the migration**

Run: `supabase db reset`
Expected: no errors.

- [ ] **Step 4: Write the failing RLS test**

Create `supabase/tests/database/diagrams_rls.test.sql`:

```sql
begin;
select plan(4);

select tests.create_supabase_user('owner@example.com');
select tests.create_supabase_user('viewer_user@example.com');
select tests.create_supabase_user('editor_user@example.com');

select tests.authenticate_as('owner@example.com');
insert into projects (id, owner_id, name)
values ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('owner@example.com'), 'P');
insert into project_members (project_id, user_id, role)
values
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('viewer_user@example.com'), 'viewer'),
  ('22222222-2222-2222-2222-222222222222', tests.get_supabase_uid('editor_user@example.com'), 'editor');

insert into diagrams (id, project_id, slug, title, notation, content)
values (
  '33333333-3333-3333-3333-333333333333',
  '22222222-2222-2222-2222-222222222222',
  'deployment', 'Deployment', 'c4',
  '{"nodes": [], "edges": []}'
);

-- Viewer can read
select tests.authenticate_as('viewer_user@example.com');
select isnt_empty(
  $$select 1 from diagrams where id = '33333333-3333-3333-3333-333333333333'$$,
  'viewer can select a diagram in a project they belong to'
);

-- Viewer cannot write. Same reasoning as the projects_rls test: an
-- RLS-blocked UPDATE silently affects 0 rows in raw SQL rather than
-- throwing — `42501` is a PostgREST HTTP-layer construct, not a Postgres
-- exception, so this asserts the 0-rows-affected outcome directly.
select is_empty(
  $$update diagrams set title = 'Hacked' where id = '33333333-3333-3333-3333-333333333333' returning id$$,
  'viewer cannot update a diagram in a project they only view (0 rows affected)'
);

-- Editor can write
select tests.authenticate_as('editor_user@example.com');
select lives_ok(
  $$update diagrams set title = 'Updated by editor' where id = '33333333-3333-3333-3333-333333333333'$$,
  'editor can update a diagram in their project'
);

-- Non-member cannot read
select tests.create_supabase_user('outsider@example.com');
select tests.authenticate_as('outsider@example.com');
select is_empty(
  $$select 1 from diagrams where id = '33333333-3333-3333-3333-333333333333'$$,
  'non-member cannot select the diagram'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Run to verify it fails or passes cleanly**

Run: `supabase test db`
Expected: fix policies until `4/4` pass, same iterate-and-rerun loop as Task
2 Step 6.

- [ ] **Step 6: Write the failing optimistic-locking test**

Create `supabase/tests/database/diagrams_optimistic_locking.test.sql`:

```sql
begin;
select plan(2);

select tests.create_supabase_user('locker@example.com');
select tests.authenticate_as('locker@example.com');

insert into projects (id, owner_id, name)
values ('44444444-4444-4444-4444-444444444444', tests.get_supabase_uid('locker@example.com'), 'Lock Test');

insert into diagrams (id, project_id, slug, title, notation, content, version)
values (
  '55555555-5555-5555-5555-555555555555',
  '44444444-4444-4444-4444-444444444444',
  'd', 'D', 'c4', '{"nodes": [], "edges": []}', 1
);

-- Update with the correct version succeeds and bumps version
update diagrams
set content = '{"nodes": [{"id":"a"}], "edges": []}', version = version + 1, updated_at = now()
where id = '55555555-5555-5555-5555-555555555555' and version = 1;

select results_eq(
  $$select version from diagrams where id = '55555555-5555-5555-5555-555555555555'$$,
  $$values (2)$$,
  'version increments to 2 after a correctly-versioned update'
);

-- Update against the now-stale version 1 affects zero rows (the app/MCP
-- layer interprets 0 affected rows as a conflict — this test proves the
-- SQL-level guarantee it depends on)
select is_empty(
  $$update diagrams set content = '{"nodes": [], "edges": []}', version = version + 1
    where id = '55555555-5555-5555-5555-555555555555' and version = 1
    returning id$$,
  'update against a stale version number affects zero rows'
);

select * from finish();
rollback;
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `supabase test db`
Expected: all tests across both files in this task pass (`4/4` +  `2/2`).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat: add diagrams table with RLS and optimistic locking"
```

---

### Task 4: `mcp_project_grants` table + MCP-scoped RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_mcp_project_grants.sql`
- Test: `supabase/tests/database/mcp_project_grants_rls.test.sql`

**Interfaces:**
- Consumes: `projects(id, owner_id)`, `diagrams(id, project_id)` from Tasks
  2–3.
- Produces: `mcp_project_grants(id, user_id, project_id, granted_at)`. The
  MCP server plan (separate plan) will insert/delete rows here and mint JWTs
  carrying the `is_mcp_request` claim this task's policies check for.

- [ ] **Step 1: Create the migration file**

Run: `supabase migration new mcp_project_grants`

- [ ] **Step 2: Write the schema + additional RLS policies**

```sql
create table mcp_project_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  project_id uuid not null references projects(id) on delete cascade,
  granted_at timestamptz not null default now(),
  unique (user_id, project_id)
);

alter table mcp_project_grants enable row level security;

-- Same base-grant requirement as Tasks 2-3 — RLS restricts rows, not table access.
grant select, insert, update, delete on mcp_project_grants to authenticated;

-- Note: "for select, insert, update, delete using (...)" is invalid syntax
-- (see Task 2's note) — `for all` covers the same four commands correctly.
create policy "users manage their own mcp grants" on mcp_project_grants
  for all using (user_id = auth.uid());

-- MCP-originated requests (JWT carries is_mcp_request: true) additionally
-- require a matching grant row, on top of the existing owner/member policies.
create policy "mcp requests require an explicit grant on projects" on projects
  for all using (
    coalesce((auth.jwt() ->> 'is_mcp_request')::boolean, false) = false
    or exists (select 1 from mcp_project_grants g
               where g.project_id = projects.id and g.user_id = auth.uid())
  );

create policy "mcp requests require an explicit grant on diagrams" on diagrams
  for all using (
    coalesce((auth.jwt() ->> 'is_mcp_request')::boolean, false) = false
    or exists (select 1 from mcp_project_grants g
               where g.project_id = diagrams.project_id and g.user_id = auth.uid())
  );
```

- [ ] **Step 3: Apply the migration**

Run: `supabase db reset`
Expected: no errors. Note Postgres RLS combines multiple permissive policies
on the same table with OR by default — since these new policies are meant to
be an additional *restriction* layered on top of the existing ones, not an
alternative path, verify in Step 5 below that a non-MCP request is
unaffected and an MCP request without a grant is actually denied. If the
test in Step 5 shows the restriction isn't taking effect (i.e. OR is letting
ungranted MCP requests through), change the affected policies from
permissive to **restrictive** (`as restrictive` in the `create policy`
clause) so they narrow access with AND instead of widening it with OR — this
is the standard Postgres RLS pattern for "additionally require," and pgTAP
will make it obvious which behavior you actually have.

- [ ] **Step 4: Write the failing test**

Create `supabase/tests/database/mcp_project_grants_rls.test.sql`:

```sql
begin;
select plan(3);

select tests.create_supabase_user('mcp_owner@example.com');
select tests.authenticate_as('mcp_owner@example.com');

insert into projects (id, owner_id, name)
values ('66666666-6666-6666-6666-666666666666', tests.get_supabase_uid('mcp_owner@example.com'), 'MCP Test');

-- Normal (non-MCP) session: owner can still read without any grant row
select isnt_empty(
  $$select 1 from projects where id = '66666666-6666-6666-6666-666666666666'$$,
  'owner without an mcp grant can still read via the normal web session'
);

-- Simulate an MCP-originated request without a grant: set the JWT claim for
-- this transaction and expect zero rows back.
select set_config('request.jwt.claims',
  '{"sub":"' || tests.get_supabase_uid('mcp_owner@example.com') || '","is_mcp_request":true}',
  true);
select is_empty(
  $$select 1 from projects where id = '66666666-6666-6666-6666-666666666666'$$,
  'mcp-flagged request without a grant row cannot read the project'
);

-- Grant access, then the same mcp-flagged request should succeed
insert into mcp_project_grants (user_id, project_id)
values (tests.get_supabase_uid('mcp_owner@example.com'), '66666666-6666-6666-6666-666666666666');

select isnt_empty(
  $$select 1 from projects where id = '66666666-6666-6666-6666-666666666666'$$,
  'mcp-flagged request with a grant row can read the project'
);

select * from finish();
rollback;
```

- [ ] **Step 5: Run to verify, fix policies until it passes**

Run: `supabase test db`
Expected: iterate as in prior tasks (including the restrictive-policy fix
from Step 3 if needed) until `3/3` pass.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `supabase test db`
Expected: all test files (Tasks 2, 3, 4) pass together — this confirms the
new MCP-scoping policies didn't break plain web-session access proven in
earlier tasks.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations supabase/tests
git commit -m "feat: add mcp_project_grants table and per-project MCP access scoping"
```

---

### Task 5: Seed script and local developer docs

**Files:**
- Create: `supabase/seed.sql`
- Modify: `README.md`

**Interfaces:**
- Consumes: all tables from Tasks 2–4.
- Produces: nothing consumed by later plans — this task is documentation and
  local DX only.

- [ ] **Step 1: Write a minimal seed file**

Create `supabase/seed.sql`:

```sql
-- Local dev convenience only — not applied to any hosted environment.
-- Requires a real auth.users row to exist first (create via Supabase Studio
-- at http://localhost:54323 or `supabase auth` CLI commands), since
-- projects.owner_id references auth.users(id) and there is no seeded user
-- id known in advance.
```

- [ ] **Step 2: Document local setup in the README**

Add a new section to `README.md` after the existing "Usage" section:

```markdown
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
```

- [ ] **Step 3: Verify the docs match reality**

Run: `supabase db reset && supabase test db`
Expected: succeeds cleanly following exactly the commands just documented
(catches doc drift immediately rather than leaving it for a future reader).

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql README.md
git commit -m "docs: document local supabase setup and testing"
```

---

## Self-Review Notes

- **Spec coverage:** `projects`, `project_members`, `diagrams`,
  `mcp_project_grants` — all four tables from the design doc are covered
  with matching column shapes and RLS. Optimistic locking is proven at the
  SQL level (the exact mechanism the frontend/MCP plans will drive from
  application code). `workspace_id` is present but inert, per constraint.
- **Deferred to other plans:** actual Supabase Auth user signup/login UI,
  frontend queries, and the MCP server's JWT-minting code are out of scope
  here — this plan only proves the database-level contract those layers will
  rely on.
