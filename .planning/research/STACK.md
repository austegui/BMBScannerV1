# Technology Stack: QuickBooks Online Integration

**Project:** BMB QBO Receipt-to-Expense Integration
**Researched:** 2026-02-16
**Context:** Adding QBO integration to existing React 19 + Vite 7 + TypeScript + Supabase receipt scanner PWA

---

## Executive Summary

**Recommendation:** Use native Deno `fetch` API with `jose` for OAuth, avoiding Node.js-specific libraries. QuickBooks Online API v3 (minor version 75) has no official Deno SDK, but the REST API is straightforward to integrate using web-standard APIs.

**Key Decision:** Do NOT use `node-quickbooks` or `intuit-oauth` npm packages. These have Node.js-specific dependencies (axios, csrf middleware) that create Deno compatibility friction. Build a minimal OAuth + API client using Deno/web standards instead.

**Confidence:** HIGH - All recommendations verified with official Intuit documentation and Supabase Edge Functions docs (Feb 2026).

---

## Core Stack Recommendations

### 1. QuickBooks API Client

**Recommended Approach:** Custom implementation using native Deno `fetch`

| Technology | Version | Purpose | Confidence |
|------------|---------|---------|------------|
| Native `fetch` | Built-in | HTTP client for QBO API calls | HIGH |
| `jose` (npm:jose) | ^5.9.6 | JWT verification for OAuth tokens | HIGH |

**Rationale:**

The `node-quickbooks` npm package (most popular with 19k+ weekly downloads) has dependencies on `request` (deprecated), `xml2js`, and other Node.js-specific modules. While Deno 2+ has npm compatibility via the `npm:` specifier, these packages add unnecessary complexity.

The `intuit-oauth` official package has 7 Node.js-specific dependencies:
- `axios` (HTTP client - not needed, Deno has `fetch`)
- `csrf` (CSRF middleware - not needed for backend-to-backend OAuth)
- `jsonwebtoken` (JWT - can use `jose` instead)
- `winston` (logging - Deno has native `console`)
- `atob` (base64 - Deno has native support)

**Implementation Pattern:**

```typescript
// Supabase Edge Function
const response = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/purchase`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(purchaseData)
  }
);
```

**Why NOT node-quickbooks:**
- Deno npm compatibility improved but not perfect for all Node modules
- Adds 15+ transitive dependencies
- Designed for Node.js filesystem patterns (not Edge Functions)
- Overkill for simple REST API calls

**Sources:**
- [Deno Node/npm Compatibility Docs](https://docs.deno.com/runtime/fundamentals/node/)
- [intuit-oauth Dependencies](https://github.com/intuit/oauth-jsclient/blob/master/package.json)
- [node-quickbooks npm](https://www.npmjs.com/package/node-quickbooks)

---

### 2. OAuth 2.0 Implementation

**Recommended Stack:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `jose` | npm:jose@^5.9.6 | JWT signing/verification | Deno-native, tree-shakeable, no dependencies |
| Native `fetch` | Built-in | Token exchange HTTP calls | Web standard, no library needed |
| Supabase Secrets | Built-in | Store client_id, client_secret | Encrypted at rest, accessed via `Deno.env.get()` |

**Rationale:**

`jose` is designed for web-interoperable runtimes (Node.js, Deno, Cloudflare Workers, browsers). It has ZERO dependencies and exports tree-shakeable ESM. Perfect for Edge Functions.

**OAuth 2.0 Flow Implementation:**

```typescript
// Step 1: Authorization URL (frontend redirects user)
const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2');
authUrl.searchParams.set('client_id', Deno.env.get('QBO_CLIENT_ID')!);
authUrl.searchParams.set('redirect_uri', Deno.env.get('QBO_REDIRECT_URI')!);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
authUrl.searchParams.set('state', generateRandomState());

// Step 2: Token Exchange (Edge Function)
const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: redirectUri
  })
});

