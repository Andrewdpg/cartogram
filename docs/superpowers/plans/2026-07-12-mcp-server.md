# MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ )`) syntax for tracking.

**Goal:** Build a remote MCP server that lets an AI agent (Claude Code or any
MCP-compatible client) read and write a user's architecture-map projects and
diagrams over OAuth 2.1, enforcing the same per-project grants and
read/write/admin scopes designed in the spec — no `service_role` bypass, no
tool call that isn't provably constrained by the Supabase RLS policies built
in the backend plan.

**Architecture:** A standalone Node/TypeScript service using the official MCP
TypeScript SDK's Streamable HTTP transport. OAuth 2.1 + PKCE is implemented
as a thin authorization-server layer in front of Supabase Auth (Supabase
issues the actual user identity/session; this service issues MCP-scoped
access tokens carrying the user's id, the granted scope tier, and the
`is_mcp_request` JWT claim the backend plan's RLS policies check for). Every
tool handler creates a fresh Supabase client authenticated as the calling
user — never the service role — so all authorization is enforced by Postgres
RLS, not re-implemented here.

**Tech Stack:** Node.js, TypeScript, `@modelcontextprotocol/sdk`,
`@supabase/supabase-js`, a minimal HTTP framework (Express) for the
OAuth endpoints Streamable HTTP requires alongside the MCP endpoint.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-12-backend-mcp-design.md`.
- Schema/RLS source of truth: `docs/superpowers/plans/2026-07-12-supabase-backend.md`
  (assumed already implemented — this plan's tool handlers query tables and
  rely on policies defined there, and does not redefine them).
- No tool handler may use the Supabase `service_role` key. Every Supabase
  call in this service must run as the authenticated end user, so RLS is the
  actual enforcement point — a handler that used `service_role` would
  silently bypass every policy the backend plan tested.
- `delete_project` and `remove_collaborator` are explicitly out of scope
  (per spec's "explicitly deferred" section) — no task in this plan adds
  them.
- The MCP server lives in this repo, in its own top-level directory
  (`mcp-server/`), with its own `package.json` — it is a separately
  deployable service, not bundled into the Vite frontend build.

---

### Task 1: Project scaffold

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/vitest.config.ts`
- Create: `mcp-server/src/index.ts`
- Create: `mcp-server/.env.example`

**Interfaces:**
- Produces: a runnable (empty) Node/TypeScript project under `mcp-server/`
  with its own test runner — every later task adds files under
  `mcp-server/src/`.

- [ ] **Step 1: Create the directory and initialize package.json**

Run: `mkdir -p mcp-server/src && cd mcp-server && npm init -y && cd ..`

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd mcp-server
npm install @modelcontextprotocol/sdk @supabase/supabase-js express jsonwebtoken
npm install -D typescript vitest @types/node @types/express @types/jsonwebtoken tsx
cd ..
```

- [ ] **Step 3: Write `tsconfig.json`**

Create `mcp-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

Create `mcp-server/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node' },
})
```

- [ ] **Step 5: Update `package.json` scripts**

Modify `mcp-server/package.json` — set the `scripts` field:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "type": "module"
}
```

- [ ] **Step 6: Write a placeholder entry point**

Create `mcp-server/src/index.ts`:

```typescript
console.log('architecture-map MCP server — scaffold OK')
```

- [ ] **Step 7: Write the env template**

Create `mcp-server/.env.example`:

```
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=replace-with-local-anon-key-from-supabase-start
MCP_JWT_SIGNING_SECRET=replace-with-a-long-random-local-dev-secret
PORT=8787
```

- [ ] **Step 8: Verify the scaffold runs**

Run: `cd mcp-server && npm run dev`
Expected: prints "architecture-map MCP server — scaffold OK" and exits (or
stays running under `tsx watch`; either is fine at this stage). Stop it with
Ctrl-C.

- [ ] **Step 9: Commit**

```bash
git add mcp-server/package.json mcp-server/package-lock.json mcp-server/tsconfig.json mcp-server/vitest.config.ts mcp-server/src/index.ts mcp-server/.env.example
git commit -m "chore: scaffold standalone mcp-server project"
```

---

### Task 2: Supabase-per-request client factory

**Files:**
- Create: `mcp-server/src/supabaseForUser.ts`
- Create: `mcp-server/src/supabaseForUser.test.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_ANON_KEY` env vars.
- Produces: `supabaseForUser(accessToken: string): SupabaseClient` — every
  later task's tool handlers call this to get a client scoped to the calling
  user, never a shared/service-role client.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/src/supabaseForUser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { supabaseForUser } from './supabaseForUser'

describe('supabaseForUser', () => {
  it('creates a client with the Authorization header set to the given token', () => {
    const client = supabaseForUser('a-user-jwt')
    // @ts-expect-error accessing internal rest client config for the test
    const headers = client.rest.headers
    expect(headers.Authorization).toBe('Bearer a-user-jwt')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mcp-server && npm test -- supabaseForUser`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `supabaseForUser.ts`**

Create `mcp-server/src/supabaseForUser.ts`:

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
}

