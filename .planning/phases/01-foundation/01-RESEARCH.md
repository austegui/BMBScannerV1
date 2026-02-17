# Phase 1: Foundation - Research

**Researched:** 2026-02-17
**Domain:** Supabase Edge Functions (Hono/Deno), Supabase Vault, QBO OAuth 2.0, PostgreSQL migrations
**Confidence:** HIGH

---

## Summary

Phase 1 establishes three independent tracks: (1) database schema migrations to extend the `expenses` table and create the `qbo_connection` table, (2) an Edge Function scaffold using Hono routing with CORS and auth middleware, and (3) the QBO OAuth 2.0 flow with Vault-encrypted token storage and a frontend "Connect to QuickBooks" button.

The existing codebase has no Supabase authentication and no admin role concept yet — the app is currently unprotected. The `expenses` table is production-populated (real receipts), so migrations must use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` with safe defaults. The `supabase/` directory does not exist yet, meaning `supabase init` and CLI linking must be the first task in the plan.

The standard pattern for this phase is: native Deno `fetch` for QBO OAuth token exchange (no npm libraries), Supabase Vault for encrypted token storage via `vault.create_secret()` SQL functions, and Hono imported from `jsr:@hono/hono` with `basePath('/qbo-api')` to match the Edge Function name.

**Primary recommendation:** Initialize the Supabase CLI project first, run `supabase link` to connect to the existing project, then execute the three sub-plans in dependency order: schema (01-01), Edge Function scaffold (01-02), OAuth flow (01-03).

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Hono | `jsr:@hono/hono` (latest) | HTTP routing inside Edge Function | Supabase official recommendation for routing in Edge Functions; JSR registry, no npm needed |
| Deno native `fetch` | Built-in | QBO OAuth token exchange HTTP calls | Web standard, no dependencies, works natively in Deno |
| Supabase Vault | Built-in extension | Encrypted storage of OAuth access + refresh tokens | Purpose-built for secrets; AES-256 AEAD, service_role only, key rotation support |
| Supabase CLI | Latest | `supabase init`, `supabase functions new`, `supabase functions deploy`, `supabase migration` | Required to create and deploy Edge Functions |
| `@supabase/supabase-js` | `^2.93.3` (already installed) | Frontend calls to Edge Function via `supabase.functions.invoke()` | Already in project |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `jose` | `npm:jose@^5` | JWT verification for Supabase auth middleware | Verifying user Supabase JWT inside Edge Function |
| Supabase Secrets | CLI / Dashboard | Store `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI` | Environment variables for Edge Function, never in code |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jsr:@hono/hono` | `https://deno.land/x/hono` | The `deno.land/x` path is the OLD Hono import. Supabase docs now show JSR. Use `jsr:@hono/hono`. |
| Supabase Vault | pgcrypto encrypted columns | Vault has dedicated key management and `decrypted_secrets` view; pgcrypto requires managing your own key in env vars |
| Supabase Vault | Application-level AES-GCM | Vault is simpler and purpose-built; app-level encryption requires storing the key somewhere |
| Native `fetch` | `intuit-oauth` npm package | `intuit-oauth` has 7 Node.js dependencies (axios, csrf, jsonwebtoken) that create Deno compatibility issues |

**Installation (Deno — no npm install needed for Edge Function):**
```bash
# Edge Functions use Deno imports — no package.json required
# Hono: jsr:@hono/hono
# jose: npm:jose@^5
# Supabase client (inside function): npm:@supabase/supabase-js@2

# CLI setup (run once):
npm install -g supabase          # Install Supabase CLI
supabase init                    # Creates supabase/ directory
supabase login                   # Authenticate
supabase link --project-ref YOUR_PROJECT_REF   # Link to existing project
supabase functions new qbo-api   # Create Edge Function scaffold
```

---

## Architecture Patterns

### Recommended Project Structure

