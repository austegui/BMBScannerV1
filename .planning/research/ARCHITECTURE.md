# Architecture: QuickBooks Online Integration for React + Supabase Receipt Scanner

**Project:** BMB QBO Receipt Scanner
**Integration:** QuickBooks Online OAuth 2.0 + API
**Researched:** 2026-02-16
**Confidence:** MEDIUM (based on official documentation patterns and verified best practices)

## Executive Summary

This architecture integrates QuickBooks Online into an existing serverless React + Supabase receipt scanner app. The core challenge is adding OAuth 2.0 server-side token management and QBO API calls to a frontend-only architecture. The solution uses Supabase Edge Functions (Deno runtime) as a minimal backend layer, following a "fat functions" pattern to minimize cold starts while maintaining clear separation between receipt processing and QBO integration concerns.

**Key Architectural Decisions:**
1. **Consolidated Edge Function Pattern**: Use one primary Edge Function with internal routing (via Hono framework) rather than multiple small functions to reduce cold starts
2. **Token Security**: Store OAuth tokens in Supabase Vault with transparent column encryption, never expose to frontend
3. **Data Flow**: Frontend → Edge Function → QBO API, with attachment uploads going Frontend → Supabase Storage → Edge Function → QBO
4. **Sync State**: Track push status in existing expenses table with additional columns, avoiding separate sync tables
5. **Single-Tenant Model**: One QBO company connection stored in dedicated table, simplifying auth flows

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                          │
│                    React 19 + Vite 7 PWA                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Camera     │  │  OCR Service │  │  Review Form │         │
│  │  Component   │→ │ (GCV API)    │→ │  Component   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│                                              ↓                  │
│                                     ┌──────────────┐            │
│                                     │   Supabase   │            │
│                                     │    Client    │            │
│                                     └──────────────┘            │
│                                        ↓         ↓              │
└────────────────────────────────────────┼─────────┼──────────────┘
                                         ↓         ↓
                    ┌────────────────────┘         └──────────────┐
                    ↓                                             ↓
    ┌───────────────────────────────┐               ┌──────────────────┐
    │   SUPABASE DATABASE LAYER     │               │  SUPABASE STORAGE│
    │                               │               │                  │
    │  ┌────────────────────────┐  │               │  ┌──────────────┐│
    │  │  expenses table        │  │               │  │   receipts   ││
    │  │  - id, amount, vendor  │  │               │  │    bucket    ││
    │  │  - qbo_pushed_at       │  │               │  │  (images)    ││
    │  │  - qbo_purchase_id     │  │               │  └──────────────┘│
    │  └────────────────────────┘  │               └──────────────────┘
    │                               │                        ↓
    │  ┌────────────────────────┐  │               (signed URLs)
    │  │  qbo_connection table  │  │                        ↓
    │  │  - realm_id            │  │               ┌──────────────────┐
    │  │  - token_vault_id      │  │               │                  │
    │  │  - token_expires_at    │  │               │  EDGE FUNCTIONS  │
    │  │  - connected_at        │  │               │   (Deno Runtime) │
    │  └────────────────────────┘  │               │                  │
    │                               │               │  ┌────────────┐ │
    │  ┌────────────────────────┐  │←──────────────┼──│  QBO API   │ │
    │  │  vault.secrets table   │  │  (read tokens)│  │  Gateway   │ │
    │  │  (encrypted tokens)    │  │               │  │ (Hono)     │ │
    │  └────────────────────────┘  │               │  └────────────┘ │
    └───────────────────────────────┘               │       ↓        │
                                                    │  ┌────────────┐ │
                                                    │  │   OAuth    │ │
                                                    │  │  Handler   │ │
                                                    │  └────────────┘ │
                                                    │  ┌────────────┐ │
                                                    │  │  Purchase  │ │
                                                    │  │  Service   │ │
                                                    │  └────────────┘ │
                                                    │  ┌────────────┐ │
                                                    │  │ Attachment │ │
                                                    │  │  Service   │ │
                                                    │  └────────────┘ │
                                                    │  ┌────────────┐ │
                                                    │  │   Token    │ │
                                                    │  │  Refresh   │ │
                                                    │  └────────────┘ │
                                                    └──────────────────┘
                                                            ↓
                                            ┌───────────────────────────┐
                                            │  QUICKBOOKS ONLINE API    │
                                            │                           │
                                            │  - OAuth 2.0 endpoints    │
                                            │  - Purchase entity        │
                                            │  - Vendor entity          │
                                            │  - Account entity         │
                                            │  - Attachable entity      │
                                            └───────────────────────────┘