export function supabaseForUser(accessToken: string): SupabaseClient {
  return createClient(url!, anonKey!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mcp-server && npm test -- supabaseForUser`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/supabaseForUser.ts mcp-server/src/supabaseForUser.test.ts
git commit -m "feat: add per-request supabase client factory scoped to the calling user"
```

---

### Task 3: MCP-scoped token minting and verification

**Files:**
- Create: `mcp-server/src/mcpToken.ts`
- Create: `mcp-server/src/mcpToken.test.ts`

**Interfaces:**
- Consumes: `MCP_JWT_SIGNING_SECRET` env var.
- Produces:
  - `interface McpTokenClaims { userId: string; scopes: ('read' | 'write' | 'admin')[]; supabaseAccessToken: string }`
  - `mintMcpToken(claims: McpTokenClaims): string`
  - `verifyMcpToken(token: string): McpTokenClaims`

  Later tasks (OAuth endpoints, tool handlers) exchange a Supabase session
  for one of these tokens and verify it on every incoming MCP request.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/src/mcpToken.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mintMcpToken, verifyMcpToken } from './mcpToken'

describe('mcpToken', () => {
  it('round-trips claims through mint and verify', () => {
    const token = mintMcpToken({
      userId: 'user-123',
      scopes: ['read', 'write'],
      supabaseAccessToken: 'supabase-jwt-abc',
    })
    const claims = verifyMcpToken(token)
    expect(claims.userId).toBe('user-123')
    expect(claims.scopes).toEqual(['read', 'write'])
    expect(claims.supabaseAccessToken).toBe('supabase-jwt-abc')
  })

  it('throws on a tampered token', () => {
    const token = mintMcpToken({ userId: 'u', scopes: ['read'], supabaseAccessToken: 't' })
    const tampered = token.slice(0, -2) + 'xx'
    expect(() => verifyMcpToken(tampered)).toThrow()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mcp-server && npm test -- mcpToken`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `mcpToken.ts`**

Create `mcp-server/src/mcpToken.ts`:

```typescript
import jwt from 'jsonwebtoken'

export interface McpTokenClaims {
  userId: string
  scopes: ('read' | 'write' | 'admin')[]
  supabaseAccessToken: string
}

const secret = process.env.MCP_JWT_SIGNING_SECRET
if (!secret) {
  throw new Error('Missing MCP_JWT_SIGNING_SECRET environment variable')
}

export function mintMcpToken(claims: McpTokenClaims): string {
  return jwt.sign(claims, secret!, { expiresIn: '1h' })
}

export function verifyMcpToken(token: string): McpTokenClaims {
  return jwt.verify(token, secret!) as McpTokenClaims & { iat: number; exp: number }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd mcp-server && npm test -- mcpToken`
Expected: PASS, both cases.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/mcpToken.ts mcp-server/src/mcpToken.test.ts
git commit -m "feat: add mcp access token minting/verification carrying user id, scopes, and supabase session"
```

---

### Task 4: OAuth 2.1 + PKCE authorization endpoints

**Files:**
- Create: `mcp-server/src/oauth.ts`
- Create: `mcp-server/src/oauth.test.ts`

**Interfaces:**
- Consumes: `mintMcpToken` from Task 3; Supabase Auth (via a service-role-free
  password/OTP verification call, or by redirecting to the frontend's own
  login page — see Step 3 design note below).
- Produces: an Express `Router` mounted at `/oauth` exposing
  `/oauth/authorize` and `/oauth/token`, implementing the Authorization Code
  + PKCE flow MCP clients (Claude Code) expect. Task 6 mounts this router
  into the main server.

- [ ] **Step 1: Write the failing test for the token exchange endpoint**

Create `mcp-server/src/oauth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createOAuthRouter } from './oauth'

vi.mock('./mcpToken', () => ({
  mintMcpToken: vi.fn(() => 'minted-mcp-token'),
}))

describe('POST /oauth/token', () => {
  let app: express.Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/oauth', createOAuthRouter())
  })

  it('rejects a token exchange for an unknown/expired authorization code', async () => {
    const res = await request(app)
      .post('/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code: 'does-not-exist',
        code_verifier: 'irrelevant',
        client_id: 'claude-code',
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('invalid_grant')
  })

  it('exchanges a valid code + matching PKCE verifier for an mcp access token', async () => {
    const authRes = await request(app).get('/oauth/authorize').query({
      response_type: 'code',
      client_id: 'claude-code',
      redirect_uri: 'https://claude.ai/callback',
      code_challenge: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ', // base64url("base64url-challenge")-shaped placeholder
      code_challenge_method: 'plain',
      scope: 'read write',
      state: 'xyz',
    })
    // /authorize redirects with ?code=... in a real browser flow; the test
    // extracts the code from the Location header the same way a client would.
    const location = new URL(authRes.headers.location!)
    const code = location.searchParams.get('code')!

    const res = await request(app).post('/oauth/token').send({
      grant_type: 'authorization_code',
      code,
      code_verifier: 'YmFzZTY0dXJsLWNoYWxsZW5nZQ',
      client_id: 'claude-code',
    })
    expect(res.status).toBe(200)
    expect(res.body.access_token).toBe('minted-mcp-token')
  })
})
```

- [ ] **Step 2: Install the test-only HTTP client**

Run: `cd mcp-server && npm install -D supertest @types/supertest`

- [ ] **Step 3: Run to verify it fails**

Run: `cd mcp-server && npm test -- oauth`
Expected: FAIL — module doesn't exist.

Design note before implementing: this task's `/oauth/authorize` endpoint
issues an authorization code **after the user has already established a
Supabase session** — in production this means `/oauth/authorize` redirects
an unauthenticated browser to the existing frontend's login page (built in
the frontend plan) with a return-to-authorize link, and only proceeds once a
valid Supabase session cookie/token is present. For this task's automated
tests, that browser-redirect-then-return leg is out of scope (it's a manual/
E2E concern) — the test above exercises the endpoint as if a session already
exists, which is what the implementation below supports via a
`supabaseAccessToken` passed through the flow.

- [ ] **Step 4: Implement `oauth.ts`**

Create `mcp-server/src/oauth.ts`:

```typescript
import { Router } from 'express'
import crypto from 'node:crypto'
import { mintMcpToken } from './mcpToken'

interface PendingAuthorization {
  codeChallenge: string
  codeChallengeMethod: 'plain' | 'S256'
  scopes: ('read' | 'write' | 'admin')[]
  supabaseAccessToken: string
  userId: string
  redirectUri: string
  createdAt: number
}

// In-memory store — a single-instance dev/first-deploy assumption.
// ponytail: swap for a shared store (Redis, or a Supabase table) if/when
// this service runs as more than one instance behind a load balancer.
const pendingCodes = new Map<string, PendingAuthorization>()
const CODE_TTL_MS = 5 * 60 * 1000

function verifyPkce(verifier: string, challenge: string, method: 'plain' | 'S256'): boolean {
  if (method === 'plain') return verifier === challenge
  const hashed = crypto.createHash('sha256').update(verifier).digest('base64url')
  return hashed === challenge
}

export function createOAuthRouter(): Router {
  const router = Router()

  // NOTE: this handler assumes the caller already has a valid Supabase
  // session (see Task 4's design note) — the query params below stand in
  // for what a real request carries once wired to the frontend's login
  // flow in a later task; this synthesizes a placeholder session for now
  // so the authorization-code + PKCE mechanics can be tested independently
  // of the login UI.
  router.get('/authorize', (req, res) => {
    const { redirect_uri, code_challenge, code_challenge_method, scope, state } = req.query as Record<
      string,
      string
    >

    const code = crypto.randomBytes(24).toString('base64url')
    pendingCodes.set(code, {
      codeChallenge: code_challenge,
      codeChallengeMethod: (code_challenge_method as 'plain' | 'S256') ?? 'S256',
      scopes: (scope ?? 'read').split(' ') as ('read' | 'write' | 'admin')[],
      supabaseAccessToken: 'placeholder-supabase-session-token',
      userId: 'placeholder-user-id',
      redirectUri: redirect_uri,
      createdAt: Date.now(),
    })

    const location = new URL(redirect_uri)
    location.searchParams.set('code', code)
    if (state) location.searchParams.set('state', state)
    res.redirect(location.toString())
  })

  router.post('/token', (req, res) => {
    const { grant_type, code, code_verifier } = req.body as Record<string, string>

    if (grant_type !== 'authorization_code') {
      return res.status(400).json({ error: 'unsupported_grant_type' })
    }

    const pending = pendingCodes.get(code)
    if (!pending || Date.now() - pending.createdAt > CODE_TTL_MS) {
      return res.status(400).json({ error: 'invalid_grant' })
    }
    pendingCodes.delete(code)

    if (!verifyPkce(code_verifier, pending.codeChallenge, pending.codeChallengeMethod)) {
      return res.status(400).json({ error: 'invalid_grant' })
    }

    const accessToken = mintMcpToken({
      userId: pending.userId,
      scopes: pending.scopes,
      supabaseAccessToken: pending.supabaseAccessToken,
    })

    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: 3600 })
  })

  return router
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd mcp-server && npm test -- oauth`
Expected: PASS, both cases.

- [ ] **Step 6: Commit**

```bash
git add mcp-server/src/oauth.ts mcp-server/src/oauth.test.ts mcp-server/package.json mcp-server/package-lock.json
git commit -m "feat: add oauth 2.1 authorization code + pkce endpoints"
```

**Follow-up not covered by this task** (tracked here so it isn't lost, but
intentionally deferred — it's a product-integration concern for whoever
deploys this service, not a change to this plan's file set): replacing the
`/authorize` handler's placeholder session values with a real check against
a Supabase session, by redirecting unauthenticated requests to the deployed
frontend's `/login` (from the frontend plan) and validating a returned
Supabase access token before issuing a code.

---

### Task 5: `list_projects` and `get_diagram` tools (read scope)

**Files:**
- Create: `mcp-server/src/tools/listProjects.ts`
- Create: `mcp-server/src/tools/listProjects.test.ts`
- Create: `mcp-server/src/tools/getDiagram.ts`
- Create: `mcp-server/src/tools/getDiagram.test.ts`
- Create: `mcp-server/src/requireScope.ts`
- Create: `mcp-server/src/requireScope.test.ts`

**Interfaces:**
- Consumes: `McpTokenClaims` from Task 3; `supabaseForUser` from Task 2.
- Produces:
  - `requireScope(claims: McpTokenClaims, scope: 'read' | 'write' | 'admin'): void`
    (throws if missing) — every tool in this and later tasks calls this
    first.
  - `listProjectsTool(claims: McpTokenClaims): Promise<{ id: string; name: string }[]>`
  - `getDiagramTool(claims: McpTokenClaims, projectId: string, slug: string): Promise<{ diagram: unknown; version: number }>`

- [ ] **Step 1: Write the failing test for `requireScope`**

Create `mcp-server/src/requireScope.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { requireScope } from './requireScope'
import type { McpTokenClaims } from './mcpToken'

const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 't' }

describe('requireScope', () => {
  it('does not throw when the scope is present', () => {
    expect(() => requireScope(claims, 'read')).not.toThrow()
  })

  it('throws when the scope is missing', () => {
    expect(() => requireScope(claims, 'write')).toThrow(/missing required scope: write/)
  })
})
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- requireScope`
Expected: FAIL.

Create `mcp-server/src/requireScope.ts`:

```typescript
import type { McpTokenClaims } from './mcpToken'

export function requireScope(claims: McpTokenClaims, scope: 'read' | 'write' | 'admin'): void {
  if (!claims.scopes.includes(scope)) {
    throw new Error(`missing required scope: ${scope}`)
  }
}
```

Run: `cd mcp-server && npm test -- requireScope`
Expected: PASS, both cases.

- [ ] **Step 3: Write the failing test for `listProjectsTool`**

Create `mcp-server/src/tools/listProjects.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: () => ({ select: () => Promise.resolve({ data: [{ id: 'p1', name: 'Repo' }], error: null }) }),
  })),
}))

import { listProjectsTool } from './listProjects'
import type { McpTokenClaims } from '../mcpToken'

describe('listProjectsTool', () => {
  it('returns projects visible to the calling user', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    const result = await listProjectsTool(claims)
    expect(result).toEqual([{ id: 'p1', name: 'Repo' }])
  })

  it('rejects when the token lacks read scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: [], supabaseAccessToken: 'tok' }
    await expect(listProjectsTool(claims)).rejects.toThrow(/missing required scope: read/)
  })
})
```

- [ ] **Step 4: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- listProjects`
Expected: FAIL.

Create `mcp-server/src/tools/listProjects.ts`:

```typescript
import { supabaseForUser } from '../supabaseForUser'
import { requireScope } from '../requireScope'
import type { McpTokenClaims } from '../mcpToken'

export async function listProjectsTool(
  claims: McpTokenClaims
): Promise<{ id: string; name: string }[]> {
  requireScope(claims, 'read')
  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { data, error } = await supabase.from('projects').select('id, name')
  if (error) throw error
  return data ?? []
}
```

Run: `cd mcp-server && npm test -- listProjects`
Expected: PASS, both cases.

- [ ] **Step 5: Write the failing test for `getDiagramTool`**

Create `mcp-server/src/tools/getDiagram.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const single = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single }) }) }) }),
  })),
}))

