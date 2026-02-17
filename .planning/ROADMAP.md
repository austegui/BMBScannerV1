# Roadmap: BMB QBO Receipt Scanner

## Overview

This project adds QuickBooks Online integration to an existing React + Supabase receipt scanner PWA. The work proceeds in dependency order: database schema and OAuth first, then token management, then entity synchronization from QBO, then purchase creation, then receipt attachment, then production hardening. At the end, technicians scan a receipt and it appears in QBO as a Credit Card Purchase/Charge with the image attached — no manual entry by the CFO.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Database schema, Supabase Edge Function scaffold, and OAuth initial setup
- [ ] **Phase 2: Token Management** - Transparent access token refresh, refresh token rotation, expiry tracking
- [ ] **Phase 3: Entity Sync** - Pull accounts, vendors, and classes from QBO with caching and UI pickers
- [ ] **Phase 4: Purchase Creation** - Push expenses to QBO as Credit Card Purchase/Charge with full field mapping
- [ ] **Phase 5: Attachment Upload** - Attach receipt images to QBO transactions via Attachable API
- [ ] **Phase 6: Reliability and Production Hardening** - Error handling, retry, batch review, deduplication, sync status

## Phase Details

### Phase 1: Foundation
**Goal**: The infrastructure exists for all QBO server-side operations — schema ready, Edge Function scaffold running, OAuth connection established for BMB's single QBO account
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, AUTH-01, REL-06
**Success Criteria** (what must be TRUE):
  1. Admin can complete QBO OAuth flow via "Connect to QuickBooks" button and tokens are stored encrypted in Supabase Vault
  2. Supabase Edge Function with Hono routing is deployed and reachable — no QBO calls leak through the frontend
  3. `expenses` table has QBO sync columns (`qbo_purchase_id`, `qbo_pushed_at`, `qbo_error`, `qbo_sync_attempts`) and `qbo_connection` table exists with `realm_id` and `token_vault_id`
  4. All QBO API calls include `minorversion=75` query parameter
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Supabase CLI init, database migrations (expenses QBO columns, qbo_connection table, Vault extension, wrapper functions, RLS)
- [ ] 01-02-PLAN.md — Edge Function scaffold with Hono routing, CORS, JWT auth middleware, qboFetch helper (minorversion=75), error handling
- [ ] 01-03-PLAN.md — OAuth flow endpoints (/auth/start, /auth/callback), Vault token storage, frontend "Connect to QuickBooks" button and connection status badge

### Phase 2: Token Management
**Goal**: Access tokens refresh automatically every hour without user awareness, refresh token rotation is race-condition safe, and the 5-year expiry is tracked
**Depends on**: Phase 1
**Requirements**: AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. QBO API calls succeed after the 1-hour access token window without any user action
  2. Concurrent token refresh requests do not corrupt each other — database lock prevents race condition
  3. Token expiration date (5-year limit) is stored and accessible for future monitoring
**Plans**: TBD

Plans:
- [ ] 02-01: `getValidAccessToken()` helper with proactive 5-minute refresh window and database-level `SELECT FOR UPDATE` locking
- [ ] 02-02: Token rotation (store both new access + refresh tokens atomically), connection status endpoint, disconnect endpoint, expiry date tracking

### Phase 3: Entity Sync
**Goal**: The review form is populated with live QBO data — expense accounts from Chart of Accounts, vendors from QBO vendor list, classes from QBO Classes, and credit card accounts from QBO accounts
**Depends on**: Phase 2
**Requirements**: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, FLOW-03, FLOW-04
**Success Criteria** (what must be TRUE):
  1. Expense category picker shows QBO Chart of Accounts populated from live QBO data, not hardcoded values
  2. Class picker shows QBO Classes and payment account picker shows QBO credit card accounts
  3. OCR-extracted vendor name is fuzzy-matched against QBO vendor list and pre-selected when a match is found
  4. When no vendor match exists, a new vendor is created in QBO on push
  5. Entity data is cached (not re-fetched on every receipt) and refreshed periodically by name — no hardcoded entity IDs
**Plans**: TBD

Plans:
- [ ] 03-01: Account Service and Class Service (fetch QBO Chart of Accounts and Classes, cache with TTL, `/entities/accounts` and `/entities/classes` endpoints)
- [ ] 03-02: Vendor Service (fetch QBO vendor list, fuzzy name matching, create-if-not-found, `/entities/vendors` endpoint)
- [ ] 03-03: Frontend pickers for expense category, class, payment account; OCR vendor pre-selection; entity cache invalidation