```
supabase/
├── config.toml                  # Supabase project config (created by supabase init)
├── functions/
│   └── qbo-api/
│       └── index.ts             # Single fat function with Hono routing
├── migrations/
│   ├── 20260217000001_expenses_qbo_columns.sql
│   └── 20260217000002_qbo_connection.sql
└── .env.local                   # Local secrets (gitignored, never commit)
```

### Pattern 1: Hono Fat Function with basePath

**What:** Single Edge Function with internal Hono routing. All QBO operations handled by one function.

**When to use:** Always. Supabase documentation explicitly recommends "fat functions" over multiple small functions to reduce cold starts.

**Critical detail:** Hono requires `.basePath('/qbo-api')` where `qbo-api` matches the Edge Function directory name. Without this, routes 404 because Supabase prefixes all invocations with `/functions/v1/qbo-api/`.

**Example:**
```typescript
// supabase/functions/qbo-api/index.ts
// Source: https://supabase.com/docs/guides/functions/routing
import { Hono } from 'jsr:@hono/hono'
import { cors } from 'jsr:@hono/hono/middleware'

const app = new Hono().basePath('/qbo-api')

// CORS middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://YOUR_PROD_DOMAIN'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Auth middleware — verify Supabase JWT
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  // JWT verification via jose (see Code Examples section)
  await next()
})

// Routes
app.get('/auth/start', handleAuthStart)
app.get('/auth/callback', handleAuthCallback)
app.get('/connection/status', handleConnectionStatus)

Deno.serve(app.fetch)
```

### Pattern 2: Supabase Vault for Token Storage

**What:** Store OAuth access token and refresh token as two separate Vault secrets. Store their UUIDs in the `qbo_connection` table.

**When to use:** Storing QBO OAuth tokens. Never store tokens as plain text columns.

**How it works:** `vault.create_secret(value)` returns a UUID. Store that UUID in `qbo_connection.token_vault_id`. Retrieve via `vault.decrypted_secrets` view.

**Example:**
```sql
-- Source: https://supabase.com/docs/guides/database/vault

-- Enable Vault (if not already enabled on your project)
-- Vault is pre-enabled on Supabase hosted projects; run only if missing:
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- Store a token, get back its UUID
SELECT vault.create_secret('eyJ...access_token_value', 'qbo_access_token');
-- Returns: c9b00867-ca8b-44fc-a81d-d20b8169be17

-- Update an existing secret (use on token refresh)
SELECT vault.update_secret('c9b00867-ca8b-44fc-a81d-d20b8169be17', 'eyJ...new_token');

-- Read a secret by UUID
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE id = 'c9b00867-ca8b-44fc-a81d-d20b8169be17';
```

**In Edge Function (TypeScript):**
```typescript
// Always use service_role client for Vault access
const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Store token
const { data: vaultId } = await serviceClient
  .rpc('vault_create_secret', { secret: accessToken })
// Or via SQL: SELECT vault.create_secret(...)

// Read token
const { data } = await serviceClient
  .from('vault.decrypted_secrets')
  .select('decrypted_secret')
  .eq('id', tokenVaultId)
  .single()
const accessToken = data?.decrypted_secret
```

### Pattern 3: QBO OAuth 2.0 Two-Step Flow

**What:** Two endpoints — `/auth/start` generates the OAuth URL (frontend redirects user), `/auth/callback` handles the QBO redirect, exchanges code for tokens, stores in Vault.

**When to use:** Phase 1 OAuth implementation.

**Callback parameters QBO sends:** `?code=AUTH_CODE&state=RANDOM_STATE&realmId=COMPANY_ID`

**Key constraint:** The OAuth callback URL must be registered EXACTLY in the QBO Developer Dashboard. If using a Supabase Edge Function as the callback, the URL is:
`https://[PROJECT_REF].supabase.co/functions/v1/qbo-api/auth/callback`

However, the callback must also redirect the browser back to the frontend after completion. The Edge Function receives the callback server-side but must issue a browser redirect (302) back to the frontend app URL. **Plan for this redirect carefully** — the user's browser is at the QBO callback URL when the Edge Function runs.