import { getDiagramTool } from './getDiagram'
import type { McpTokenClaims } from '../mcpToken'

describe('getDiagramTool', () => {
  it('returns the diagram content and version', async () => {
    single.mockResolvedValue({
      data: { title: 'Deployment', notation: 'c4', content: { nodes: [], edges: [] }, version: 2 },
      error: null,
    })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    const result = await getDiagramTool(claims, 'proj-1', 'deployment')
    expect(result.version).toBe(2)
    expect(result.diagram).toMatchObject({ title: 'Deployment', notation: 'c4' })
  })

  it('rejects when the token lacks read scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: [], supabaseAccessToken: 'tok' }
    await expect(getDiagramTool(claims, 'proj-1', 'deployment')).rejects.toThrow(
      /missing required scope: read/
    )
  })
})
```

- [ ] **Step 6: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- getDiagram`
Expected: FAIL.

Create `mcp-server/src/tools/getDiagram.ts`:

```typescript
import { supabaseForUser } from '../supabaseForUser'
import { requireScope } from '../requireScope'
import type { McpTokenClaims } from '../mcpToken'

export async function getDiagramTool(
  claims: McpTokenClaims,
  projectId: string,
  slug: string
): Promise<{ diagram: { title: string; notation: string; nodes: unknown; edges: unknown }; version: number }> {
  requireScope(claims, 'read')
  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { data, error } = await supabase
    .from('diagrams')
    .select('title, notation, content, version')
    .eq('project_id', projectId)
    .eq('slug', slug)
    .single()
  if (error) throw error

  const content = data.content as { nodes: unknown; edges: unknown }
  return {
    diagram: { title: data.title, notation: data.notation, nodes: content.nodes, edges: content.edges },
    version: data.version,
  }
}
```