### Phase 4: Purchase Creation
**Goal**: A technician can push a saved expense to QBO as a Credit Card Purchase/Charge — the entry appears in QBO with correct vendor, account, class, cardholder, memo, and payment account
**Depends on**: Phase 3
**Requirements**: PURCH-01, PURCH-02, PURCH-03, PURCH-04, PURCH-05, PURCH-06, PURCH-07, FLOW-01, FLOW-02, FLOW-05, REL-01, REL-04
**Success Criteria** (what must be TRUE):
  1. Tapping "Push to QBO" creates a Purchase entity in QBO with `PaymentType=CreditCard`, correct `AccountRef`, `VendorRef`, `DocNumber` (cardholder initials), `PrivateNote` (memo), and Class on the expense line
  2. The cardholder dropdown (2-5 technicians by initials) and payment account picker are available in the review form
  3. Expense can be saved to Supabase locally without immediately pushing to QBO (dual save)
  4. Duplicate push attempts are blocked by RequestID idempotency — retrying the same expense does not create a second QBO entry
  5. Rate limiter keeps QBO API calls under 500 req/min
**Plans**: TBD

Plans:
- [ ] 04-01: Purchase Service (`/purchase/create` endpoint, QBO Purchase entity construction, full field mapping, `minorversion=75`, RequestID idempotency)
- [ ] 04-02: Rate limiter (token bucket, 500 req/min), `expenses` table sync status updates (`qbo_purchase_id`, `qbo_pushed_at`, `qbo_error`)
- [ ] 04-03: Frontend "Push to QBO" button, cardholder initials dropdown, dual save flow (local-only vs immediate push), sync status badge per expense

### Phase 5: Attachment Upload
**Goal**: Every QBO Purchase entry has the receipt image attached — viewable directly from QBO
**Depends on**: Phase 4
**Requirements**: PURCH-08
**Success Criteria** (what must be TRUE):
  1. After a purchase is created in QBO, the receipt image appears as an attachment on that transaction in QBO
  2. Attachment upload handles PNG, JPG, and PDF receipt images without exceeding QBO size limits
**Plans**: TBD

Plans:
- [ ] 05-01: Attachment Service (fetch image from Supabase Storage via signed URL, two-step QBO Attachable upload: POST multipart → link to Purchase entity, `/attachment/upload` endpoint)
- [ ] 05-02: Image compression (target under 2MB), format validation (PNG/JPG/PDF), attachment triggered automatically after successful purchase creation

### Phase 6: Reliability and Production Hardening
**Goal**: The integration handles failures gracefully — failed pushes are retryable, duplicate receipts are caught, batch review lets the CFO process multiple expenses at once, and sync status is always visible
**Depends on**: Phase 5
**Requirements**: FLOW-06, FLOW-07, REL-02, REL-03, REL-05
**Success Criteria** (what must be TRUE):
  1. Failed QBO submissions show a "Retry" action and retry with exponential backoff (1s, 2s, 4s, 8s), capped at 3 attempts before marking as permanently failed
  2. Every saved expense displays a sync status badge (not sent / sending / sent / failed) that reflects current state
  3. Batch review screen lists all saved expenses with per-expense "Send to QBO" action and a bulk-send option
  4. Submitting the same receipt twice (same vendor + amount + date hash) is detected and blocked before a second QBO push
**Plans**: TBD

Plans:
- [ ] 06-01: Exponential backoff retry (1s, 2s, 4s, 8s), max 3 attempts (`qbo_sync_attempts`), `failed` status after exhaustion, user-facing error messages (not raw API errors)
- [ ] 06-02: Hash-based duplicate detection (vendor + amount + date), block duplicate push with warning
- [ ] 06-03: Batch review screen (expense list with sync status badges, per-expense "Send to QBO", bulk send action)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Planning complete | - |
| 2. Token Management | 0/2 | Not started | - |
| 3. Entity Sync | 0/3 | Not started | - |
| 4. Purchase Creation | 0/3 | Not started | - |
| 5. Attachment Upload | 0/2 | Not started | - |
| 6. Reliability and Production Hardening | 0/3 | Not started | - |
