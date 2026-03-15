# BMB Receipt Scanner — QuickBooks Desktop Integration

## What This Project Is

A mobile-first PWA that lets users photograph receipts, extract expense data via OCR (Google Cloud Vision), and submit them to QuickBooks Desktop via the QuickBooks Web Connector (QBWC). Built with React + Vite + Supabase Edge Functions + a SOAP server.

**Live:** https://bmb-scanner-v1.vercel.app
**Repo:** https://github.com/austegui/BMBScannerV1

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, react-hook-form + zod |
| Edge Function | Supabase Edge Functions (Deno + Hono) — single "fat function" `qbo-api` |
| SOAP Server | Node.js + Express + `soap` npm package (separate service) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (`receipts` bucket) |
| OCR | Google Cloud Vision API (called from frontend) |
| Auth | Supabase Auth (email/password) with role-based access (admin/user) |
| QB Integration | QBWC (poll-based SOAP ↔ QBXML) |
| Hosting | Vercel (frontend), Supabase (edge functions + DB), Railway (SOAP server) |

## Architecture Overview

```
Phone → Frontend → Supabase Edge Function → Queue Table (Supabase DB)
                                                    ↓
              Client's PC: QBD ← QBWC ← polls → SOAP Server (Node.js)
                                                    ↓
                                              Reads queue, returns QBXML
                                              Writes responses back to DB
```

**Key difference from QBO:** This is NOT real-time. Expenses are **queued** and synced on a 5-minute interval when QBWC polls the SOAP server. The frontend shows "Queued" → "Synced" states.

## Project References

- **Supabase project ref:** `lgodlepuythshpzayzba`
- **Supabase dashboard:** https://supabase.com/dashboard/project/lgodlepuythshpzayzba
- **Edge Function logs:** https://supabase.com/dashboard/project/lgodlepuythshpzayzba/functions/qbo-api/logs
- **SOAP server:** https://soap-server-production.up.railway.app
- **Admin user:** `gustavo@targetdial.co`

## Completed Phases

### Phases 1–6 (QBO era — superseded)
OAuth, token management, entity sync, submit expense, auth + attachments, edit + toast. The QBO-specific code (OAuth, REST API calls, CAS token refresh, attachment upload) has been **removed** and replaced with QBD queue-based architecture.

### Phase 7: QBWC SOAP Server
New Node.js + Express service implementing the QBWC WSDL interface. Located in `soap-server/`. Handles `authenticate`, `sendRequestXML`, `receiveResponseXML`, `getLastError`, `closeConnection`. Reads pending QBXML from `qbd_sync_queue`, parses QBD responses, updates expense status and entity caches.

### Phase 8: Edge Function Adaptation
Edge function rewritten from QBO REST API calls to queue-based flow. Submit route now inserts QBXML into `qbd_sync_queue` instead of calling QBO API. OAuth routes removed. Entity routes read from cache tables (populated by QBWC sync). New queue status endpoint.

### Phase 9: Frontend Adaptation
Async submission UI: "Submit to QuickBooks" → "Queued" (yellow) → "Synced" (green). Connection status shows "QB Desktop: Company Name" + "Last synced: Xm ago" instead of OAuth connect/disconnect. No attachment-related UI (QBD has no attachment API via QBXML). Entity full names saved on expenses for QBXML generation.

### Phase 10: Client Onboarding
`.qwc` file generator built into SOAP server (`GET /qwc`). Setup documentation provided.

### Phase 11: Admin Interface & Role-Based Access
Full admin dashboard with 4 tabs (Users, Expenses, Sync Queue, Health). User management with role toggling and account activation/deactivation. `profiles` table with auto-create trigger on signup. JWT role extraction with fallback to profiles table for stale tokens. Backfill migration for pre-existing auth users.

## Architecture

### Edge Function (`supabase/functions/qbo-api/index.ts`)

Single Hono app with `basePath('/qbo-api')`.

**Middleware stack (order matters):**
1. CORS (allows localhost:5173 + Vercel production URL)
2. JWT auth (public `/health` excluded, but `/admin/health` requires auth)
3. Request logging