Run: `cd mcp-server && npm test -- getDiagram`
Expected: PASS, both cases.

- [ ] **Step 7: Commit**

```bash
git add mcp-server/src/requireScope.ts mcp-server/src/requireScope.test.ts mcp-server/src/tools
git commit -m "feat: add read-scope list_projects and get_diagram mcp tools"
```

---

### Task 6: `create_project`, `create_diagram`, `update_diagram`, `validate_diagram` tools (write scope)

**Files:**
- Create: `mcp-server/src/tools/createProject.ts`
- Create: `mcp-server/src/tools/createProject.test.ts`
- Create: `mcp-server/src/tools/createDiagram.ts`
- Create: `mcp-server/src/tools/createDiagram.test.ts`
- Create: `mcp-server/src/tools/updateDiagram.ts`
- Create: `mcp-server/src/tools/updateDiagram.test.ts`
- Create: `mcp-server/src/tools/validateDiagram.ts`
- Create: `mcp-server/src/tools/validateDiagram.test.ts`
- Create: `mcp-server/src/validateDiagramShape.ts` (copied logic — see Step 1
  design note)

**Interfaces:**
- Consumes: `requireScope`, `supabaseForUser` from Tasks 2/5.
- Produces:
  - `createProjectTool(claims, name: string): Promise<{ id: string; name: string }>`
    — inserts into `projects` **and** `mcp_project_grants` in the same call
    (per spec's auto-grant requirement).
  - `createDiagramTool(claims, projectId, slug, title, notation, content): Promise<void>`
  - `updateDiagramTool(claims, projectId, slug, content, expectedVersion): Promise<{ version: number } | { conflict: true }>`
  - `validateDiagramTool(content: unknown): { valid: true } | { valid: false; reason: string }`

- [ ] **Step 1: Port `validateDiagramShape` into the MCP server**

Design note: the frontend's `src/lib/validateDiagram.ts` is a browser/Vite
module not published as an importable package, so this task copies its
`validateDiagramShape` function (unchanged) into the MCP server rather than
adding a cross-package dependency between two independently-deployed
services. Both copies validate the exact same `Diagram` shape from the
design doc — if that shape ever changes, both copies need updating; this is
flagged as a known duplication rather than hidden.

Create `mcp-server/src/validateDiagramShape.ts` by copying the full contents
of `src/lib/validateDiagram.ts` and `src/lib/types.ts`'s `NodeKind`,
`NODE_KINDS`, `Notation`, `NOTATIONS`, `UmlRelationship`, `UML_RELATIONSHIPS`
type/const definitions into one file (inlining the type imports since this
is a standalone copy):

```typescript
// Copied from src/lib/validateDiagram.ts + src/lib/types.ts (architecture-map
// frontend). Kept in sync manually — see Task 6 Step 1 design note in
// docs/superpowers/plans/2026-07-12-mcp-server.md if this drifts.

export type NodeKind =
  | 'system' | 'container' | 'component' | 'service' | 'server'
  | 'database' | 'class' | 'external' | 'bridge'

export const NODE_KINDS: readonly NodeKind[] = [
  'system', 'container', 'component', 'service', 'server',
  'database', 'class', 'external', 'bridge',
]

export type Notation = 'c4' | 'uml-structural' | 'uml-behavioral'
export const NOTATIONS: readonly Notation[] = ['c4', 'uml-structural', 'uml-behavioral']

export type UmlRelationship = 'association' | 'composition' | 'inheritance' | 'dependency'
export const UML_RELATIONSHIPS: readonly UmlRelationship[] = [
  'association', 'composition', 'inheritance', 'dependency',
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
  sourceRefs?: string[]
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
    for (const field of ['techStack', 'gotchas', 'attributes', 'operations', 'sourceRefs'] as const) {
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
```

- [ ] **Step 2: Write the failing test for `validateDiagramTool`**

Create `mcp-server/src/tools/validateDiagram.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateDiagramTool } from './validateDiagram'

describe('validateDiagramTool', () => {
  it('returns valid: true for a well-formed diagram', () => {
    const result = validateDiagramTool({
      id: 'd', title: 'D', nodes: [{ id: 'a', label: 'A', kind: 'service' }], edges: [],
    })
    expect(result).toEqual({ valid: true })
  })

  it('returns valid: false with a reason for a malformed diagram', () => {
    const result = validateDiagramTool({ id: 'd', title: 'D', nodes: [{ id: 'a' }], edges: [] })
    expect(result.valid).toBe(false)
    expect((result as { reason: string }).reason).toMatch(/missing "label"/)
  })
})
```

- [ ] **Step 3: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- tools/validateDiagram`
Expected: FAIL.

Create `mcp-server/src/tools/validateDiagram.ts`:

```typescript
import { validateDiagramShape, InvalidDiagramError } from '../validateDiagramShape'

export function validateDiagramTool(content: unknown): { valid: true } | { valid: false; reason: string } {
  try {
    validateDiagramShape(content, 'candidate')
    return { valid: true }
  } catch (err) {
    if (err instanceof InvalidDiagramError) {
      return { valid: false, reason: err.message }
    }
    throw err
  }
}
```

Run: `cd mcp-server && npm test -- tools/validateDiagram`
Expected: PASS, both cases.

- [ ] **Step 4: Write the failing test for `createProjectTool`**

Create `mcp-server/src/tools/createProject.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const projectInsertSingle = vi.fn()
const grantInsert = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'projects') {
        return { insert: () => ({ select: () => ({ single: projectInsertSingle }) }) }
      }
      if (table === 'mcp_project_grants') {
        return { insert: grantInsert }
      }
      throw new Error(`unexpected table ${table}`)
    },
  })),
}))