```

---

## Component Boundaries

### Frontend Components

| Component | Responsibility | Dependencies | Communicates With |
|-----------|---------------|--------------|-------------------|
| **Camera Component** | Capture receipt images | React hooks, browser APIs | OCR Service |
| **OCR Service** | Extract text from images | Google Cloud Vision API | Review Form |
| **Review Form** | Parse & validate expense data | React Hook Form, Zod | Supabase Client |
| **Supabase Client** | Database operations, auth | @supabase/supabase-js | Database, Edge Functions |
| **QBO Sync UI** | Trigger push to QBO, show status | React state | Edge Functions (via Supabase Client) |

**Boundaries:**
- Frontend NEVER calls QBO API directly
- Frontend NEVER sees OAuth tokens (access or refresh)
- Frontend only knows if QBO is connected (boolean) and sync status

### Supabase Edge Functions Layer

**Pattern: Single "Fat Function" with Internal Routing**

Based on Supabase best practices, consolidate QBO operations into one Edge Function with internal routing to minimize cold starts.

| Module | Responsibility | Exposed Endpoints |
|--------|---------------|-------------------|
| **API Gateway** | Route requests, handle CORS, auth | Entry point (Deno.serve) |
| **OAuth Handler** | Start OAuth flow, handle callback, exchange code for tokens | `/qbo/auth/start`, `/qbo/auth/callback` |
| **Token Manager** | Refresh tokens, store in Vault, check expiry | Internal (called by other services) |
| **Purchase Service** | Create QBO Purchase entities from expenses | `/qbo/purchase/create` |
| **Vendor Service** | Find or create QBO Vendors | Internal (called by Purchase Service) |
| **Account Service** | Get QBO expense accounts | `/qbo/accounts/list` |
| **Attachment Service** | Upload receipt images to QBO as Attachables | `/qbo/attachment/upload` |
| **Connection Service** | Get connection status, disconnect | `/qbo/connection/status`, `/qbo/connection/disconnect` |

**Internal Architecture (within Edge Function):**

```typescript
// supabase/functions/qbo-api/index.ts
import { Hono } from 'https://deno.land/x/hono/mod.ts'

const app = new Hono()

// Middleware: CORS, Auth, Error Handling
app.use('*', corsMiddleware)
app.use('*', authMiddleware) // Verify Supabase JWT
app.use('*', errorHandlerMiddleware)

// Routes
app.get('/auth/start', handleAuthStart)
app.get('/auth/callback', handleAuthCallback)
app.post('/purchase/create', handlePurchaseCreate)
app.get('/accounts/list', handleAccountsList)
app.post('/attachment/upload', handleAttachmentUpload)
app.get('/connection/status', handleConnectionStatus)
app.post('/connection/disconnect', handleDisconnect)

Deno.serve(app.fetch)
```

**Boundaries:**
- Edge Function is the ONLY component that calls QBO API
- Edge Function is the ONLY component that reads OAuth tokens
- Each service within Edge Function has single responsibility
- Services communicate via TypeScript imports (not HTTP)

### Database Layer

| Table | Responsibility | Key Columns | RLS Policy |
|-------|---------------|-------------|------------|
| **expenses** | Store receipt expense data | `id`, `amount`, `vendor`, `date`, `category`, `receipt_path`, `qbo_pushed_at`, `qbo_purchase_id`, `qbo_error`, `user_id` | User owns their expenses |
| **qbo_connection** | Store QBO connection metadata | `id`, `realm_id`, `token_vault_id`, `token_expires_at`, `refresh_token_vault_id`, `connected_at`, `last_synced_at`, `company_name` | Service role only |
| **vault.secrets** | Encrypted token storage (Supabase Vault) | Managed by Vault extension | Service role only |

**Schema Details:**

```sql
-- Extend existing expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_pushed_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_purchase_id TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_error TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS qbo_sync_attempts INT DEFAULT 0;

-- New table for QBO connection (single-tenant)
CREATE TABLE qbo_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL UNIQUE, -- QBO company ID
  token_vault_id UUID NOT NULL REFERENCES vault.secrets(id),
  refresh_token_vault_id UUID NOT NULL REFERENCES vault.secrets(id),
  token_expires_at TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  company_name TEXT,
  is_active BOOLEAN DEFAULT true
);

-- RLS: Only service_role can access qbo_connection
ALTER TABLE qbo_connection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON qbo_connection FOR ALL USING (false);
```

**Boundaries:**
- Frontend can read `expenses.qbo_pushed_at` and `qbo_purchase_id` (via RLS)
- Frontend CANNOT read `qbo_connection` table (service_role only)
- Edge Functions use service_role key to access tokens
- Vault secrets NEVER returned to frontend

### Storage Layer

| Bucket | Visibility | Purpose | Access Pattern |
|--------|-----------|---------|----------------|
| **receipts** | Private | Store receipt images | Frontend uploads with auth, Edge Functions read via signed URLs |

**Boundaries:**
- Frontend uploads images directly to Supabase Storage (authenticated)
- Edge Functions fetch images via signed URLs (time-limited)
- QBO API receives images as base64 or multipart form data

---

## Data Flow Patterns

### Flow 1: Initial OAuth Connection

```
User clicks "Connect QuickBooks"
    ↓
Frontend calls Edge Function: GET /qbo/auth/start
    ↓
Edge Function generates OAuth URL with state parameter
    ↓
Frontend redirects user to QBO authorization page
    ↓
User authorizes → QBO redirects to callback URL
    ↓
Edge Function receives callback: GET /qbo/auth/callback?code=...&state=...&realmId=...
    ↓
Edge Function exchanges code for access + refresh tokens (POST to QBO token endpoint)
    ↓
Edge Function stores tokens in Supabase Vault (encrypted)
    ↓
Edge Function stores connection metadata in qbo_connection table
    ↓
Edge Function redirects user back to frontend with success message
    ↓
Frontend shows "Connected to QuickBooks: {company_name}"
```

**Key Security Points:**
- State parameter prevents CSRF attacks
- Tokens stored encrypted in Vault, never exposed to frontend
- Callback URL must match exactly in QBO Developer dashboard

### Flow 2: Push Expense to QuickBooks

```
User reviews expense, clicks "Push to QuickBooks"
    ↓