**Key helpers:**
- `escapeXml()` — XML-safe string encoding
- `buildCreditCardChargeAdd()` / `buildCheckAdd()` — expense QBXML builders
- `buildVendorAddQbxml()` — vendor creation QBXML
- `buildAccountQueryQbxml()` / `buildClassQueryQbxml()` / `buildVendorQueryQbxml()` — entity sync QBXML
- `getActiveQbdConnection()` — reads active `qbd_connection` row
- `getServiceClient()` — cached Supabase service_role client
- `requireAdmin()` — guard that checks `userRole === 'admin'`; returns 403 if not

**Routes:**

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /health | Public | Health check |
| GET | /connection/status | JWT | QBD connection + last sync time |
| GET | /entities/accounts | JWT | Cached accounts from QBD |
| GET | /entities/classes | JWT | Cached classes from QBD |
| GET | /entities/vendors | JWT | Cached vendors from QBD |
| POST | /entities/vendors/find-or-create | JWT | Cache lookup → queue VendorAdd |
| POST | /entities/refresh | JWT | Queue entity sync for next QBWC cycle |
| POST | /expenses/:expenseId/submit | JWT | Build QBXML, insert into sync queue |
| GET | /queue/:id/status | JWT | Check queue item status |
| GET | /me/profile | JWT | Current user's profile from profiles table |
| GET | /admin/users | Admin | List all users with profiles |
| POST | /admin/users/invite | Admin | Create new user (email, password, role) |
| PATCH | /admin/users/:id/role | Admin | Change user role (updates auth metadata + profiles) |
| PATCH | /admin/users/:id/status | Admin | Activate/deactivate user (ban/unban in Supabase Auth) |
| GET | /admin/expenses | Admin | All expenses across all users with user info |
| GET | /admin/queue | Admin | Queue overview: status counts + recent items |
| GET | /admin/health | Admin | System health: connection, cache, expense, user counts |

### SOAP Server (`soap-server/`)

Standalone Node.js + Express service. Must be deployed to a persistent host (Railway, Render, VPS) with HTTPS.

**Files:**
- `src/index.ts` — Express server, mounts SOAP endpoint at `/qbwc`, serves `.qwc` file
- `src/qbwc-service.ts` — QBWC WSDL method implementations (authenticate, sendRequestXML, etc.)
- `src/qbxml.ts` — QBXML builder/parser utilities
- `src/qbwc.wsdl` — WSDL definition for QBWC interface

**QBWC sync cycle:**
1. `authenticate` — validates company_id + shared password (bcrypt)
2. `sendRequestXML` — returns next pending QBXML from queue (loops until empty)
3. `receiveResponseXML` — parses QBD response, updates queue + expense/entity tables
4. `closeConnection` — updates `last_sync_at`

### Database Tables

| Table | RLS | Purpose |
|-------|-----|---------|
| `expenses` | user_id scoped | User expenses with QBD tracking columns |
| `profiles` | self-read + admin | User profiles (role, full_name, is_active) — auto-created on signup |
| `qbd_connection` | deny-all | QBWC connection config (shared password, company_id) |
| `qbd_sync_queue` | deny-all | QBXML request/response queue |
| `qbo_entity_accounts` | deny-all | Cached QBD accounts (populated by QBWC sync) |
| `qbo_entity_classes` | deny-all | Cached QBD classes |
| `qbo_entity_vendors` | deny-all | Cached QBD vendors |
| `qbo_connection` | deny-all | **Legacy** — QBO OAuth tokens (no longer used) |

### Auth & Role System

**Profiles table** (`profiles`):
- `id` (UUID, FK → auth.users), `email`, `full_name`, `role` ('admin' | 'user'), `is_active` (boolean)
- Auto-created via database trigger when a user signs up
- Backfill migration ensures all pre-existing auth.users have profiles

**Role resolution** (JWT middleware):
1. Check `app_metadata.role` from JWT payload
2. If absent (stale token), fall back to `profiles.role` query
3. Role stored in Hono context via `c.set('userRole', role)`

**RLS policies:**
- Users read only their own profile (or all if admin)
- Users update only their own profile
- Admins can update any profile
- Service role inserts profiles via edge function

### Frontend Services