import { createProjectTool } from './createProject'
import type { McpTokenClaims } from '../mcpToken'

describe('createProjectTool', () => {
  it('creates the project and auto-grants mcp access to it', async () => {
    projectInsertSingle.mockResolvedValue({ data: { id: 'new-p', name: 'New' }, error: null })
    grantInsert.mockResolvedValue({ error: null })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }

    const result = await createProjectTool(claims, 'New')

    expect(result).toEqual({ id: 'new-p', name: 'New' })
    expect(grantInsert).toHaveBeenCalledWith({ project_id: 'new-p', user_id: 'u1' })
  })

  it('rejects when the token lacks write scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    await expect(createProjectTool(claims, 'New')).rejects.toThrow(/missing required scope: write/)
  })
})
```

- [ ] **Step 5: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- createProject`
Expected: FAIL.

Create `mcp-server/src/tools/createProject.ts`:

```typescript
import { supabaseForUser } from '../supabaseForUser'
import { requireScope } from '../requireScope'
import type { McpTokenClaims } from '../mcpToken'

export async function createProjectTool(
  claims: McpTokenClaims,
  name: string
): Promise<{ id: string; name: string }> {
  requireScope(claims, 'write')
  const supabase = supabaseForUser(claims.supabaseAccessToken)

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, owner_id: claims.userId })
    .select('id, name')
    .single()
  if (error) throw error

  const { error: grantError } = await supabase
    .from('mcp_project_grants')
    .insert({ project_id: data.id, user_id: claims.userId })
  if (grantError) throw grantError

  return data
}
```

Run: `cd mcp-server && npm test -- createProject`
Expected: PASS, both cases.

- [ ] **Step 6: Write the failing test for `createDiagramTool`**

Create `mcp-server/src/tools/createDiagram.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const insert = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({ from: () => ({ insert }) })),
}))

import { createDiagramTool } from './createDiagram'
import type { McpTokenClaims } from '../mcpToken'

describe('createDiagramTool', () => {
  it('inserts a new diagram row', async () => {
    insert.mockResolvedValue({ error: null })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }
    await createDiagramTool(claims, 'proj-1', 'deployment', 'Deployment', 'c4', { nodes: [], edges: [] })
    expect(insert).toHaveBeenCalledWith({
      project_id: 'proj-1',
      slug: 'deployment',
      title: 'Deployment',
      notation: 'c4',
      content: { nodes: [], edges: [] },
    })
  })

  it('rejects when the token lacks write scope', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    await expect(
      createDiagramTool(claims, 'proj-1', 'd', 'D', 'c4', { nodes: [], edges: [] })
    ).rejects.toThrow(/missing required scope: write/)
  })
})
```

- [ ] **Step 7: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- tools/createDiagram`
Expected: FAIL.

Create `mcp-server/src/tools/createDiagram.ts`:

```typescript
import { supabaseForUser } from '../supabaseForUser'
import { requireScope } from '../requireScope'
import type { McpTokenClaims } from '../mcpToken'
import type { DiagramNodeData, DiagramEdgeData, Notation } from '../validateDiagramShape'