// Step 3: Refresh Token (when access token expires)
const refreshResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: storedRefreshToken
  })
});
```

**Token Lifecycle:**
- Access Token: 1 hour expiry
- Refresh Token: 100 days expiry
- Must refresh before expiry (no grace period)

**Why NOT intuit-oauth:**
- Designed for Node.js Express middleware patterns
- Includes CSRF protection (unnecessary for server-to-server flows)
- Uses axios (not needed with native fetch)
- 7 dependencies vs jose's 0 dependencies

**Sources:**
- [jose GitHub - Deno Support](https://github.com/panva/jose)
- [QuickBooks OAuth Guide](https://stateful.com/blog/quickbooks-oauth)
- [Intuit OAuth 2.0 Docs](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)

---

### 3. Token Storage (Supabase PostgreSQL)

**Recommended Schema:**

```sql
-- Table: qbo_oauth_tokens
CREATE TABLE qbo_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id TEXT NOT NULL UNIQUE, -- QuickBooks Company ID
  access_token TEXT NOT NULL,    -- Encrypted (see below)
  refresh_token TEXT NOT NULL,   -- Encrypted (see below)
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_token_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE qbo_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (Edge Functions)
CREATE POLICY "Service role only" ON qbo_oauth_tokens
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast realm_id lookups
CREATE INDEX idx_qbo_tokens_realm_id ON qbo_oauth_tokens(realm_id);
CREATE INDEX idx_qbo_tokens_expires_at ON qbo_oauth_tokens(expires_at);
```

**Encryption Strategy:**

**Option 1: Supabase Vault (Recommended for HIGH security)**

```sql
-- Enable Vault extension
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- Store tokens in Vault
INSERT INTO vault.secrets (name, secret)
VALUES ('qbo_access_token_' || realm_id, access_token);

-- Retrieve in Edge Function
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'qbo_access_token_' || realm_id;
```

**Option 2: pgcrypto (Good for MEDIUM security)**

```sql
-- Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Store encrypted token
INSERT INTO qbo_oauth_tokens (realm_id, access_token, refresh_token, expires_at)
VALUES (
  $1,
  extensions.pgp_sym_encrypt($2, current_setting('app.settings.encryption_key')),
  extensions.pgp_sym_encrypt($3, current_setting('app.settings.encryption_key')),
  $4
);

-- Retrieve decrypted token
SELECT
  extensions.pgp_sym_decrypt(access_token::bytea, current_setting('app.settings.encryption_key')) as access_token
FROM qbo_oauth_tokens
WHERE realm_id = $1;
```

**Option 3: Application-level encryption (Baseline)**

```typescript
// In Edge Function
import { jose } from "npm:jose@5.9.6";

const encryptionKey = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(Deno.env.get('TOKEN_ENCRYPTION_KEY')),
  { name: 'AES-GCM' },
  false,
  ['encrypt', 'decrypt']
);

// Encrypt before storing
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  encryptionKey,
  new TextEncoder().encode(accessToken)
);
```

**Recommendation:** Start with **Supabase Vault** (Option 1). It's purpose-built for secrets, uses authenticated encryption (AEAD), and integrates cleanly with Edge Functions.

**Why encryption matters:**
- OAuth tokens grant full access to QBO account
- Supabase encrypts data at rest with AES-256, but application-level encryption adds defense-in-depth
- Tokens in logs/backups remain protected

**Token Refresh Strategy:**

```typescript
// Edge Function: Auto-refresh if token expires in < 5 minutes
async function getValidAccessToken(realmId: string): Promise<string> {
  const { data } = await supabase
    .from('qbo_oauth_tokens')
    .select('*')
    .eq('realm_id', realmId)
    .single();

  const expiresIn = new Date(data.expires_at).getTime() - Date.now();

  if (expiresIn < 5 * 60 * 1000) { // Less than 5 minutes
    // Refresh token
    const newTokens = await refreshAccessToken(data.refresh_token);

    // Update database
    await supabase
      .from('qbo_oauth_tokens')
      .update({
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token, // QBO issues new refresh token
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
        updated_at: new Date()
      })
      .eq('realm_id', realmId);

    return newTokens.access_token;
  }

  return data.access_token;
}
```

**Sources:**
- [Supabase Vault Docs](https://supabase.com/docs/guides/database/vault)
- [OAuth Token Storage Best Practices (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)
- [Supabase Token Encryption](https://supabase.com/docs/guides/auth/oauth-server/token-security)

---

### 4. QuickBooks Online API v3

**API Configuration:**

| Setting | Value | Notes |
|---------|-------|-------|
| Base URL (Production) | `https://quickbooks.api.intuit.com` | |
| Base URL (Sandbox) | `https://sandbox-quickbooks.api.intuit.com` | Development/testing only |
| Minor Version | 75 | **Required as of Aug 1, 2025** (v1-74 deprecated) |
| Content-Type | `application/json` | |
| Accept | `application/json` | |
| Authorization | `Bearer {access_token}` | |