- `src/services/supabase.ts` — Supabase client, `Expense` type, CRUD functions (`saveExpense`, `getExpenses`, `updateExpense`, `uploadReceiptImage`)
- `src/services/qboService.ts` — Edge function API calls (connection status, entities, submit, queue status)
- `src/services/adminService.ts` — Admin API calls (`getUsers`, `inviteUser`, `updateUserRole`, `updateUserStatus`, `getAdminExpenses`, `getQueueOverview`, `getSystemHealth`)
- `src/services/ocrService.ts` — Google Cloud Vision OCR (`extractText` with progress callback)

### Frontend Components

- `App.tsx` — Top-level router, manages auth state and view switching (list/scan/edit/admin)
- `LoginPage.tsx` — Email/password login form
- `ExpenseList.tsx` — Expense cards with sync status badges (Submit/Queued/Synced/Failed)
- `CameraCapture.tsx` — Camera capture → image quality checks → OCR → receipt review form → save
- `ReceiptReview.tsx` — Editable expense form with entity dropdowns + smart vendor matching
- `EditExpense.tsx` — Edit existing expense (wraps ReceiptReview)
- `QboConnectionStatus.tsx` — "QB Desktop: Company" + "Last synced: Xm ago" + "Sync Entities" button
- `AdminDashboard.tsx` — Tabbed admin interface (Users, Expenses, Sync Queue, Health)
- `AdminUserList.tsx` — User management: create users, toggle roles, activate/deactivate
- `AdminExpenseList.tsx` — All expenses across all users, filterable by user
- `AdminSyncQueue.tsx` — Queue status counts + recent items with error messages
- `AdminSystemHealth.tsx` — System health: connection, cache counts, expense totals, user count
- `Toast.tsx` — Context-based toast notifications (success/error/info)
- `ImagePreview.tsx` — Full-screen receipt image modal
- `LineItemEditor.tsx` — Individual line item editing form
- `QualityWarning.tsx` — Alerts for blurry or dark images

### Frontend Hooks

- `src/hooks/useAuth.ts` — `session`, `loading`, `signIn`, `signOut`, `isAdmin`, `userRole`, `userId`

### Frontend Utils

- `src/utils/imageCompression.ts` — `compressImage(file)` → `CompressionResult`
- `src/utils/imageQuality.ts` — `detectBlur()`, `detectDarkness()` → quality scores + flags
- `src/utils/receiptParser.ts` — `parseReceipt(rawText)` → merchant, date, total, line items

### Frontend Types

- `src/types/receipt.ts` — `RawOCRResult`, `OCRWord`, `LineItem`, `ReceiptData`

## Database Migrations

Located in `supabase/migrations/`, in chronological order:

1. `20260217000001_expenses_qbo_columns.sql` — Initial expenses table with QBO sync columns
2. `20260217000002_qbo_connection.sql` — QBO OAuth config table (legacy)
3. `20260217000003_receipts_storage_policies.sql` — Storage bucket RLS for receipts
4. `20260218000001_qbo_connection_refresh_expiry.sql` — OAuth token refresh tracking (legacy)
5. `20260218000002_qbo_entity_cache.sql` — Entity cache tables (accounts, classes, vendors)
6. `20260219000001_storage_auth_policies.sql` — Storage RLS updates
7. `20260219000002_expenses_attachment_column.sql` — Attachment tracking (legacy)
8. `20260303000001_qbd_tables.sql` — QBD tables: `qbd_connection`, `qbd_sync_queue`; adds QBD columns to expenses
9. `20260309000001_cleanup_stale_queue.sql` — Cleanup orphaned queue items
10. `20260310000001_profiles_and_user_id.sql` — Profiles table, `user_id` FK on expenses, RLS policies, auto-create trigger
11. `20260310000002_set_admin_metadata.sql` — Sets gustavo@targetdial.co as admin in auth metadata
12. `20260310000003_backfill_profiles.sql` — Backfills profiles for all existing auth.users

## Environment Variables

### Vercel (frontend)
```
VITE_SUPABASE_URL=https://lgodlepuythshpzayzba.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GOOGLE_CLOUD_VISION_API_KEY=<vision api key>
```