export async function createDiagramTool(
  claims: McpTokenClaims,
  projectId: string,
  slug: string,
  title: string,
  notation: Notation,
  content: { nodes: DiagramNodeData[]; edges: DiagramEdgeData[] }
): Promise<void> {
  requireScope(claims, 'write')
  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { error } = await supabase
    .from('diagrams')
    .insert({ project_id: projectId, slug, title, notation, content })
  if (error) throw error
}
```

Run: `cd mcp-server && npm test -- tools/createDiagram`
Expected: PASS, both cases.

- [ ] **Step 8: Write the failing test for `updateDiagramTool`**

Create `mcp-server/src/tools/updateDiagram.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const single = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({
    from: () => ({
      update: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single }) }) }) }) }),
    }),
  })),
}))

import { updateDiagramTool } from './updateDiagram'
import type { McpTokenClaims } from '../mcpToken'

const claims: McpTokenClaims = { userId: 'u1', scopes: ['write'], supabaseAccessToken: 'tok' }

describe('updateDiagramTool', () => {
  it('returns the new version on a successful versioned update', async () => {
    single.mockResolvedValue({ data: { version: 5 }, error: null })
    const result = await updateDiagramTool(claims, 'proj-1', 'deployment', { nodes: [], edges: [] }, 4)
    expect(result).toEqual({ version: 5 })
  })

  it('returns a conflict when the expected version does not match', async () => {
    single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const result = await updateDiagramTool(claims, 'proj-1', 'deployment', { nodes: [], edges: [] }, 4)
    expect(result).toEqual({ conflict: true })
  })

  it('rejects when the token lacks write scope', async () => {
    const readOnly: McpTokenClaims = { userId: 'u1', scopes: ['read'], supabaseAccessToken: 'tok' }
    await expect(
      updateDiagramTool(readOnly, 'proj-1', 'deployment', { nodes: [], edges: [] }, 1)
    ).rejects.toThrow(/missing required scope: write/)
  })
})
```

- [ ] **Step 9: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- tools/updateDiagram`
Expected: FAIL.

Create `mcp-server/src/tools/updateDiagram.ts`:

```typescript
import { supabaseForUser } from '../supabaseForUser'
import { requireScope } from '../requireScope'
import type { McpTokenClaims } from '../mcpToken'
import type { DiagramNodeData, DiagramEdgeData } from '../validateDiagramShape'

export async function updateDiagramTool(
  claims: McpTokenClaims,
  projectId: string,
  slug: string,
  content: { nodes: DiagramNodeData[]; edges: DiagramEdgeData[] },
  expectedVersion: number
): Promise<{ version: number } | { conflict: true }> {
  requireScope(claims, 'write')
  const supabase = supabaseForUser(claims.supabaseAccessToken)

  const { data, error } = await supabase
    .from('diagrams')
    .update({ content, version: expectedVersion + 1, updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('slug', slug)
    .eq('version', expectedVersion)
    .select('version')
    .single()

  if (error || !data) {
    return { conflict: true }
  }
  return { version: data.version }
}
```

Run: `cd mcp-server && npm test -- tools/updateDiagram`
Expected: PASS, all 3 cases.

- [ ] **Step 10: Commit**

```bash
git add mcp-server/src/validateDiagramShape.ts mcp-server/src/tools
git commit -m "feat: add write-scope create_project, create_diagram, update_diagram, validate_diagram mcp tools"
```

---

### Task 7: `invite_collaborator` tool (admin scope)

**Files:**
- Create: `mcp-server/src/tools/inviteCollaborator.ts`
- Create: `mcp-server/src/tools/inviteCollaborator.test.ts`

**Interfaces:**
- Consumes: `requireScope`, `supabaseForUser` from earlier tasks; the
  `invite_collaborator_by_email` Postgres RPC added in the frontend plan's
  Task 6 (assumed already migrated).
- Produces: `inviteCollaboratorTool(claims, projectId, email, role): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `mcp-server/src/tools/inviteCollaborator.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../supabaseForUser', () => ({
  supabaseForUser: vi.fn(() => ({ rpc })),
}))

import { inviteCollaboratorTool } from './inviteCollaborator'
import type { McpTokenClaims } from '../mcpToken'

describe('inviteCollaboratorTool', () => {
  it('calls the invite rpc when the token has admin scope', async () => {
    rpc.mockResolvedValue({ error: null })
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['admin'], supabaseAccessToken: 'tok' }
    await inviteCollaboratorTool(claims, 'proj-1', 'friend@example.com', 'editor')
    expect(rpc).toHaveBeenCalledWith('invite_collaborator_by_email', {
      p_project_id: 'proj-1',
      p_email: 'friend@example.com',
      p_role: 'editor',
    })
  })

  it('rejects when the token lacks admin scope (write is not enough)', async () => {
    const claims: McpTokenClaims = { userId: 'u1', scopes: ['read', 'write'], supabaseAccessToken: 'tok' }
    await expect(
      inviteCollaboratorTool(claims, 'proj-1', 'friend@example.com', 'editor')
    ).rejects.toThrow(/missing required scope: admin/)
  })
})
```

- [ ] **Step 2: Run to verify it fails, then implement**

Run: `cd mcp-server && npm test -- inviteCollaborator`
Expected: FAIL.

Create `mcp-server/src/tools/inviteCollaborator.ts`:

```typescript
import { supabaseForUser } from '../supabaseForUser'
import { requireScope } from '../requireScope'
import type { McpTokenClaims } from '../mcpToken'