**Critical:** As of August 1, 2025, QuickBooks API **ignores** minor versions 1-74. All requests default to minor version 75. Explicitly set `minorversion=75` in query params for clarity.

**Endpoint Pattern:**

```
GET/POST https://quickbooks.api.intuit.com/v3/company/{realmId}/{entity}?minorversion=75
```

**Required Scopes:**

```
com.intuit.quickbooks.accounting  # Access to Accounting API entities
```

**Sources:**
- [QBO API Minor Versions](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/minor-versions)
- [Minor Version 75 Deprecation Notice](https://blogs.intuit.com/2025/01/21/changes-to-our-accounting-api-that-may-impact-your-application/)

---

### 5. Purchase Entity (Credit Card Charges)

**Entity:** `Purchase` (NOT `Bill` or `Expense`)

**Use Case:** Record credit card purchases (receipts scanned by technicians)

**JSON Structure:**

```typescript
interface QBOPurchase {
  PaymentType: 'CreditCard';
  AccountRef: {
    value: string;  // QBO Account ID (credit card account)
    name?: string;  // Optional, for clarity
  };
  EntityRef?: {
    value: string;  // Vendor ID
    name?: string;
    type: 'Vendor';
  };
  TxnDate: string;  // YYYY-MM-DD
  TotalAmt: number; // Required, must match sum of Line.Amount
  PrivateNote?: string;
  Line: Array<{
    DetailType: 'AccountBasedExpenseLineDetail';
    Amount: number;
    AccountBasedExpenseLineDetail: {
      AccountRef: {
        value: string;  // Expense account (e.g., "Materials", "Fuel")
        name?: string;
      };
      ClassRef?: {
        value: string;  // Class ID (e.g., "HVAC Install", "Maintenance")
        name?: string;
      };
    };
  }>;
}
```

**Example Request:**

```typescript
const purchase: QBOPurchase = {
  PaymentType: 'CreditCard',
  AccountRef: {
    value: '42',  // Credit Card account in QBO
    name: 'Company Visa'
  },
  EntityRef: {
    value: '67',  // Vendor (e.g., "Home Depot")
    name: 'Home Depot',
    type: 'Vendor'
  },
  TxnDate: '2026-02-15',
  TotalAmt: 247.83,
  PrivateNote: 'HVAC materials - Job #1234',
  Line: [
    {
      DetailType: 'AccountBasedExpenseLineDetail',
      Amount: 247.83,
      AccountBasedExpenseLineDetail: {
        AccountRef: {
          value: '89',  // Materials expense account
          name: 'Materials & Supplies'
        },
        ClassRef: {
          value: '12',  // HVAC Install class
          name: 'HVAC Install'
        }
      }
    }
  ]
};

const response = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/purchase?minorversion=75`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(purchase)
  }
);
```

**Key Fields:**

- `PaymentType: 'CreditCard'` - **REQUIRED** for credit card transactions
- `AccountRef.value` - Credit card account in Chart of Accounts
- `EntityRef` - Vendor (optional but recommended for expense tracking)
- `TxnDate` - Transaction date (ISO 8601: YYYY-MM-DD)
- `TotalAmt` - Must equal sum of all Line.Amount values
- `Line.DetailType` - Must be `'AccountBasedExpenseLineDetail'` for expenses
- `AccountBasedExpenseLineDetail.AccountRef` - Expense account (e.g., "Materials")
- `ClassRef` - Optional, for job/department tracking

**Sources:**
- [QBO Purchase API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchase)
- [Purchase Entity Examples](https://www.getknit.dev/blog/quickbooks-online-api-integration-guide-in-depth)

---

### 6. Attachable Entity (Receipt Images)

**Purpose:** Attach receipt images (PNG/JPG/PDF) to Purchase entities

**Two-Step Process:**

1. Upload file via multipart/form-data
2. Create Attachable entity linking file to Purchase

**Upload Pattern:**

```typescript
// Step 1: Upload file
const formData = new FormData();