Frontend calls Edge Function: POST /qbo/purchase/create
    Body: { expense_id: "uuid", account_id: "QBO_account_id" }
    Headers: { Authorization: "Bearer {supabase_jwt}" }
    ↓
Edge Function validates Supabase JWT (authMiddleware)
    ↓
Edge Function fetches expense from database (with RLS check)
    ↓
Edge Function checks token expiry, refreshes if needed (Token Manager)
    ↓
Edge Function retrieves decrypted tokens from Vault (service_role)
    ↓
Edge Function finds or creates Vendor in QBO (Vendor Service)
    ↓
Edge Function creates Purchase entity in QBO (Purchase Service)
    POST https://quickbooks.api.intuit.com/v3/company/{realmId}/purchase
    Headers: { Authorization: "Bearer {qbo_access_token}" }
    Body: {
      "Line": [{
        "DetailType": "AccountBasedExpenseLineDetail",
        "Amount": expense.amount,
        "AccountBasedExpenseLineDetail": {
          "AccountRef": { "value": account_id }
        }
      }],
      "EntityRef": { "value": vendor_id }
    }
    ↓
QBO returns Purchase entity with ID
    ↓
Edge Function updates expenses table:
    SET qbo_purchase_id = {qbo_id}, qbo_pushed_at = now(), qbo_error = NULL
    ↓
Edge Function returns success to frontend
    ↓
Frontend updates UI: "Pushed to QuickBooks ✓"
```

**Error Handling:**
- If token refresh fails → mark connection as inactive, prompt re-auth
- If QBO API returns 429 (rate limit) → implement exponential backoff with jitter
- If QBO API returns 400/500 → store error in `expenses.qbo_error`, increment `qbo_sync_attempts`
- If RLS check fails → return 403, prevent unauthorized access

### Flow 3: Upload Receipt Attachment to QuickBooks

```
User pushes expense with receipt image to QBO
    ↓
Frontend calls Edge Function: POST /qbo/attachment/upload
    Body: { expense_id: "uuid", purchase_id: "QBO_purchase_id" }
    ↓
Edge Function fetches expense record to get receipt_path
    ↓
Edge Function creates signed URL for receipt image from Supabase Storage
    const { data } = await supabase.storage
      .from('receipts')
      .createSignedUrl(receipt_path, 3600) // 1 hour expiry
    ↓
Edge Function fetches image from signed URL
    const imageResponse = await fetch(signedUrl)
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))
    ↓
Edge Function creates Attachable entity in QBO (two-step process)
    Step 1: POST /upload (multipart/form-data with image)
    Response: { AttachableResponse: [{ Attachable: { Id: "...", TempDownloadUri: "..." }}]}

    Step 2: POST /attachable (JSON linking to Purchase)
    Body: {
      "FileName": "receipt.jpg",
      "AttachableRef": [{
        "EntityRef": { "type": "Purchase", "value": purchase_id }
      }]
    }
    ↓
QBO returns Attachable entity
    ↓
Edge Function returns success to frontend
```

**Optimization:**
- Image fetch uses signed URLs (secure, time-limited access)
- Consider caching signed URLs briefly (e.g., 5 minutes) to avoid repeated generation
- QBO supports max 1000 attachments per entity, no size documented but recommend < 10MB

### Flow 4: Token Refresh (Automatic)

```
Edge Function receives API request requiring QBO access
    ↓
Token Manager checks token expiry
    if (token_expires_at < now() + 5 minutes) { // Proactive refresh
      ↓
      Token Manager fetches refresh token from Vault
      ↓
      Token Manager calls QBO token endpoint:
        POST https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
        Body: {
          grant_type: "refresh_token",
          refresh_token: {refresh_token}
        }
        Headers: { Authorization: "Basic {base64(client_id:client_secret)}" }
      ↓
      QBO returns NEW access token + NEW refresh token
      ↓
      Token Manager stores NEW tokens in Vault (CRITICAL: refresh token changes!)
      ↓
      Token Manager updates qbo_connection.token_expires_at
    }
    ↓
Token Manager returns fresh access token to caller
```

**CRITICAL: Token Rotation**
- QBO changes the refresh token on every refresh call
- ALWAYS store the new refresh token immediately
- Old refresh token becomes invalid after use
- Failure to store new refresh token = user must re-authenticate

---

## Patterns to Follow

### Pattern 1: Fat Function with Hono Routing

**What:** Consolidate QBO operations into one Edge Function with internal routing via Hono framework

**When:** Always for this architecture (Supabase recommendation)

**Why:** Reduces cold starts (one function boot vs multiple), simplifies deployment, faster response times

**Example:**

```typescript
// supabase/functions/qbo-api/index.ts
import { Hono } from 'https://deno.land/x/hono@v4.0.0/mod.ts'
import { cors } from 'https://deno.land/x/hono@v4.0.0/middleware.ts'

const app = new Hono()

// Global middleware
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://yourdomain.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Auth middleware
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)

  // Verify Supabase JWT
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return c.json({ error: 'Invalid token' }, 401)

  c.set('user', user)
  await next()
})

// Routes
app.get('/auth/start', authStartHandler)
app.get('/auth/callback', authCallbackHandler)
app.post('/purchase/create', purchaseCreateHandler)
app.post('/attachment/upload', attachmentUploadHandler)
app.get('/connection/status', connectionStatusHandler)