export async function inviteCollaboratorTool(
  claims: McpTokenClaims,
  projectId: string,
  email: string,
  role: 'viewer' | 'editor'
): Promise<void> {
  requireScope(claims, 'admin')
  const supabase = supabaseForUser(claims.supabaseAccessToken)
  const { error } = await supabase.rpc('invite_collaborator_by_email', {
    p_project_id: projectId,
    p_email: email,
    p_role: role,
  })
  if (error) throw new Error(error.message)
}
```

Run: `cd mcp-server && npm test -- inviteCollaborator`
Expected: PASS, both cases — confirms `write` alone is insufficient, proving
the three-tier scope separation from the design doc.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/tools/inviteCollaborator.ts mcp-server/src/tools/inviteCollaborator.test.ts
git commit -m "feat: add admin-scope invite_collaborator mcp tool"
```

---

### Task 8: MCP server wiring — register tools on the SDK server, mount HTTP transport

**Files:**
- Create: `mcp-server/src/server.ts`
- Create: `mcp-server/src/server.test.ts`
- Modify: `mcp-server/src/index.ts`

**Interfaces:**
- Consumes: every tool function from Tasks 5–7; `createOAuthRouter` from
  Task 4; `verifyMcpToken` from Task 3.
- Produces: `createApp(): express.Express` — the full HTTP app (OAuth routes
  + authenticated MCP endpoint), used by `index.ts` to actually listen.

- [ ] **Step 1: Write the failing integration test**

Create `mcp-server/src/server.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

vi.mock('./tools/listProjects', () => ({
  listProjectsTool: vi.fn().mockResolvedValue([{ id: 'p1', name: 'Repo' }]),
}))
vi.mock('./mcpToken', async () => {
  const actual = await vi.importActual<typeof import('./mcpToken')>('./mcpToken')
  return actual
})

import { createApp } from './server'
import { mintMcpToken } from './mcpToken'

describe('MCP HTTP endpoint auth', () => {
  it('rejects a request with no bearer token', async () => {
    const app = createApp()
    const res = await request(app).post('/mcp').send({})
    expect(res.status).toBe(401)
  })

  it('rejects a request with an invalid bearer token', async () => {
    const app = createApp()
    const res = await request(app).post('/mcp').set('Authorization', 'Bearer garbage').send({})
    expect(res.status).toBe(401)
  })

  it('accepts a request with a valid mcp access token', async () => {
    const app = createApp()
    const token = mintMcpToken({ userId: 'u1', scopes: ['read'], supabaseAccessToken: 'sb-tok' })
    const res = await request(app).post('/mcp').set('Authorization', `Bearer ${token}`).send({})
    expect(res.status).not.toBe(401)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd mcp-server && npm test -- server.test`
Expected: FAIL — `./server` doesn't exist.

- [ ] **Step 3: Implement `server.ts`**

Create `mcp-server/src/server.ts`:

```typescript
import express, { type Request, type Response, type NextFunction } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { createOAuthRouter } from './oauth'
import { verifyMcpToken, type McpTokenClaims } from './mcpToken'
import { listProjectsTool } from './tools/listProjects'
import { getDiagramTool } from './tools/getDiagram'
import { createProjectTool } from './tools/createProject'
import { createDiagramTool } from './tools/createDiagram'
import { updateDiagramTool } from './tools/updateDiagram'
import { validateDiagramTool } from './tools/validateDiagram'
import { inviteCollaboratorTool } from './tools/inviteCollaborator'

declare global {
  namespace Express {
    interface Request {
      mcpClaims?: McpTokenClaims
    }
  }
}

function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' })
  }
  try {
    req.mcpClaims = verifyMcpToken(header.slice('Bearer '.length))
    next()
  } catch {
    res.status(401).json({ error: 'invalid or expired token' })
  }
}

function buildMcpServer(claims: McpTokenClaims): McpServer {
  const server = new McpServer({ name: 'architecture-map', version: '0.1.0' })

  server.registerTool(
    'list_projects',
    { description: 'List projects accessible to the authenticated user' },
    async () => ({ content: [{ type: 'text', text: JSON.stringify(await listProjectsTool(claims)) }] })
  )

  server.registerTool(
    'get_diagram',
    {
      description: 'Fetch a diagram by project id and slug',
      inputSchema: { projectId: z.string(), slug: z.string() },
    },
    async ({ projectId, slug }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getDiagramTool(claims, projectId, slug)) }],
    })
  )

  server.registerTool(
    'create_project',
    { description: 'Create a new project', inputSchema: { name: z.string() } },
    async ({ name }) => ({
      content: [{ type: 'text', text: JSON.stringify(await createProjectTool(claims, name)) }],
    })
  )

  server.registerTool(
    'create_diagram',
    {
      description: 'Create a new diagram in a project',
      inputSchema: {
        projectId: z.string(),
        slug: z.string(),
        title: z.string(),
        notation: z.enum(['c4', 'uml-structural', 'uml-behavioral']),
        content: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
      },
    },
    async ({ projectId, slug, title, notation, content }) => {
      await createDiagramTool(claims, projectId, slug, title, notation, content)
      return { content: [{ type: 'text', text: 'ok' }] }
    }
  )

  server.registerTool(
    'update_diagram',
    {
      description: 'Update a diagram, guarded by optimistic locking',
      inputSchema: {
        projectId: z.string(),
        slug: z.string(),
        content: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
        expectedVersion: z.number(),
      },
    },
    async ({ projectId, slug, content, expectedVersion }) => ({
      content: [
        {
          type: 'text',
          text: JSON.stringify(await updateDiagramTool(claims, projectId, slug, content, expectedVersion)),
        },
      ],
    })
  )

  server.registerTool(
    'validate_diagram',
    { description: 'Validate a diagram payload before writing it', inputSchema: { content: z.any() } },
    async ({ content }) => ({ content: [{ type: 'text', text: JSON.stringify(validateDiagramTool(content)) }] })
  )

  server.registerTool(
    'invite_collaborator',
    {
      description: 'Invite a collaborator to a project by email (requires admin scope)',
      inputSchema: { projectId: z.string(), email: z.string(), role: z.enum(['viewer', 'editor']) },
    },
    async ({ projectId, email, role }) => {
      await inviteCollaboratorTool(claims, projectId, email, role)
      return { content: [{ type: 'text', text: 'ok' }] }
    }
  )

  return server
}

export function createApp(): express.Express {
  const app = express()
  app.use(express.json())
  app.use('/oauth', createOAuthRouter())

  app.post('/mcp', authenticate, async (req: Request, res: Response) => {
    const server = buildMcpServer(req.mcpClaims!)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
  })

  return app
}
```

