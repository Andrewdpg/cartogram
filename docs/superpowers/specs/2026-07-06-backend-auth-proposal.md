# Sub-project 2: Backend + auth + user-owned diagrams — scope proposal

Date: 2026-07-06
Status: SCOPED ONLY — not designed. Requires its own full brainstorming session
(superpowers:brainstorming) before any implementation plan is written.

## Why this exists

architecture-map v1 stores every diagram as a JSON file under `diagrams/`, discovered via Vite's
`import.meta.glob` at build time — fine for a single local user, but the user wants diagrams
associated with individual accounts (multiple users, each with their own set of diagrams), which a
file-per-repo model can't express.

## Stated intent (from the user, verbatim scope — not yet refined into requirements)

- Add a backend with authentication (user accounts/login).
- Diagrams become associated with users — stored server-side (implicitly a database), not purely
  as files in a git repo.
- Editing via files/code must still be possible — explicitly called out because it's what enables
  AI-assisted authoring (an agent editing a diagram file directly is easy; an agent driving a full
  web UI is not). Whatever storage/API this sub-project builds, a code-first edit path is a hard
  requirement, not an afterthought.

## Dependencies on sub-project 1

None strictly required before starting — sub-project 2 is about *where diagrams live and who owns
them*, not their internal content shape. But it's sequenced after sub-project 1 because the
`Diagram`/`DiagramNodeData`/`DiagramEdgeData` TypeScript types that sub-project 1 finalizes are
exactly what a backend API would need to validate/store/serve — building the backend against a
schema that's about to change (sub-project 1) would mean redoing the API contract shortly after.

## Open questions a future brainstorming session must resolve (not decided here)

- **Storage:** what database? (Given this is a personal tool that may stay single-deployment,
  something like SQLite or Postgres are both plausible — this is a real architectural decision,
  not a detail to wave through.)
- **Auth provider:** roll-your-own (sessions/JWT) vs. an existing auth service (e.g. Clerk, Auth0,
  Supabase Auth)? Given the user is already comfortable with AWS Cognito (used in the `risk`
  project this tool was born out of), that's a plausible option to evaluate too, but not decided.
- **API shape:** REST vs. GraphQL vs. something simpler (a thin CRUD layer)? Does the frontend
  still fetch everything client-side via `import.meta.glob`-equivalent, or does `loadDiagram`
  become a network call?
- **File↔DB sync model:** if diagrams also need to be edited as files (see "stated intent" above),
  how do file edits and DB-stored edits reconcile? Is the file the source of truth with the DB as a
  synced cache, or vice versa, or is there an explicit import/export/sync action a user triggers?
  This is probably the single hardest design question in this sub-project and deserves dedicated
  brainstorming time, not a quick default.
- **Multi-tenancy scope:** is this truly multi-user (strangers, isolated), or "multiple projects
  under one person's account" (the user's own stated original use case — reusing the tool "for
  other cases")? The auth/authorization model differs a lot between those two.
- **Migration of existing file-based diagrams**: what happens to `diagrams/*.json` created in
  sub-project 1 when this backend exists — imported once, kept in parallel, or deprecated?

## Recommended entry point for the future session

Start by resolving the file↔DB sync model question first — it's the one architectural decision
that constrains most of the others (storage choice, API shape, and whether "editing via code" even
still makes sense as literal filesystem files vs. a CLI/API that happens to accept the same JSON
shape).