Deno.serve(app.fetch)
```

### Pattern 2: Supabase Vault for Token Storage

**What:** Use Supabase Vault extension for encrypted token storage with transparent column encryption

**When:** Storing OAuth tokens (access + refresh)

**Why:** Encryption at rest, keys stored separately from data, accessible only via service_role

**Example:**

```sql
-- Enable Vault extension
CREATE EXTENSION IF NOT EXISTS vault;

-- Create helper functions (restrict to service_role)
CREATE OR REPLACE FUNCTION store_qbo_token(token_value TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  secret_id UUID;
BEGIN
  INSERT INTO vault.secrets (secret)
  VALUES (token_value)
  RETURNING id INTO secret_id;

  RETURN secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_qbo_token(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_value TEXT;
BEGIN
  SELECT decrypted_secret INTO token_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;

  RETURN token_value;
END;
$$;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION store_qbo_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_qbo_token(TEXT) TO service_role;

REVOKE ALL ON FUNCTION get_qbo_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_qbo_token(UUID) TO service_role;
```

```typescript
// In Edge Function (with service_role client)
const serviceClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Store token
const { data } = await serviceClient.rpc('store_qbo_token', {
  token_value: accessToken
})
const tokenVaultId = data // UUID

// Retrieve token
const { data: token } = await serviceClient.rpc('get_qbo_token', {
  secret_id: tokenVaultId
})
```

### Pattern 3: Proactive Token Refresh

**What:** Refresh OAuth token 5 minutes before expiry, not on-demand when expired

**When:** Before every QBO API call

**Why:** Avoids API call failures due to expired tokens, better UX, handles QBO's 1-hour token expiry

**Example:**

```typescript
async function getValidAccessToken(realmId: string): Promise<string> {
  // Fetch connection
  const { data: connection } = await serviceClient
    .from('qbo_connection')
    .select('*')
    .eq('realm_id', realmId)
    .single()

  const now = new Date()
  const expiresAt = new Date(connection.token_expires_at)
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

  // Check if token needs refresh
  if (expiresAt < fiveMinutesFromNow) {
    // Get refresh token from Vault
    const { data: refreshToken } = await serviceClient.rpc('get_qbo_token', {
      secret_id: connection.refresh_token_vault_id
    })

    // Call QBO token endpoint
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })

    const tokens = await response.json()

    // Store NEW tokens (CRITICAL: both access AND refresh change)
    const { data: newAccessTokenId } = await serviceClient.rpc('store_qbo_token', {
      token_value: tokens.access_token
    })
    const { data: newRefreshTokenId } = await serviceClient.rpc('store_qbo_token', {
      token_value: tokens.refresh_token
    })

    // Update connection
    await serviceClient
      .from('qbo_connection')
      .update({
        token_vault_id: newAccessTokenId,
        refresh_token_vault_id: newRefreshTokenId,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000)
      })
      .eq('realm_id', realmId)

    return tokens.access_token
  }

  // Token still valid, return existing
  const { data: accessToken } = await serviceClient.rpc('get_qbo_token', {
    secret_id: connection.token_vault_id
  })

  return accessToken
}
```

### Pattern 4: Exponential Backoff for Rate Limits

**What:** Retry failed QBO API calls with exponentially increasing delays + jitter

**When:** QBO returns 429 (rate limit exceeded) or 5xx errors

**Why:** QBO enforces 500 req/min, 10 concurrent; graceful degradation prevents cascading failures

**Example:**

```typescript
async function callQBOWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const statusCode = error.response?.status

      // Don't retry on client errors (except 429)
      if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
        throw error
      }

      // Last attempt, throw
      if (attempt === maxRetries) {
        throw error
      }

      // Calculate backoff: 2^attempt * 1000ms + jitter
      const baseDelay = Math.pow(2, attempt) * 1000
      const jitter = Math.random() * 1000
      const delay = baseDelay + jitter

      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Max retries exceeded')
}

// Usage
const purchase = await callQBOWithRetry(() =>
  fetch(`${QBO_BASE_URL}/company/${realmId}/purchase`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify(purchaseData)
  }).then(r => r.json())
)
```

### Pattern 5: Sync State with Status Columns

**What:** Track QBO push status using columns in existing `expenses` table

**When:** User pushes expense to QBO

**Why:** Simple, avoids JOIN complexity, clear ownership via RLS

**Example:**

```sql
-- Sync state columns in expenses table
ALTER TABLE expenses ADD COLUMN qbo_pushed_at TIMESTAMPTZ;
ALTER TABLE expenses ADD COLUMN qbo_purchase_id TEXT;
ALTER TABLE expenses ADD COLUMN qbo_error TEXT;
ALTER TABLE expenses ADD COLUMN qbo_sync_attempts INT DEFAULT 0;

-- Query unsynced expenses
SELECT * FROM expenses
WHERE qbo_pushed_at IS NULL
  AND qbo_sync_attempts < 3 -- Avoid retry loops
ORDER BY created_at ASC;

-- Mark as synced
UPDATE expenses
SET qbo_pushed_at = now(),
    qbo_purchase_id = '{qbo_id}',
    qbo_error = NULL
WHERE id = '{expense_id}';

-- Mark as failed
UPDATE expenses
SET qbo_error = 'Rate limit exceeded',
    qbo_sync_attempts = qbo_sync_attempts + 1