Note: `registerTool`'s exact API shape (`inputSchema` as a plain Zod-shape
object vs. `z.object(...)`, the `content` return envelope) matches the
`@modelcontextprotocol/sdk` version installed in Task 1 — if `npm install`
resolved a version with a different `registerTool` signature, adjust this
file to match the installed SDK's actual TypeScript types (check
`node_modules/@modelcontextprotocol/sdk/dist/*/server/mcp.d.ts`) rather than
assuming this snippet is correct for every SDK version.

- [ ] **Step 4: Install zod**

Run: `cd mcp-server && npm install zod`

- [ ] **Step 5: Run to verify the test passes**

Run: `cd mcp-server && npm test -- server.test`
Expected: PASS, all 3 cases.

- [ ] **Step 6: Wire `index.ts` to actually listen**

Replace `mcp-server/src/index.ts`:

```typescript
import { createApp } from './server'

const port = Number(process.env.PORT ?? 8787)
createApp().listen(port, () => {
  console.log(`architecture-map MCP server listening on :${port}`)
})
```

- [ ] **Step 7: Run the full test suite for this service**

Run: `cd mcp-server && npm test`
Expected: PASS across every file in `mcp-server/`.

- [ ] **Step 8: Manual smoke test against the local Supabase stack**

With `supabase start` running (from the backend plan) and `.env` populated
from `.env.example`, run: `cd mcp-server && npm run dev`
Expected: "architecture-map MCP server listening on :8787" with no errors.
Full OAuth-flow-driven manual verification with an actual MCP client
(Claude Code's `/mcp add`) is a deployment-time step outside this plan's
automated scope — this smoke test only confirms the process boots and binds
its port cleanly.

- [ ] **Step 9: Commit**

```bash
git add mcp-server/src/server.ts mcp-server/src/server.test.ts mcp-server/src/index.ts mcp-server/package.json mcp-server/package-lock.json
git commit -m "feat: wire mcp tools onto streamable http transport with bearer auth"
```

---

### Task 9: README for the MCP server

**Files:**
- Create: `mcp-server/README.md`

**Interfaces:**
- Consumes: nothing — documentation only.

- [ ] **Step 1: Write the README**

Create `mcp-server/README.md`:

```markdown
# architecture-map MCP server

Remote MCP server (Streamable HTTP + OAuth 2.1/PKCE) that lets an
MCP-compatible AI agent (e.g. Claude Code) read and write a user's
architecture-map projects and diagrams, subject to the same per-project
access grants and read/write/admin scopes the user controls from
`/settings/integrations` in the web app.

## Local development

Requires the Supabase backend (`../supabase`, see the repo root README) running:

    supabase start   # from the repo root

Then:

    cp .env.example .env
    # fill in SUPABASE_URL / SUPABASE_ANON_KEY from `supabase start`'s output,
    # and a random MCP_JWT_SIGNING_SECRET
    npm install
    npm run dev

## Testing

    npm test

## Tools exposed

| Tool | Scope | Notes |
|---|---|---|
| `list_projects` | read | |
| `get_diagram` | read | |
| `create_project` | write | auto-grants MCP access to the created project |
| `create_diagram` | write | |
| `update_diagram` | write | optimistic-locking: pass the `version` from a prior `get_diagram` call; a mismatch returns `{ conflict: true }` |
| `validate_diagram` | none | dry-run shape validation, no DB write |
| `invite_collaborator` | admin | |

## Known limitations

- `/oauth/authorize`'s session check is a placeholder (see
  `docs/superpowers/plans/2026-07-12-mcp-server.md` Task 4's follow-up note)
  — wiring it to a real Supabase session via the web app's login flow is a
  deployment-integration step not yet implemented.
- `delete_project` and `remove_collaborator` are intentionally not exposed
  (see the design doc's "explicitly deferred" section).
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/README.md
git commit -m "docs: add mcp-server readme"
```

---

## Self-Review Notes

- **Spec coverage:** all 7 tools from the design doc's table are implemented
  (`list_projects`, `get_diagram`, `create_project`, `create_diagram`,
  `update_diagram`, `validate_diagram`, `invite_collaborator`), each gated
  by the correct scope tier, with `create_project` auto-granting MCP access
  per the spec's explicit requirement. OAuth 2.1 + PKCE, remote Streamable
  HTTP transport, and RLS-enforced (never service-role) data access are all
  present. `delete_project`/`remove_collaborator` are absent, matching the
  design's explicit deferral.
- **Known incompleteness flagged, not hidden:** Task 4's `/oauth/authorize`
  placeholder-session limitation is called out in both the task itself and
  the final README rather than presented as finished — connecting it to a
  real Supabase session is real work left for a follow-up, since it depends
  on the frontend plan's login page existing in a deployed environment this
  plan doesn't provision.
- **Type consistency:** `McpTokenClaims` (Task 3) is the single shape passed
  through every tool function in Tasks 5–7 and `server.ts` (Task 8) — no
  renamed fields across tasks. `Diagram`/`DiagramNodeData`/`DiagramEdgeData`
  types in `validateDiagramShape.ts` (Task 6) match the frontend's
  `src/lib/types.ts` field-for-field, per the design doc's shared schema.