### Pattern 4: Safe Database Migration (Existing Table)

**What:** Use `ADD COLUMN IF NOT EXISTS` with safe defaults for existing production table.

**When to use:** Extending the `expenses` table. The table has real data; unsafe migrations break the app.

**Example:**
```sql
-- Source: PostgreSQL documentation - safe column addition
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS qbo_purchase_id TEXT,
  ADD COLUMN IF NOT EXISTS qbo_pushed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qbo_error TEXT,
  ADD COLUMN IF NOT EXISTS qbo_sync_attempts INTEGER NOT NULL DEFAULT 0;

-- All new rows get qbo_sync_attempts = 0, all QBO columns are nullable
-- Existing rows are unaffected
```

### Anti-Patterns to Avoid

- **Using `https://deno.land/x/hono`:** This is the old import path. Use `jsr:@hono/hono` — confirmed by current Supabase docs (Feb 2026).
- **Missing `basePath`:** Without `.basePath('/qbo-api')`, Hono routes 404 because the function name prefix is not stripped.
- **Calling `vault.decrypted_secrets` with anon client:** Always use `service_role` client. The anon client cannot read Vault secrets by design.
- **Storing QBO Client Secret in Edge Function code:** Must use `Deno.env.get('QBO_CLIENT_SECRET')` loaded via `supabase secrets set`. Never hardcode.
- **Frontend directly calling QBO OAuth endpoints:** The token exchange POST must happen server-side in the Edge Function. Frontend only redirects the browser to the QBO authorization page URL, never handles tokens.
- **Skipping the `state` parameter:** Required for CSRF protection. Generate a random value in `/auth/start`, store temporarily (in DB or Edge Function memory scoped to request), validate in `/auth/callback`.
- **Not linking Supabase CLI before running migrations:** `supabase db push` requires `supabase link --project-ref ...` first. No `supabase/` directory currently exists in the project.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP routing inside Edge Function | Custom switch/if routing | Hono (`jsr:@hono/hono`) | Built-in request parsing, CORS middleware, composable handlers |
| Token encryption at rest | AES-GCM with custom key management | Supabase Vault (`vault.create_secret()`) | Purpose-built, handles key rotation, AEAD authenticated encryption |
| JWT verification for Supabase tokens | Manual JWT decode | `jose` (`npm:jose@^5`) | Deno-native, zero dependencies, verifies against Supabase JWKS endpoint |
| OAuth token exchange | Custom fetch + header assembly | Follow the `Authorization: Basic base64(client_id:client_secret)` pattern exactly | QBO requires this specific encoding; curl examples exist in Intuit docs |
| CORS preflight handling | Manual OPTIONS response | Hono `cors()` middleware | Handles OPTIONS, headers, preflight correctly |

**Key insight:** The QBO OAuth flow looks simple (two HTTP calls) but the token lifecycle management is where complexity hides. Vault + `vault.update_secret()` on refresh is the correct pattern — do not build a custom encryption layer.

---

## Common Pitfalls

### Pitfall 1: Missing `basePath` on Hono App

**What goes wrong:** All routes return 404. Everything looks correct in code but nothing works.

**Why it happens:** Supabase Edge Function URLs are `https://[ref].supabase.co/functions/v1/qbo-api/auth/start`. When this hits the Edge Function, the full path `/functions/v1/qbo-api/auth/start` is available. Hono needs to know the base prefix to strip it before matching routes.

**How to avoid:** `const app = new Hono().basePath('/qbo-api')` — `qbo-api` must match the directory name in `supabase/functions/qbo-api/`.

**Warning signs:** All requests return 404 despite correct route definitions.

### Pitfall 2: Vault Not Accessible via `from('vault.decrypted_secrets')`

**What goes wrong:** Supabase JS client cannot query `vault.decrypted_secrets` using the table selector syntax because it's a schema-qualified view.

**Why it happens:** The Supabase JS client's `.from()` method targets the `public` schema by default. Vault tables are in the `vault` schema.