// Part 1: File metadata
const metadata = {
  AttachableRef: [
    {
      EntityRef: {
        type: 'Purchase',
        value: purchaseId  // ID from Purchase creation response
      }
    }
  ],
  FileName: 'receipt_2026-02-15.jpg',
  ContentType: 'image/jpeg'
};

formData.append('file_metadata_0', JSON.stringify(metadata));

// Part 2: File content (base64 or binary blob)
const fileBlob = new Blob([receiptImageBuffer], { type: 'image/jpeg' });
formData.append('file_content_0', fileBlob, 'receipt_2026-02-15.jpg');

// Upload
const uploadResponse = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/upload?minorversion=75`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      // DO NOT set Content-Type (FormData sets it with boundary)
    },
    body: formData
  }
);

const attachable = await uploadResponse.json();
// Returns Attachable entity with TempDownloadUri, Id, etc.
```

**Alternative: Two-Step Process**

```typescript
// Step 1: Create Attachable (metadata only)
const attachableMetadata = {
  FileName: 'receipt.jpg',
  ContentType: 'image/jpeg',
  AttachableRef: [
    {
      EntityRef: {
        type: 'Purchase',
        value: purchaseId
      }
    }
  ]
};

const createResponse = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/attachable?minorversion=75`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(attachableMetadata)
  }
);

const attachableId = (await createResponse.json()).Attachable.Id;

// Step 2: Upload file binary to Attachable
const fileFormData = new FormData();
fileFormData.append('file_content_0', receiptBlob, 'receipt.jpg');

await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/upload?minorversion=75`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: fileFormData
  }
);
```

**Supported File Formats:** PDF, PNG, JPEG
**Max File Size:** Check current QBO limits (typically 20-100 MB)

**Storage Strategy:**

1. **Supabase Storage:** Store original receipt image in Supabase Storage bucket
2. **Upload to QBO:** Upload to QuickBooks as Attachable
3. **Database Reference:** Store Supabase Storage URL + QBO Attachable ID in database

```typescript
// 1. Upload to Supabase Storage
const { data: storageData } = await supabase.storage
  .from('receipts')
  .upload(`${userId}/${receiptId}.jpg`, receiptBlob);

// 2. Upload to QBO (code above)

// 3. Store references
await supabase.from('receipts').update({
  supabase_storage_path: storageData.path,
  qbo_attachable_id: attachable.Attachable.Id,
  qbo_purchase_id: purchaseId
}).eq('id', receiptId);
```

**Sources:**
- [QBO Attachable API](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/attachable)
- [Attach Images Workflow](https://developer.intuit.com/app/developer/qbo/docs/workflows/attach-images-and-notes)
- [Multipart Upload Examples](https://community.n8n.io/t/upload-attachment-to-quickbooks-via-api/13964)

---

### 7. Query APIs (Accounts, Vendors, Classes)

**Purpose:** Populate dropdowns in UI with QBO data

**Query Syntax:** SQL-like query language

**General Pattern:**

```
GET https://quickbooks.api.intuit.com/v3/company/{realmId}/query?query={SQL}&minorversion=75
```

**Query Accounts (Chart of Accounts):**

```typescript
// Get all expense accounts
const query = `SELECT * FROM Account WHERE AccountType = 'Expense' AND Active = true`;
const encodedQuery = encodeURIComponent(query);

const response = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodedQuery}&minorversion=75`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  }
);

const { QueryResponse } = await response.json();
const accounts = QueryResponse.Account;
// Returns: [{ Id, Name, AccountType, ... }, ...]
```

**Query Vendors:**

```typescript
const query = `SELECT * FROM Vendor WHERE Active = true ORDERBY DisplayName`;
const response = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);

const vendors = (await response.json()).QueryResponse.Vendor;
```

**Query Classes:**

```typescript
const query = `SELECT * FROM Class WHERE Active = true`;
const response = await fetch(
  `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=75`,
  { headers: { 'Authorization': `Bearer ${accessToken}` } }
);

const classes = (await response.json()).QueryResponse.Class;
```

**Pagination:**

Maximum 1000 entities per response. Use `STARTPOSITION` and `MAXRESULTS`:

```sql
SELECT * FROM Vendor STARTPOSITION 1 MAXRESULTS 100
SELECT * FROM Vendor STARTPOSITION 101 MAXRESULTS 100
```

**Common Query Patterns:**

```sql
-- Get credit card accounts only
SELECT * FROM Account WHERE AccountType = 'Credit Card' AND Active = true

