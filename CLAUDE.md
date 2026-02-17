# BMB Receipt Scanner — QBO Integration

## What This Project Is

A mobile-first PWA that lets users photograph receipts, extract expense data via OCR (Google Cloud Vision), and submit them to QuickBooks Online as Purchase entities. Built with React + Vite + Supabase Edge Functions.

**Live:** https://bmb-scanner-v1.vercel.app
**Repo:** https://github.com/austegui/BMBScannerV1

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, react-hook-form + zod |
| Backend | Supabase Edge Functions (Deno + Hono) — single "fat function" `qbo-api` |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (`receipts` bucket) |
| OCR | Google Cloud Vision API (called from frontend) |
| Auth | **None yet** — JWT middleware exists but all routes skip verification |
| Hosting | Vercel (frontend), Supabase (edge functions + DB) |

## Project References

- **Supabase project ref:** `lgodlepuythshpzayzba`
- **Supabase dashboard:** https://supabase.com/dashboard/project/lgodlepuythshpzayzba
- **Edge Function logs:** https://supabase.com/dashboard/project/lgodlepuythshpzayzba/functions/qbo-api/logs
- **Intuit Developer:** https://developer.intuit.com
- **QBO Sandbox:** https://developer.intuit.com/app/developer/sandbox (open sandbox company to see submitted Purchases under Expenses)
- **Intuit OAuth redirect URI:** `https://lgodlepuythshpzayzba.supabase.co/functions/v1/qbo-api/auth/callback`

## Completed Phases

### Phase 1: OAuth
QBO OAuth2 flow — `/auth/start` generates authorization URL, `/auth/callback` exchanges code for tokens, stores in `qbo_connection` table. Frontend has connect/disconnect UI in header.

### Phase 2: Token Management
Auto-refresh with CAS (Compare-And-Swap) for concurrent safety. `getValidAccessToken()` refreshes if <5min remaining. `authenticatedQboFetch()` is the standard wrapper (auto-refresh + 401 retry + `{realmId}` template replacement).

### Phase 3: Entity Sync
Live QBO accounts (Expense + Credit Card types), classes, and vendors synced into 3 cache tables with 24h TTL. Vendor find-or-create pattern. Frontend dropdowns in receipt review form map to QBO entity IDs saved on each expense.

### Phase 4: Submit Expense
`POST /expenses/:expenseId/submit` reads expense, builds QBO Purchase JSON, POSTs via `authenticatedQboFetch`. Frontend has submit/submitted/retry/failed button states per expense card.

## Architecture

### Edge Function (`supabase/functions/qbo-api/index.ts`)

Single Hono app with `basePath('/qbo-api')`. This is the ONLY edge function — all QBO server-side operations are routes in this file.