**How to avoid:** Use raw SQL via `.rpc()` or use the PostgreSQL connection directly. Alternatively, create a `SECURITY DEFINER` function in the `public` schema that wraps the vault read, then call it via `.rpc()`.

**Recommended pattern:**
```sql
-- Create in migration (service_role only function)
CREATE OR REPLACE FUNCTION read_vault_secret(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = secret_id;
$$;
REVOKE ALL ON FUNCTION read_vault_secret(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION read_vault_secret(UUID) TO service_role;
```
```typescript
// In Edge Function
const { data } = await serviceClient.rpc('read_vault_secret', { secret_id: vaultId })
```

### Pitfall 3: OAuth Callback URL Cannot Redirect Back to Frontend

**What goes wrong:** After QBO redirects to the Edge Function callback, the user's browser is at `https://[ref].supabase.co/functions/v1/qbo-api/auth/callback`. The Edge Function processes the token, but has no way to show UI.

**Why it happens:** The OAuth redirect hits the Edge Function as a browser navigation. The Edge Function must issue a `302 Location: https://your-app.com/?qbo_connected=true` redirect to send the user back to the React app.

**How to avoid:** The `/auth/callback` handler must return a redirect response:
```typescript
// After storing tokens successfully:
return new Response(null, {
  status: 302,
  headers: { 'Location': `${Deno.env.get('QBO_FRONTEND_URL')}?qbo_connected=true` }
})
// On error:
return new Response(null, {
  status: 302,
  headers: { 'Location': `${Deno.env.get('QBO_FRONTEND_URL')}?qbo_error=true` }
})
```

**Warning signs:** User completes OAuth but sees a blank Edge Function response page instead of the app.

### Pitfall 4: No Admin Role Gate — Technicians See OAuth Button

**What goes wrong:** The current app has no authentication at all. If a "Connect to QuickBooks" button is added without an admin gate, all users see it.

**Why it happens:** The existing `App.tsx` has no auth layer, no user sessions, no role checks. Supabase Auth is not yet configured.

**How to avoid:** Phase 1 must decide: (a) add Supabase Auth with role-based visibility, or (b) use a simpler gate (e.g., hardcoded admin flag, environment variable, or just hide the button behind a URL/secret). Given the context says "admin role only" but this is the first Edge Function and first auth work, **plan the simplest viable gate first**. Options:
- Check if `qbo_connection` row exists — show green badge if yes, show button only if user is in a hardcoded admin list
- Use Supabase Auth with a role column on a `profiles` table (more complete but requires auth setup)

**Warning signs:** "Connect to QuickBooks" visible to all technician users.

### Pitfall 5: `supabase/` Directory Does Not Exist Yet

**What goes wrong:** Running any `supabase functions` or `supabase migration` commands fails because the project is not initialized.

**Why it happens:** The project was built without using the Supabase CLI. No `supabase/config.toml` exists.

**How to avoid:** First task in the plan must be:
```bash
supabase init          # Creates supabase/ directory with config.toml
supabase login         # Authenticate CLI
supabase link --project-ref YOUR_PROJECT_REF   # Link to existing hosted project
```

**Warning signs:** `supabase: command not found` or `supabase functions new` fails with "not a Supabase project."

### Pitfall 6: Refresh Token Race Condition (Phase 1 Foundation Risk)

**What goes wrong:** If token refresh is built concurrently (multiple Edge Function invocations), both try to refresh and the second one invalidates the first's newly issued refresh token.

**Why it happens:** QBO rotates the refresh token on every refresh call. Old refresh token becomes invalid immediately.

**How to avoid in Phase 1:** Phase 1 only stores tokens (initial OAuth flow). Implement `SELECT FOR UPDATE` locking during Phase 2 token refresh. However, Phase 1 migration must include the `qbo_connection` schema columns needed for this locking pattern (`token_expires_at`, `refresh_token_vault_id`).

**Warning signs:** `invalid_grant` errors on token refresh.

---