-- Search vendors by name
SELECT * FROM Vendor WHERE DisplayName LIKE '%Home Depot%'

-- Get specific account by ID
SELECT * FROM Account WHERE Id = '42'

-- Count entities
SELECT COUNT(*) FROM Vendor WHERE Active = true
```

**Caching Strategy:**

Cache Account/Vendor/Class data in Supabase to avoid rate limits:

```typescript
// Edge Function: Sync QBO accounts to Supabase every 24 hours
async function syncQBOAccounts(realmId: string) {
  const accounts = await queryQBO(`SELECT * FROM Account WHERE Active = true`);

  await supabase.from('qbo_accounts_cache').upsert(
    accounts.map(acc => ({
      realm_id: realmId,
      qbo_id: acc.Id,
      name: acc.Name,
      account_type: acc.AccountType,
      synced_at: new Date()
    })),
    { onConflict: 'realm_id,qbo_id' }
  );
}
```

**Sources:**
- [QBO Query Operations](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/data-queries)
- [Query Syntax Guide](https://www.getknit.dev/blog/quickbooks-online-api-integration-guide-in-depth)

---

### 8. Supabase Edge Functions

**Runtime:** Deno (NOT Node.js)

**Limits & Constraints:**

| Constraint | Value | Notes |
|------------|-------|-------|
| Execution Timeout | 60 seconds | Hard limit |
| Request Idle Timeout | 150 seconds | Returns 504 if no response sent |
| CPU Time | 2 seconds max | Excludes async I/O (network, database) |
| Cold Start | Milliseconds | Fast due to ESZip format |
| Memory | Platform-dependent | Typically 128-512 MB |

**Secrets Management:**

```bash
# Set secrets via CLI
supabase secrets set QBO_CLIENT_ID=your_client_id
supabase secrets set QBO_CLIENT_SECRET=your_client_secret
supabase secrets set QBO_REDIRECT_URI=https://your-app.com/oauth/callback
supabase secrets set TOKEN_ENCRYPTION_KEY=your_32_byte_key

# Access in Edge Function
const clientId = Deno.env.get('QBO_CLIENT_ID');
const clientSecret = Deno.env.get('QBO_CLIENT_SECRET');
```

**Local Development:**

```bash
# supabase/functions/.env (DO NOT COMMIT)
QBO_CLIENT_ID=sandbox_client_id
QBO_CLIENT_SECRET=sandbox_client_secret
QBO_REDIRECT_URI=http://localhost:54321/functions/v1/qbo-oauth-callback
```

**Edge Function Structure:**

```
supabase/
├── functions/
│   ├── qbo-oauth-callback/
│   │   └── index.ts          # Handles OAuth redirect, exchanges code for tokens
│   ├── qbo-create-purchase/
│   │   └── index.ts          # Creates Purchase + uploads Attachable
│   ├── qbo-sync-accounts/
│   │   └── index.ts          # Syncs Accounts/Vendors/Classes to Supabase
│   └── .env                  # Local secrets (gitignored)
```

**Example Edge Function:**

```typescript
// supabase/functions/qbo-create-purchase/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { realmId, purchaseData, receiptImage } = await req.json();

    // 1. Get valid access token
    const accessToken = await getValidAccessToken(supabase, realmId);

    // 2. Create Purchase in QBO
    const purchaseResponse = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/purchase?minorversion=75`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(purchaseData)
      }
    );

    const { Purchase } = await purchaseResponse.json();

    // 3. Upload receipt as Attachable
    if (receiptImage) {
      await uploadReceiptToQBO(realmId, Purchase.Id, receiptImage, accessToken);
    }

    return new Response(JSON.stringify({ success: true, purchaseId: Purchase.Id }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
```

**Performance Considerations:**

- **Cold Starts:** Fast (milliseconds), but design for idempotent operations
- **Timeouts:** Keep operations under 60 seconds total
- **CPU Limit:** Offload heavy processing (image manipulation) to external services if needed
- **Retries:** QBO API calls may fail; implement exponential backoff