WHERE id = '{expense_id}';
```

**UI Implications:**
- Show badge: "Synced to QBO" if `qbo_pushed_at` is not null
- Show error icon if `qbo_error` is not null
- Disable "Push to QBO" button if already synced
- Allow "Retry" if `qbo_error` exists and `qbo_sync_attempts < 3`

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Tokens in Local Storage or Frontend State

**What goes wrong:** Tokens exposed in browser devtools, XSS vulnerabilities, token theft

**Why it happens:** Convenience, misunderstanding of OAuth security model

**Consequences:** Unauthorized access to user's QBO account, data breach, compliance violations

**Prevention:**
- NEVER send tokens to frontend
- Store in Supabase Vault with service_role-only access
- Edge Functions are the ONLY component that reads tokens

### Anti-Pattern 2: Multiple Small Edge Functions (One per Endpoint)

**What goes wrong:** Frequent cold starts (500ms+ latency), poor UX, increased costs

**Why it happens:** Misapplying microservices patterns to serverless

**Consequences:** Slow API responses, frustrated users, higher Supabase bills

**Prevention:**
- Use Hono routing in ONE Edge Function for all QBO operations
- Supabase documentation explicitly recommends "fat functions"
- Split only if functions have different runtime requirements (e.g., long-running jobs)

### Anti-Pattern 3: Not Storing New Refresh Token After Refresh Call

**What goes wrong:** Refresh token becomes invalid, user must re-authenticate frequently

**Why it happens:** Assuming refresh token is static (like some OAuth implementations)

**Consequences:** Poor UX, lost user trust, support burden

**Prevention:**
- QBO's OAuth implementation ROTATES refresh tokens on every refresh
- ALWAYS store BOTH new access token AND new refresh token immediately
- Use database transactions to ensure atomic updates

**Example of incorrect code:**

```typescript
// WRONG: Only storing access token
const response = await refreshQBOToken(oldRefreshToken)
await storeAccessToken(response.access_token) // ❌ Missing refresh token update
```

**Correct:**

```typescript
// CORRECT: Store both tokens
const response = await refreshQBOToken(oldRefreshToken)
await Promise.all([
  storeAccessToken(response.access_token),
  storeRefreshToken(response.refresh_token) // ✅ Store new refresh token
])
```

### Anti-Pattern 4: Synchronous Attachment Uploads During Expense Creation

**What goes wrong:** Long request times (10s+), timeout errors, poor UX

**Why it happens:** Attachment upload requires: fetch image → convert → upload to QBO (slow)

**Consequences:** Users wait too long, Edge Function times out, failed syncs

**Prevention:**
- Decouple expense creation from attachment upload
- Flow: Push expense → return success → upload attachment in background
- Use Supabase Realtime to notify frontend when attachment upload completes

**Example:**

```typescript
// GOOD: Two-step process
app.post('/purchase/create', async (c) => {
  // Step 1: Create Purchase entity (fast, ~500ms)
  const purchase = await createQBOPurchase(expenseData)

  // Step 2: Queue attachment upload (return immediately)
  if (expenseData.receipt_path) {
    // Option A: Background job (Supabase doesn't have built-in queue, so use DB flag)
    await markForAttachmentUpload(expense.id, purchase.Id)

    // Option B: Fire-and-forget (risky, no retry)
    uploadAttachment(expense.id, purchase.Id).catch(console.error)
  }

  return c.json({ success: true, purchase_id: purchase.Id })
})

// Separate endpoint for attachment upload status
app.get('/attachment/status/:expense_id', async (c) => {
  const status = await getAttachmentUploadStatus(c.req.param('expense_id'))
  return c.json(status)
})
```

### Anti-Pattern 5: No Rate Limit Handling

**What goes wrong:** QBO returns 429 errors, expenses fail to sync, data inconsistency

**Why it happens:** Assuming unlimited API access, bulk sync without throttling

**Consequences:** Failed syncs, user frustration, manual cleanup required

**Prevention:**
- Implement exponential backoff for 429 responses
- Throttle bulk operations (max 500 req/min, 10 concurrent)
- Use QBO webhooks to reduce polling frequency
- Track `qbo_sync_attempts` to avoid infinite retry loops

### Anti-Pattern 6: Fetching Full Images from Frontend to Edge Function

**What goes wrong:** Slow requests, large payloads, timeout errors

**Why it happens:** Frontend sends base64 image in JSON body

**Consequences:** 10MB+ payloads, network overhead, poor performance

**Prevention:**
- Store images in Supabase Storage (already in your architecture)
- Frontend sends only `expense_id` to Edge Function
- Edge Function fetches image via signed URL (direct from Storage)
- Reduces payload size from 10MB to <1KB

---

## Scalability Considerations

| Concern | Current (MVP) | At 100 expenses/day | At 1000 expenses/day |
|---------|---------------|---------------------|----------------------|
| **Edge Function Cold Starts** | Acceptable (~500ms) | Use "fat function" pattern | Consider Supabase Functions keep-alive (paid tier) |
| **QBO Rate Limits** | Non-issue | Throttle bulk syncs | Implement queue with rate limiter, use webhooks |
| **Token Refresh Frequency** | Every hour | Cache tokens in memory (5-min TTL) | Same, QBO enforces 1-hour expiry |
| **Database Connections** | Supabase handles pooling | Same | Same (Supabase auto-scales) |
| **Image Storage** | Supabase Storage (generous limits) | Same | Consider image compression (reduce to <1MB) |
| **Vault Encryption Overhead** | Negligible (<10ms) | Same | Same (encryption is fast) |
| **Concurrent QBO API Calls** | Not an issue | Batch operations where possible | Implement queue to respect 10 concurrent limit |

### Performance Optimization Checklist

- [ ] Use Hono routing in single Edge Function (reduces cold starts)
- [ ] Proactive token refresh (5 min before expiry)
- [ ] Cache QBO account list (changes rarely, TTL 1 hour)
- [ ] Compress images before upload to QBO (target <1MB)
- [ ] Use signed URLs for Storage access (avoid re-uploading)
- [ ] Implement exponential backoff for retries
- [ ] Throttle bulk syncs (respect 500 req/min, 10 concurrent)
- [ ] Use QBO webhooks for real-time updates (reduce polling)

---

## Security Architecture

### Defense Layers

```
Layer 1: Frontend (Public Zone)
├─ Supabase Client with anon key (safe with RLS)
├─ No access to qbo_connection table
└─ No access to Vault