## Code Examples

### QBO OAuth Token Exchange

```typescript
// Source: Intuit OAuth 2.0 documentation (verified pattern)
// supabase/functions/qbo-api/handlers/auth-callback.ts

const clientId = Deno.env.get('QBO_CLIENT_ID')!
const clientSecret = Deno.env.get('QBO_CLIENT_SECRET')!
const redirectUri = Deno.env.get('QBO_REDIRECT_URI')!

// Step 1: Exchange authorization code for tokens
const tokenResponse = await fetch(
  'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
  {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: authCode,         // from URL: ?code=...
      redirect_uri: redirectUri,
    }),
  }
)

const tokens = await tokenResponse.json()
// tokens.access_token, tokens.refresh_token, tokens.expires_in (3600)
```

### Authorization URL Generation

```typescript
// Source: Intuit OAuth 2.0 documentation
// supabase/functions/qbo-api/handlers/auth-start.ts

const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
authUrl.searchParams.set('client_id', Deno.env.get('QBO_CLIENT_ID')!)
authUrl.searchParams.set('redirect_uri', Deno.env.get('QBO_REDIRECT_URI')!)
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
authUrl.searchParams.set('state', crypto.randomUUID()) // CSRF protection

// Return the URL — frontend does window.location.href = authUrl
return c.json({ url: authUrl.toString() })
```

### Supabase JWT Verification in Middleware

```typescript
// Source: https://supabase.com/docs/guides/functions/auth
import * as jose from 'npm:jose@^5'

const JWKS = jose.createRemoteJWKSet(
  new URL(`${Deno.env.get('SUPABASE_URL')}/auth/v1/.well-known/jwks.json`)
)

async function verifySupabaseJWT(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }
  const token = authHeader.replace('Bearer ', '')
  const { payload } = await jose.jwtVerify(token, JWKS, {
    issuer: `${Deno.env.get('SUPABASE_URL')}/auth/v1`,
  })
  return payload
}
```

### Database Migration: expenses QBO Columns

```sql
-- supabase/migrations/20260217000001_expenses_qbo_columns.sql
-- Safe addition to existing production table

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS qbo_purchase_id TEXT,
  ADD COLUMN IF NOT EXISTS qbo_pushed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qbo_error TEXT,
  ADD COLUMN IF NOT EXISTS qbo_sync_attempts INTEGER NOT NULL DEFAULT 0;

-- Index for efficient "unsynced expenses" queries
CREATE INDEX IF NOT EXISTS idx_expenses_qbo_sync
  ON expenses (qbo_pushed_at, qbo_sync_attempts)
  WHERE qbo_pushed_at IS NULL;
```

### Database Migration: qbo_connection Table with Vault References

```sql
-- supabase/migrations/20260217000002_qbo_connection.sql

-- Enable Vault (safe if already enabled)
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

CREATE TABLE IF NOT EXISTS qbo_connection (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id                 TEXT NOT NULL UNIQUE,
  company_name             TEXT,
  token_vault_id           UUID NOT NULL,   -- FK to vault.secrets (access token)
  refresh_token_vault_id   UUID NOT NULL,   -- FK to vault.secrets (refresh token)
  token_expires_at         TIMESTAMPTZ NOT NULL,
  token_issued_at          TIMESTAMPTZ NOT NULL DEFAULT now(),  -- For 5-year expiry tracking
  connected_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active                BOOLEAN NOT NULL DEFAULT true
);

-- RLS: service_role only — no user can read connection credentials
ALTER TABLE qbo_connection ENABLE ROW LEVEL SECURITY;

-- Deny ALL access to non-service_role callers
CREATE POLICY "deny_all_users" ON qbo_connection
  FOR ALL USING (false);

-- Helper function for Edge Functions to read vault secrets
CREATE OR REPLACE FUNCTION read_vault_secret(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION read_vault_secret(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION read_vault_secret(UUID) TO service_role;
```

### Storing Tokens in Vault After OAuth Callback