**Sources:**
- [Supabase Edge Functions Limits](https://supabase.com/docs/guides/functions/limits)
- [Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Deno.env Documentation](https://supabase.com/docs/guides/troubleshooting/inspecting-edge-function-environment-variables-wg5qOQ)

---

## Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `jose` | npm:jose@^5.9.6 | JWT verification, token signing | OAuth token validation | HIGH |
| `zod` | Already in project | Schema validation | Validate QBO API responses | HIGH |

**NOT Recommended:**

| Library | Why NOT |
|---------|---------|
| `axios` | Not needed (Deno has native `fetch`); adds Node.js dependencies |
| `node-quickbooks` | Node.js-specific, 15+ dependencies, designed for filesystem-based apps |
| `intuit-oauth` | 7 Node.js dependencies (axios, csrf, winston), Express-focused |
| `jsonwebtoken` | Node.js Buffer API; use `jose` instead |

---

## Installation (Frontend Dependencies Only)

```bash
# No new npm packages needed for backend (Edge Functions use Deno imports)

# Frontend (React app) - OAuth redirect handling
npm install @supabase/supabase-js  # Already installed
npm install zod                    # Already installed
```

**Edge Functions Use Deno Imports:**

```typescript
// Import from npm (Deno handles it)
import { jose } from "npm:jose@5.9.6";

// Import from Deno standard library
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Import Supabase client
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

---

## Development Environment Setup

### 1. QuickBooks Sandbox Account

1. Create developer account: https://developer.intuit.com
2. Create app in Developer Dashboard
3. Get **Development Keys** (separate from Production keys)
   - Client ID
   - Client Secret
4. Create sandbox company (auto-created, up to 10 allowed)
5. Configure redirect URI: `http://localhost:54321/functions/v1/qbo-oauth-callback`

**Sandbox vs Production:**

| Environment | Base URL | Keys | Company |
|-------------|----------|------|---------|
| Sandbox | `https://sandbox-quickbooks.api.intuit.com` | Development keys | Test company (fake data) |
| Production | `https://quickbooks.api.intuit.com` | Production keys | Real QBO account |

**Important:** Development keys ONLY work with sandbox companies. Production keys ONLY work with real QBO accounts.

**Sources:**
- [QBO Sandbox Setup](https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes)
- [Create Sandbox Company](https://developer.intuit.com/app/developer/qbo/docs/develop/sandboxes/manage-your-sandboxes)

### 2. Supabase Local Development

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Create Edge Function
supabase functions new qbo-oauth-callback

# Run locally
supabase functions serve --env-file supabase/functions/.env

# Test function
curl -i --location --request POST 'http://localhost:54321/functions/v1/qbo-oauth-callback' \
  --header 'Content-Type: application/json' \
  --data '{"code":"sandbox_auth_code","realmId":"123145844726911"}'
```

---

## API Rate Limits

QuickBooks Online API has undocumented rate limits. Based on community reports:

| Limit Type | Estimated Value | Mitigation |
|------------|-----------------|------------|
| Requests/minute | ~500 | Implement request queuing |
| Concurrent requests | ~10 | Use request pooling |
| Burst protection | Yes | Exponential backoff on 429 errors |

**Rate Limit Handling:**

```typescript
async function qboFetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      // Rate limited - exponential backoff
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

---

## Testing Strategy

### Unit Tests (Deno)

```typescript
// supabase/functions/qbo-create-purchase/index.test.ts
import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.test("Purchase JSON structure is valid", () => {
  const purchase = {
    PaymentType: 'CreditCard',
    AccountRef: { value: '42' },
    TxnDate: '2026-02-15',
    TotalAmt: 100.00,
    Line: [{
      DetailType: 'AccountBasedExpenseLineDetail',
      Amount: 100.00,
      AccountBasedExpenseLineDetail: {
        AccountRef: { value: '89' }
      }
    }]
  };

  assertEquals(purchase.TotalAmt, purchase.Line[0].Amount);
});
```

### Integration Tests (Sandbox)

```typescript
// Test OAuth flow with sandbox credentials
const sandboxRealmId = '123145844726911'; // Sandbox company ID
const sandboxBaseUrl = 'https://sandbox-quickbooks.api.intuit.com';

// Test Purchase creation
const testPurchase = await fetch(
  `${sandboxBaseUrl}/v3/company/${sandboxRealmId}/purchase?minorversion=75`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sandboxAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testPurchaseData)
  }
);
```

---

## Security Checklist

- [ ] Store OAuth tokens encrypted in database (Vault or pgcrypto)
- [ ] Use Supabase Secrets for client credentials (never hardcode)
- [ ] Enable Row Level Security on `qbo_oauth_tokens` table
- [ ] Validate all QBO API responses with Zod schemas
- [ ] Implement HTTPS-only redirect URIs
- [ ] Add state parameter to OAuth flow (CSRF protection)
- [ ] Rotate encryption keys periodically
- [ ] Log OAuth events (token refresh, failures) for audit trail
- [ ] Use service role key (not anon key) for Edge Functions

---

## Alternatives Considered

| Technology | Recommended | Alternative | Why Not Alternative |
|------------|-------------|-------------|---------------------|
| HTTP Client | Native `fetch` | `axios`, `got`, `ky` | Deno has native fetch; no need for library |
| OAuth Library | Custom (fetch + jose) | `intuit-oauth` | Node.js-specific, 7 dependencies, overkill |
| QBO SDK | Custom (fetch) | `node-quickbooks` | Node.js patterns, 15+ deps, not Deno-optimized |
| JWT Library | `jose` | `jsonwebtoken` | jsonwebtoken uses Node Buffer API |
| Token Storage | Supabase Vault | Local encryption only | Vault provides AEAD, key rotation, audit logs |

---

## Migration Path (If Using Node.js Libraries)

**If you started with node-quickbooks and want to migrate:**

1. Extract API request logic from node-quickbooks wrapper
2. Replace with native fetch calls
3. Replace `jsonwebtoken` with `jose` for token verification
4. Remove `axios`, `winston`, `csrf` dependencies
5. Test all endpoints in sandbox

**Estimated effort:** 4-8 hours (most time in testing)

**Benefit:** Reduce Edge Function cold start time, eliminate Node.js compatibility issues, simpler dependency tree.

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| Deno compatibility recommendations | HIGH | Official Deno docs (Feb 2026), npm compatibility verified |
| QuickBooks API v3 structure | HIGH | Official Intuit Developer docs |
| OAuth 2.0 implementation | HIGH | Official Intuit OAuth docs, OWASP best practices |
| Token storage strategy | HIGH | Supabase Vault docs, PostgreSQL pgcrypto docs |
| Edge Functions limits | HIGH | Official Supabase docs (Feb 2026) |
| Rate limits | MEDIUM | Community reports (not officially documented) |
| Purchase entity JSON schema | HIGH | Intuit API reference, developer community examples |
| Attachable upload pattern | MEDIUM | Community examples, partial official docs |

---

## Sources

### Official Documentation
- [QuickBooks Online API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchase)
- [QuickBooks OAuth 2.0 Guide](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
- [QuickBooks Minor Versions](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/minor-versions)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Deno Node/npm Compatibility](https://docs.deno.com/runtime/fundamentals/node/)
- [jose Library GitHub](https://github.com/panva/jose)

### Community Resources
- [QuickBooks Online API Integration Guide](https://www.getknit.dev/blog/quickbooks-online-api-integration-guide-in-depth)
- [QuickBooks OAuth Tutorial](https://stateful.com/blog/quickbooks-oauth)
- [OAuth 2.0 Security Best Practices (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html)

### API Changes & Release Notes
- [QBO Minor Version 75 Deprecation Notice](https://blogs.intuit.com/2025/01/21/changes-to-our-accounting-api-that-may-impact-your-application/)
- [QuickBooks API Release Notes](https://developer.intuit.com/app/developer/qbo/docs/release-notes/platform-release-notes)

---

## Next Steps for Roadmap

Based on this stack research, recommended milestone phases:

1. **OAuth Setup** - Implement authorization flow, token storage, refresh logic
2. **QBO Data Sync** - Fetch Accounts/Vendors/Classes, cache in Supabase
3. **Purchase Creation** - Create Purchase entities from receipt data
4. **Receipt Upload** - Attach receipt images via Attachable API
5. **Error Handling** - Retry logic, rate limiting, token expiry handling

See `FEATURES.md` and `ARCHITECTURE.md` for detailed phase recommendations.