Layer 2: Supabase Auth (Identity Layer)
├─ JWT verification
├─ RLS policies enforce user ownership
└─ Row-level security on expenses table

Layer 3: Edge Functions (Trusted Zone)
├─ Verify Supabase JWT (authMiddleware)
├─ Use service_role key for Vault access
├─ CORS limited to known origins
└─ Environment variables for QBO credentials

Layer 4: Supabase Vault (Encryption Layer)
├─ Transparent column encryption (AES-256)
├─ Keys stored separately from data
├─ Service role only access
└─ Encrypted at rest + in transit (TLS)

Layer 5: QuickBooks Online (External API)
├─ OAuth 2.0 with PKCE
├─ Short-lived access tokens (1 hour)
├─ Refresh token rotation
└─ HTTPS only
```

### CORS Configuration

```typescript
// supabase/functions/qbo-api/index.ts
app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'http://localhost:5173', // Dev
      'https://yourdomain.com', // Prod
      'https://your-preview-url.vercel.app' // Staging
    ]

    if (allowedOrigins.includes(origin)) return origin
    return allowedOrigins[0] // Default to localhost for local dev
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours
  credentials: true
}))
```

### Environment Variables (Secrets)

Store in Supabase project settings (never commit to git):

```bash
# supabase/functions/.env (local development only, gitignored)
QBO_CLIENT_ID=your_client_id
QBO_CLIENT_SECRET=your_client_secret
QBO_REDIRECT_URI=https://your-function-url.supabase.co/qbo-api/auth/callback
QBO_ENVIRONMENT=sandbox # or production

# Auto-available in Edge Functions
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Production Deployment:**

```bash
# Set secrets in Supabase dashboard or CLI
supabase secrets set QBO_CLIENT_ID=your_client_id
supabase secrets set QBO_CLIENT_SECRET=your_client_secret
supabase secrets set QBO_REDIRECT_URI=https://your-function-url.supabase.co/qbo-api/auth/callback
supabase secrets set QBO_ENVIRONMENT=production
```

### RLS Policies

```sql
-- expenses table: Users own their expenses
CREATE POLICY "Users can view own expenses"
ON expenses FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own expenses"
ON expenses FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
ON expenses FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- qbo_connection table: Service role only (no user access)
CREATE POLICY "Service role only"
ON qbo_connection FOR ALL
USING (false); -- Deny all user access

-- vault.secrets: Managed by Vault extension (service role only)
```

### OAuth Security Checklist

- [ ] Use state parameter to prevent CSRF (generate random UUID per auth flow)
- [ ] Validate state parameter in callback matches initial request
- [ ] Verify realmId in callback matches expected company ID
- [ ] Store tokens encrypted in Vault (never in plain text)
- [ ] Use service_role key only in Edge Functions (never expose to frontend)
- [ ] Rotate refresh tokens on every refresh call (QBO requirement)
- [ ] Set redirect_uri to exact match in QBO Developer dashboard
- [ ] Use HTTPS only (QBO rejects HTTP redirect URIs)
- [ ] Implement token expiry checks before every API call
- [ ] Log OAuth errors for debugging (but never log token values)

---

## Build Order Recommendations

### Phase 1: Database Foundation (Day 1-2)

**Goal:** Set up database schema and Vault encryption

**Tasks:**
1. Extend `expenses` table with QBO sync columns
2. Create `qbo_connection` table
3. Enable Supabase Vault extension
4. Create Vault helper functions (`store_qbo_token`, `get_qbo_token`)
5. Set up RLS policies

**Dependencies:** None

**Why first:** Edge Functions need database schema to function

### Phase 2: Edge Function Scaffold (Day 2-3)

**Goal:** Create Edge Function with Hono routing and middleware

**Tasks:**
1. Initialize Edge Function: `supabase functions new qbo-api`
2. Install Hono: Add to import_map.json
3. Set up API gateway with Deno.serve
4. Implement CORS middleware
5. Implement auth middleware (Supabase JWT verification)
6. Implement error handling middleware
7. Create stub routes (return mock responses)

**Dependencies:** Phase 1 (database schema)

**Why second:** Foundation for all QBO integration logic

### Phase 3: OAuth Flow (Day 3-5)

**Goal:** Connect to QuickBooks Online via OAuth 2.0

**Tasks:**
1. Create QBO Developer account, register app
2. Implement `/auth/start` endpoint (generate OAuth URL)
3. Implement `/auth/callback` endpoint (exchange code for tokens)
4. Store tokens in Vault
5. Store connection metadata in `qbo_connection` table
6. Build frontend "Connect to QuickBooks" button
7. Handle OAuth errors and edge cases
8. Test in QBO sandbox environment