**Middleware stack (order matters):**
1. CORS (allows localhost:5173 + Vercel production URL)
2. JWT auth (with exclusion list — currently ALL routes are excluded since there's no Supabase Auth)
3. Request logging

**Key helpers:**
- `qboFetch(accessToken, path, options)` — low-level, always appends `minorversion=75`
- `authenticatedQboFetch(path, options)` — high-level wrapper, auto token refresh + 401 retry. Use `{realmId}` placeholder in path. **This is how all QBO API calls should be made.**
- `getValidAccessToken(forceRefresh?)` — CAS-safe token refresh
- `getActiveConnection()` — reads active `qbo_connection` row
- `getServiceClient()` — cached Supabase service_role client

**Routes:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | Health check |
| GET | /auth/start | Generate QBO OAuth URL |
| GET | /auth/callback | OAuth redirect handler (browser navigates here) |
| GET | /connection/status | Connection + token health (safe for frontend) |
| POST | /connection/disconnect | Deactivate connection, clear tokens |
| GET | /entities/accounts | Synced Expense + Credit Card accounts |
| GET | /entities/classes | Synced QBO classes |
| GET | /entities/vendors | Synced QBO vendors |
| POST | /entities/vendors/find-or-create | Cache lookup -> QBO query -> QBO create |
| POST | /entities/refresh | Force-invalidate all entity caches |
| POST | /expenses/:expenseId/submit | Submit expense to QBO as Purchase |

### Database Tables

| Table | RLS | Purpose |
|-------|-----|---------|
| `expenses` | allow-all | User expenses with QBO tracking columns |
| `qbo_connection` | deny-all | OAuth tokens (only service_role access) |
| `qbo_entity_accounts` | deny-all | Cached QBO accounts |
| `qbo_entity_classes` | deny-all | Cached QBO classes |
| `qbo_entity_vendors` | deny-all | Cached QBO vendors |

### Frontend Services

- `src/services/supabase.ts` — Supabase client, `Expense` type, CRUD functions
- `src/services/qboService.ts` — All edge function API calls (connection, entities, submit)
- `src/services/ocrService.ts` — Google Cloud Vision OCR

### Frontend Components

- `App.tsx` — Top-level router (list vs scan view), renders `QboConnectionStatus` in header
- `ExpenseList.tsx` — Expense cards with delete, view receipt, QBO submit button
- `CameraCapture.tsx` — Camera capture -> image preview -> OCR -> receipt review form -> save
- `ReceiptReview.tsx` — Editable form with QBO entity dropdowns (vendor, expense account, payment account, class)
- `QboConnectionStatus.tsx` — Connect/disconnect button + company name display

## Environment Variables

### Vercel (frontend)
```
VITE_SUPABASE_URL=https://lgodlepuythshpzayzba.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GOOGLE_CLOUD_VISION_API_KEY=<vision api key>
```

### Supabase Secrets (edge function)
```
QBO_CLIENT_ID=<intuit app client id>
QBO_CLIENT_SECRET=<intuit app client secret>
QBO_REDIRECT_URI=https://lgodlepuythshpzayzba.supabase.co/functions/v1/qbo-api/auth/callback
QBO_FRONTEND_URL=https://bmb-scanner-v1.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into edge functions.

## Deploy Commands

```bash
# Edge function (from project root)
npx supabase functions deploy qbo-api --no-verify-jwt

# Database migrations
npx supabase db push          # apply pending migrations
npx supabase db push --dry-run  # preview first (recommended)

# Frontend
npx vercel --prod
```

## Critical Gotchas

1. **Hono basePath must be `/qbo-api`** — matches the edge function directory name. Without it, ALL routes 404.
2. **No Vault extension** — Supabase free/starter plan doesn't have `pgsodium` or Vault. Tokens stored directly in `qbo_connection`, protected by deny-all RLS.
3. **QBO Purchase uses `EntityRef`, NOT `VendorRef`** — `VendorRef` causes 400 "unsupported property". Use `{ value: vendorId, type: 'Vendor' }`.
4. **QBO Purchase `TotalAmt` is read-only** — never send it on create; it's computed from Line items.
5. **QBO `minorversion=75`** — enforced on every API call via `qboFetch()`. Required as of August 2025.
6. **All routes skip JWT** — no Supabase Auth wired yet. The JWT middleware exists and works, but every route is in the exclusion list. Only `/auth/callback` should permanently skip JWT.
7. **Supabase CLI has no `functions logs`** — must use dashboard UI at the URL above.
8. **Supabase CLI `login` fails in non-TTY** — developer must run `npx supabase login` manually in a regular terminal.
9. **Entity cache TTL is 24h** — controlled by `ENTITY_TTL_MS` constant in the edge function.
10. **CAS token refresh** — when refreshing QBO tokens, the edge function uses Compare-And-Swap on `token_expires_at` to prevent race conditions between concurrent invocations.

## Suggested Next Steps

- **Supabase Auth** — Add real user login, remove routes from JWT exclusion list, add `user_id` to expenses table
- **Receipt image as QBO attachment** — Upload receipt photo as attachment on the QBO Purchase entity
- **Bulk submit** — "Submit All" button to push all pending expenses at once
- **Edit expense** — Allow editing before QBO submission
- **Duplicate detection** — Prevent double-submitting or scanning the same receipt
- **Toast notifications** — Replace `alert()` calls with proper toast UI