```typescript
// Source: Supabase Vault docs (https://supabase.com/docs/guides/database/vault)
// Using raw SQL via RPC to call vault.create_secret()

const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Store access token in Vault
const { data: accessTokenVaultId } = await serviceClient
  .rpc('create_vault_secret', { secret: tokens.access_token })

// Store refresh token in Vault
const { data: refreshTokenVaultId } = await serviceClient
  .rpc('create_vault_secret', { secret: tokens.refresh_token })

// Record connection metadata
await serviceClient.from('qbo_connection').upsert({
  realm_id: realmId,
  company_name: companyName,
  token_vault_id: accessTokenVaultId,
  refresh_token_vault_id: refreshTokenVaultId,
  token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  token_issued_at: new Date().toISOString(),
  is_active: true,
}, { onConflict: 'realm_id' })
```

### Checking QBO Connection Status (Frontend-Safe Endpoint)

```typescript
// Returns only: { connected: boolean, company_name: string | null }
// Never returns token values
app.get('/connection/status', async (c) => {
  const { data } = await serviceClient
    .from('qbo_connection')
    .select('company_name, is_active')
    .eq('is_active', true)
    .single()

  return c.json({
    connected: !!data,
    company_name: data?.company_name ?? null,
  })
})
```

### Hono CORS Middleware (Full Pattern)

```typescript
// Source: https://hono.dev/docs/getting-started/supabase-functions
import { cors } from 'jsr:@hono/hono/middleware'

app.use('*', cors({
  origin: [
    'http://localhost:5173',       // Vite dev server
    Deno.env.get('QBO_FRONTEND_URL') ?? '',  // Production URL
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `import { Hono } from 'https://deno.land/x/hono/mod.ts'` | `import { Hono } from 'jsr:@hono/hono'` | 2024 (JSR registry launch) | Old import still works but JSR is the canonical path in Supabase docs |
| `import { serve } from 'https://deno.land/std/http/server.ts'` | `Deno.serve(app.fetch)` | Deno 1.35+ / 2.x | `Deno.serve` is the stable built-in; do not use `serve` from std lib |
| Multiple small Edge Functions (one per route) | Single "fat function" with Hono routing | 2023 (Supabase recommendation) | Reduces cold starts, simplifies deployment |
| `INSERT INTO vault.secrets` directly | `vault.create_secret()` SQL function | Supabase Vault GA | Safer API; handles encryption key selection automatically |

**Deprecated/outdated:**
- `https://deno.land/std@0.168.0/http/server.ts` `serve` function: replaced by `Deno.serve()`
- `https://esm.sh/@supabase/supabase-js@2` import: use `npm:@supabase/supabase-js@2` in Deno 2.x

---

## Open Questions

1. **Admin role gate implementation**
   - What we know: The context says "admin role only" for the Connect button. The app currently has no Supabase Auth configured and no `user_id` on the `expenses` table.
   - What's unclear: Should Phase 1 add full Supabase Auth (login/logout) or use a simpler gate? The CONTEXT.md doesn't specify how admin is identified — is there an existing user session system?
   - Recommendation: Look at the existing app more carefully before planning 01-03. If there's no auth at all, the simplest path is a hardcoded admin check (e.g., specific email from Supabase Auth, or even just hiding the button behind a URL parameter for now). Full auth system is likely out of Phase 1 scope.

2. **QBO redirect URI for Edge Function callback**
   - What we know: The callback URL must be the Edge Function URL. For local dev this is `http://localhost:54321/functions/v1/qbo-api/auth/callback`. For production it's `https://[ref].supabase.co/functions/v1/qbo-api/auth/callback`.
   - What's unclear: The QBO Developer Dashboard (App ID: `0d714481-a1c4-43b0-b51a-2c7331010309`) must have this callback URL registered. Whether the production URL is registered or the production Supabase project ref is known needs confirming before 01-03 can be executed.
   - Recommendation: Verify the QBO Developer Dashboard has the correct callback URL registered. Start with sandbox/dev URL. The plan should include a step to verify this configuration.