**Dependencies:** Phase 2 (Edge Function scaffold)

**Why third:** Must authenticate before making API calls

**Research Flag:** This phase is well-documented in QBO docs, unlikely to need deeper research

### Phase 4: Token Management (Day 5-6)

**Goal:** Automatic token refresh and connection status

**Tasks:**
1. Implement `getValidAccessToken()` helper (proactive refresh)
2. Implement token refresh logic (handle refresh token rotation)
3. Implement `/connection/status` endpoint (frontend checks if connected)
4. Implement `/connection/disconnect` endpoint (revoke tokens, clear DB)
5. Handle token refresh failures (mark connection inactive, prompt re-auth)
6. Add error logging for debugging

**Dependencies:** Phase 3 (OAuth flow)

**Why fourth:** Required for all subsequent QBO API calls

**Research Flag:** Low risk, standard OAuth pattern

### Phase 5: Create Purchase Entity (Day 6-8)

**Goal:** Push expenses to QuickBooks as Purchase transactions

**Tasks:**
1. Implement Vendor Service (find or create vendor by name)
2. Implement Account Service (fetch QBO expense accounts)
3. Implement Purchase Service (create Purchase entity)
4. Implement `/purchase/create` endpoint
5. Update `expenses` table on success (set `qbo_purchase_id`, `qbo_pushed_at`)
6. Handle QBO API errors (store in `qbo_error` column)
7. Implement retry logic with exponential backoff
8. Build frontend "Push to QBO" UI
9. Show sync status badges in expense list

**Dependencies:** Phase 4 (token management)

**Why fifth:** Core feature — pushing expenses to QBO

**Research Flag:** Medium risk, may need deeper dive into QBO Purchase entity schema (multiple line types, tax handling)

### Phase 6: Attachment Upload (Day 8-10)

**Goal:** Upload receipt images to QuickBooks as Attachables

**Tasks:**
1. Implement signed URL generation for Supabase Storage
2. Implement image fetch from Storage
3. Implement Attachment Service (two-step QBO upload process)
4. Implement `/attachment/upload` endpoint
5. Link Attachable to Purchase entity
6. Handle large images (compression if needed)
7. Build frontend "View in QBO" link (opens QBO web app)
8. Test with various image formats (PNG, JPG, PDF)

**Dependencies:** Phase 5 (Purchase entity creation)

**Why sixth:** Attachments depend on Purchase entity existing

**Research Flag:** Medium-high risk, QBO Attachable API has two-step process (upload → link), need to verify multipart/form-data handling in Deno

### Phase 7: Error Handling and Resilience (Day 10-11)

**Goal:** Graceful degradation, retry logic, user-friendly errors

**Tasks:**
1. Implement comprehensive error handling for QBO API responses
2. Implement exponential backoff for rate limits (429 errors)
3. Track `qbo_sync_attempts` to prevent infinite retries
4. Build frontend "Retry" UI for failed syncs
5. Display user-friendly error messages (map QBO error codes)
6. Add logging for debugging (structured logs)
7. Test failure scenarios (network errors, token expiry, rate limits)

**Dependencies:** Phases 5-6 (Purchase and Attachment creation)

**Why seventh:** Polish for production-readiness

**Research Flag:** Low risk, standard error handling patterns

### Phase 8: Performance Optimization (Day 11-12)

**Goal:** Reduce latency, improve UX

**Tasks:**
1. Cache QBO account list (1-hour TTL)
2. Compress images before upload (target <1MB)
3. Implement bulk sync throttling (respect 500 req/min limit)
4. Profile Edge Function cold start times
5. Consider keep-alive for Edge Functions (paid tier)
6. Optimize database queries (add indexes if needed)
7. Test with realistic data volumes (100+ expenses)

**Dependencies:** All previous phases

**Why eighth:** Optimize after core functionality is working

**Research Flag:** Low risk, standard optimization techniques

---

## Key Architectural Decisions and Rationale

| Decision | Alternative Considered | Rationale |
|----------|----------------------|-----------|
| **Single Edge Function with Hono** | Multiple small functions | Reduces cold starts (Supabase recommendation), faster response times |
| **Supabase Vault for tokens** | Environment variables, encrypted columns | Purpose-built for secrets, transparent encryption, service_role-only access |
| **Sync state in expenses table** | Separate sync_status table | Simpler queries, clear ownership via RLS, avoids JOINs |
| **Proactive token refresh** | On-demand refresh when expired | Avoids API call failures, better UX, QBO tokens expire in 1 hour |
| **Signed URLs for images** | Upload from frontend to Edge Function | Reduces payload size (10MB → <1KB), leverages Supabase Storage |
| **Single-tenant QBO connection** | Multi-tenant with company switcher | Simpler architecture, matches business requirement (one QBO account) |
| **Deferred attachment upload** | Synchronous upload during expense push | Prevents timeouts, better UX (fast initial response) |

---

## Open Questions and Research Flags

### High Priority (Resolve Before Build)

1. **QBO Attachable API multipart/form-data in Deno:** Verify Deno's native FormData works with QBO upload endpoint, or if custom binary handling is needed
   - **Confidence:** LOW (need to test)
   - **Risk:** High (could block attachment uploads)
   - **Action:** Test QBO Attachable upload in Phase 6

