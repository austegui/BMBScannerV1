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
| Auth | Supabase Auth (email/password, single admin user) |
| QB Integration | QBWC (poll-based SOAP ↔ QBXML) |
| Hosting | Vercel (frontend), Supabase (edge functions + DB), Railway/Render (SOAP server) |

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

## Architecture

### Edge Function (`supabase/functions/qbo-api/index.ts`)

Single Hono app with `basePath('/qbo-api')`.

**Middleware stack (order matters):**
1. CORS (allows localhost:5173 + Vercel production URL)
2. JWT auth (health check excluded)
3. Request logging

**Key helpers:**
- `escapeXml()` — XML-safe string encoding
- `buildCreditCardChargeAdd()` / `buildCheckAdd()` — expense QBXML builders
- `buildVendorAddQbxml()` — vendor creation QBXML
- `buildAccountQueryQbxml()` / `buildClassQueryQbxml()` / `buildVendorQueryQbxml()` — entity sync QBXML
- `getActiveQbdConnection()` — reads active `qbd_connection` row
- `getServiceClient()` — cached Supabase service_role client

**Routes:**
| Method | Path | Purpose |
|--------|------|---------|
| GET | /health | Health check (public) |
| GET | /connection/status | QBD connection + last sync time |
| GET | /entities/accounts | Cached accounts from QBD |
| GET | /entities/classes | Cached classes from QBD |
| GET | /entities/vendors | Cached vendors from QBD |
| POST | /entities/vendors/find-or-create | Cache lookup → queue VendorAdd |
| POST | /entities/refresh | Queue entity sync for next QBWC cycle |
| POST | /expenses/:expenseId/submit | Build QBXML, insert into sync queue |
| GET | /queue/:id/status | Check queue item status |

### SOAP Server (`soap-server/`)

Standalone Node.js + Express service. Must be deployed to a persistent host (Railway, Render, VPS) with HTTPS.

**Files:**
- `src/index.ts` — Express server, mounts SOAP endpoint at `/qbwc`, serves `.qwc` file
- `src/qbwc-service.ts` — QBWC WSDL method implementations (authenticate, sendRequestXML, etc.)
- `src/qbxml.ts` — QBXML builder/parser utilities
- `src/qbwc.wsdl` — WSDL definition for QBWC interface

**QBWC sync cycle:**
1. `authenticate` — validates company_id + shared password
2. `sendRequestXML` — returns next pending QBXML from queue (loops until empty)
3. `receiveResponseXML` — parses QBD response, updates queue + expense/entity tables
4. `closeConnection` — updates `last_sync_at`

### Database Tables

| Table | RLS | Purpose |
|-------|-----|---------|
| `expenses` | allow-all | User expenses with QBD tracking columns |
| `qbd_connection` | deny-all | QBWC connection config (shared password, company_id) |
| `qbd_sync_queue` | deny-all | QBXML request/response queue |
| `qbo_entity_accounts` | deny-all | Cached QBD accounts (populated by QBWC sync) |
| `qbo_entity_classes` | deny-all | Cached QBD classes |
| `qbo_entity_vendors` | deny-all | Cached QBD vendors |
| `qbo_connection` | deny-all | **Legacy** — QBO OAuth tokens (no longer used) |

### Frontend Services

- `src/services/supabase.ts` — Supabase client, `Expense` type, CRUD functions
- `src/services/qboService.ts` — Edge function API calls (connection status, entities, submit, queue status)
- `src/services/ocrService.ts` — Google Cloud Vision OCR

### Frontend Components

- `App.tsx` — Top-level router, renders `QboConnectionStatus` in header
- `ExpenseList.tsx` — Expense cards with sync status badges (Submit/Queued/Synced/Failed)
- `CameraCapture.tsx` — Camera capture → OCR → receipt review form → save
- `ReceiptReview.tsx` — Editable form with entity dropdowns
- `EditExpense.tsx` — Edit existing expense (reuses ReceiptReview)
- `QboConnectionStatus.tsx` — "QB Desktop: Company" + "Last synced: Xm ago"
- `Toast.tsx` — Context-based toast notifications

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
SOAP_SERVER_URL=https://<deployed-url>
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
10. **CreditCardChargeAdd uses `PayeeEntityRef`** — vendor ref goes in `<PayeeEntityRef>`, same tag as CheckAdd.
11. **CheckAdd uses `PayeeEntityRef`** — same tag name as CreditCardChargeAdd.
12. **QBXML element order is strict** — elements must follow the exact sequence from the OSR schema (e.g., `AccountRef → PayeeEntityRef → TxnDate → Memo → ExpenseLineAdd`). Wrong order causes "error when parsing the provided XML text stream."

## Expense Sync States

| State | Badge Color | Meaning |
|-------|-------------|---------|
| pending | — | Saved but not submitted |
| queued | Yellow | In sync queue, waiting for QBWC |
| synced | Green | Successfully synced to QBD (has TxnID) |
| failed | Red/Gray | Sync failed (retryable or permanent) |

## Suggested Next Steps

- **Deploy SOAP server** — Railway or Render, configure HTTPS
- **Seed `qbd_connection`** — Insert initial connection record with hashed password
- **Test with QBD** — Install QBWC, run first sync cycle end-to-end
- **Bulk submit** — "Submit All" button to queue all pending expenses at once
- **Duplicate detection** — Prevent double-submitting the same receipt
- **Push notifications** — Browser notification when sync completes