3. **`vault.create_secret()` via Supabase JS client**
   - What we know: The function is a SQL function called `vault.create_secret()`. Supabase JS client `.rpc()` calls functions in the `public` schema by default.
   - What's unclear: Whether `vault.create_secret()` is callable directly via `.rpc()` or requires a `public` schema wrapper function.
   - Recommendation: Plan 01-01 migration should create `public` schema wrapper functions (`create_vault_secret`, `read_vault_secret`, `update_vault_secret`) that call the vault functions. This guarantees the Edge Function can call them cleanly via `.rpc()`.

4. **`supabase db push` vs `supabase migration up` for existing project**
   - What we know: The project already has a database with data. Migrations must be applied without wiping existing data.
   - What's unclear: Whether the project was created via Supabase Dashboard (without CLI) and what migration baseline exists.
   - Recommendation: Use `supabase db pull` after `supabase link` to pull the current schema as a baseline migration. Then write new migrations on top of that baseline.

---

## Sources

### Primary (HIGH confidence)

- `https://supabase.com/docs/guides/functions/routing` — Hono import path (`jsr:@hono/hono`), `basePath` requirement, `Deno.serve(app.fetch)` pattern (verified Feb 2026)
- `https://supabase.com/docs/guides/database/vault` — `vault.create_secret()`, `vault.update_secret()`, `vault.decrypted_secrets` view, UUID return type (verified Feb 2026)
- `https://supabase.com/docs/guides/functions/secrets` — `Deno.env.get()`, `supabase secrets set`, auto-available `SUPABASE_SERVICE_ROLE_KEY` (verified Feb 2026)
- `https://supabase.com/docs/guides/functions/deploy` — `supabase functions deploy`, URL format `https://[ref].supabase.co/functions/v1/[name]` (verified Feb 2026)
- `https://supabase.com/docs/guides/functions/auth` — `jose.createRemoteJWKSet()`, JWKS endpoint pattern (verified Feb 2026)
- `https://hono.dev/docs/getting-started/supabase-functions` — Hono JSR import, cors middleware import `jsr:@hono/hono/middleware` (verified Feb 2026)
- `.planning/research/STACK.md` — Prior research on QBO OAuth endpoints, `btoa(client_id:client_secret)` encoding, token lifecycle (HIGH confidence, Feb 2026)
- `.planning/research/ARCHITECTURE.md` — Fat function pattern, qbo_connection schema design, Vault RPC pattern (HIGH confidence, Feb 2026)
- `.planning/research/PITFALLS.md` — Token race conditions, 5-year expiry, minorversion=75 requirement (HIGH confidence, Feb 2026)
- Project source code `src/services/supabase.ts` — Existing `expenses` table schema (Expense TypeScript interface), confirms columns, no auth/user_id column

### Secondary (MEDIUM confidence)

- WebSearch: QBO callback parameters (`?code=...&state=...&realmId=...`) — confirmed by multiple Zapier/Auth0/Intuit community sources
- `https://makerkit.dev/blog/tutorials/supabase-vault` — Vault service_role access pattern, wrapper function approach (verified with official Vault docs)

### Tertiary (LOW confidence)

- Vault `jsr:@hono/hono/middleware` import for cors: documented by hono.dev but not explicitly shown with the full cors import example in Supabase docs — treat as confirmed pattern but test locally

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Hono JSR import and Vault API verified against current official docs (Feb 2026)
- Architecture: HIGH — Fat function pattern is Supabase's explicit recommendation; Vault schema is official API
- Pitfalls: HIGH — Most pitfalls verified from official sources; admin role gap is a real open question
- Migration approach: HIGH — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is standard PostgreSQL; safe for existing data

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days — Hono/Supabase are stable; QBO OAuth endpoints are stable)

**Critical constraint for planner:** No `supabase/` directory exists yet. Every plan in Phase 1 must account for CLI initialization as a prerequisite. The plan for 01-01 must be the first task executed.