### Supabase Secrets (edge function)
```
QBO_FRONTEND_URL=https://bmb-scanner-v1.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into edge functions.

### SOAP Server (.env)
```
PORT=8080
SUPABASE_URL=https://lgodlepuythshpzayzba.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SOAP_SERVER_URL=https://soap-server-production.up.railway.app
```

## Deploy Commands

```bash
# Edge function (from project root)
npx supabase functions deploy qbo-api --no-verify-jwt

# Database migrations
npx supabase db push          # apply pending migrations
npx supabase db push --dry-run  # preview first (recommended)

# Frontend
npx vercel --prod

# SOAP server (from soap-server/)
npm install && npm run build
# Deploy dist/ to Railway/Render
```

## Dev Setup

```bash
# Frontend
npm install
npm run dev          # starts Vite dev server on localhost:5173

# Tests
npm run test         # vitest run
npm run test:watch   # vitest watch mode

# SOAP server (from soap-server/)
npm install
npm run dev          # ts-node with nodemon
```

## Client Setup (QBWC)

1. Install QuickBooks Web Connector (QBWC 2.3+) on the PC running QBD
2. Download the `.qwc` file from `https://<soap-server>/qwc`
3. Open the `.qwc` file in QBWC — it registers the SOAP endpoint
4. Enter the shared password when prompted
5. Grant "always allow" access to the company file
6. Set auto-run interval to 5 minutes
7. Keep QBWC running (ideally auto-start with Windows)

## QBXML Data Model Mapping

| QBO Concept | QBD QBXML Equivalent |
|---|---|
| Purchase (CreditCard) | `CreditCardChargeAddRq` |
| Purchase (Check) | `CheckAddRq` |
| Account query | `AccountQueryRq` |
| Class query | `ClassQueryRq` |
| Vendor query | `VendorQueryRq` |
| Vendor create | `VendorAddRq` |
| Attachment upload | **Not supported** (QBD has no attachment API via QBXML) |

## Critical Gotchas

1. **Hono basePath must be `/qbo-api`** — matches the edge function directory name. Without it, ALL routes 404.
2. **QBWC is poll-based** — submissions are queued, not instant. Frontend must handle async flow.
3. **QBD QBXML uses FullName strings** — not numeric IDs like QBO. Entity references use `<FullName>` tags.
4. **No attachments** — QBD has no attachment API via QBXML. Receipt images stay in Supabase Storage only.
5. **SOAP server must be HTTPS** — QBWC requires SSL for remote connections.
6. **SOAP server must be persistent** — not serverless. Needs to stay running to accept QBWC polls.
7. **Supabase CLI has no `functions logs`** — must use dashboard UI.
8. **Supabase CLI `login` fails in non-TTY** — developer must run `npx supabase login` manually.
9. **Entity cache populated by QBWC** — must complete at least one sync cycle before entities appear in dropdowns.
10. **CreditCardChargeAdd and CheckAdd both use `PayeeEntityRef`** — vendor ref goes in `<PayeeEntityRef>`.
11. **QBXML element order is strict** — elements must follow the exact sequence from the OSR schema (e.g., `AccountRef → PayeeEntityRef → TxnDate → Memo → ExpenseLineAdd`). Wrong order causes "error when parsing the provided XML text stream."
12. **JWT health check bypass** — only the public `/health` endpoint skips JWT auth; `/admin/health` requires auth + admin role.
13. **Role resolution has a fallback** — if JWT `app_metadata.role` is stale/missing, the middleware queries the `profiles` table. This means role changes take effect immediately even before the user refreshes their token.
14. **RLS on expenses uses `user_id`** — non-admin users can only see their own expenses. Admin routes use the service_role client to bypass RLS.

## Expense Sync States

| State | Badge Color | Meaning |
|-------|-------------|---------|
| pending | — | Saved but not submitted |
| queued | Yellow | In sync queue, waiting for QBWC |
| synced | Green | Successfully synced to QBD (has TxnID) |
| failed | Red/Gray | Sync failed (retryable or permanent) |

## Suggested Next Steps

- **Seed `qbd_connection`** — Insert initial connection record with hashed password
- **Test with QBD** — Install QBWC, run first sync cycle end-to-end
- **Bulk submit** — "Submit All" button to queue all pending expenses at once
- **Duplicate detection** — Prevent double-submitting the same receipt
- **Push notifications** — Browser notification when sync completes