2. **QBO Purchase entity line item handling:** Confirm if single AccountBasedExpenseLineDetail is sufficient for simple expenses, or if ItemBasedExpenseLineDetail is required for itemized receipts
   - **Confidence:** MEDIUM (documentation exists but real-world usage unclear)
   - **Risk:** Medium (may need refactor if wrong)
   - **Action:** Review QBO Purchase documentation in Phase 5

### Medium Priority (Can Resolve During Build)

3. **Image compression strategy:** Determine if QBO has max file size limits for attachments, and if compression is needed
   - **Confidence:** LOW (not documented)
   - **Risk:** Medium (could cause upload failures)
   - **Action:** Test with large images (10MB+) in Phase 6

4. **QBO webhook setup:** Evaluate if webhooks are needed for real-time sync status (e.g., if user edits Purchase in QBO)
   - **Confidence:** LOW (out of scope for MVP?)
   - **Risk:** Low (nice-to-have, not blocking)
   - **Action:** Defer to post-MVP

5. **Bulk sync performance:** Test how Edge Function performs with 50+ concurrent expense syncs
   - **Confidence:** MEDIUM (Deno is performant, but untested at scale)
   - **Risk:** Low (only affects bulk operations)
   - **Action:** Load test in Phase 8

### Low Priority (Post-MVP)

6. **QBO API versioning:** Determine if minorversion parameter is needed for Purchase and Attachable APIs
   - **Confidence:** MEDIUM (recommended in documentation)
   - **Risk:** Low (APIs are stable)
   - **Action:** Add minorversion parameter in Phase 5

7. **Multi-company support:** Future enhancement to support multiple QBO companies
   - **Confidence:** HIGH (clear path to extend)
   - **Risk:** None (out of scope for MVP)
   - **Action:** Document extension path for future

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|-----------|-----------|
| **OAuth 2.0 Flow** | HIGH | Well-documented by QBO, standard pattern, verified with official sources |
| **Token Storage (Vault)** | HIGH | Supabase Vault official feature, documented best practices |
| **Edge Function Architecture** | HIGH | Supabase official recommendation (fat functions), verified in docs |
| **Purchase Entity Creation** | MEDIUM | QBO API documented, but line item structure may need testing |
| **Attachable Upload** | MEDIUM | Two-step process documented, but Deno multipart/form-data untested |
| **Rate Limiting** | HIGH | QBO limits documented (500/min, 10 concurrent), standard backoff patterns |
| **Token Refresh** | HIGH | QBO rotation behavior documented, critical pattern understood |
| **Security (RLS, CORS)** | HIGH | Supabase official patterns, standard web security practices |
| **Performance** | MEDIUM | Cold start behavior documented, but real-world performance untested |
| **Error Handling** | HIGH | Standard patterns, QBO error codes documented |

---

## Sources

### Supabase Edge Functions
- [Edge Functions Architecture | Supabase Docs](https://supabase.com/docs/guides/functions/architecture)
- [Handling Routing in Functions | Supabase Docs](https://supabase.com/docs/guides/functions/routing?queryGroups=framework&framework=hono)
- [Securing Edge Functions | Supabase Docs](https://supabase.com/docs/guides/functions/auth)
- [Environment Variables | Supabase Docs](https://supabase.com/docs/guides/functions/secrets)
- [Deno Edge Functions | Supabase Features](https://supabase.com/features/deno-edge-functions)

### Supabase Vault
- [Supabase Vault: Store Secrets Securely in Postgres](https://makerkit.dev/blog/tutorials/supabase-vault)
- [Vault | Supabase Docs](https://supabase.com/docs/guides/database/vault)

### Supabase Storage
- [JavaScript: Create a signed URL](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl)
- [Serving assets from Storage | Supabase Docs](https://supabase.com/docs/guides/storage/serving/downloads)

### QuickBooks Online API
- [Quickbooks Online API Integration Guide (In-Depth)](https://www.getknit.dev/blog/quickbooks-online-api-integration-guide-in-depth)
- [QuickBooks Online Purchase API reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchase)
- [Webhooks for QuickBooks Online REST APIs - Intuit](https://help.developer.intuit.com/s/article/Webhooks-for-QuickBooks-Online-REST-APIs)
- [QuickBooks API Rate Limits & How to Prevent Hitting Them - Coefficient](https://coefficient.io/quickbooks-api/quickbooks-api-rate-limits)

### OAuth 2.0
- [Set up an OAuth 2.0 HTTP connection to QuickBooks – Celigo Help Center](https://docs.celigo.com/hc/en-us/articles/9562462784923-Set-up-an-OAuth-2-0-HTTP-connection-to-QuickBooks)
- [Practice authorization in the OAuth Playground](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0-playground)

### Security
- [Security at Supabase](https://supabase.com/security)
- [Supabase Security Retro 2025: What Changed and What's Coming in 2026 — SupaExplorer](https://supaexplorer.com/dev-notes/supabase-security-2025-whats-new-and-how-to-stay-secure.html)
- [Best Security Practices in Supabase: A Comprehensive Guide - Supadex](https://www.supadex.app/blog/best-security-practices-in-supabase-a-comprehensive-guide)

### Sync Patterns
- [Data Synchronization Patterns | Medium](https://hasanenko.medium.com/data-synchronization-patterns-c222bd749f99)
- [Common Data Sync Strategies for Application Integration | APPSeCONNECT](https://www.appseconnect.com/common-data-sync-strategies-for-application-integration/)
