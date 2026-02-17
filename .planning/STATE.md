# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Technicians scan a receipt on their phone and it appears in QuickBooks Online as a properly categorized expense with the receipt image attached — no manual QBO data entry by the CFO.
**Current focus:** Phase 1 - Foundation (Plan 01-03 checkpoint)

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 01-03 in progress (Tasks 1-2 complete, Task 3 checkpoint pending)
Status: Paused at checkpoint — waiting for Vercel URL to complete OAuth testing
Last activity: 2026-02-17 — 01-03 Tasks 1-2 committed, migrations pushed, Edge Function deployed

Progress: [██░░░░░░░░] ~14% (2.66/18 plans estimated)

## What's Done

### Infrastructure (all complete)
- Supabase CLI linked to project `lgodlepuythshpzayzba`
- Both migrations applied: `expenses` table (with QBO columns) + `qbo_connection` table (deny-all RLS)
- Vault NOT available on this plan — tokens stored directly in `qbo_connection` (protected by RLS)
- Edge Function `qbo-api` deployed with Hono routing, CORS, JWT auth, qboFetch helper
- Code pushed to https://github.com/Target-Dial/BMBScanner

### Edge Function Secrets (3 of 4 set)
- QBO_CLIENT_ID: ✓ set
- QBO_CLIENT_SECRET: ✓ set
- QBO_REDIRECT_URI: ✓ set (https://lgodlepuythshpzayzba.supabase.co/functions/v1/qbo-api/auth/callback)
- QBO_FRONTEND_URL: ✗ PENDING — need Vercel deployment URL

### Plan 01-03 Commits
- `4f8e8f1`: feat(01-03): implement OAuth route handlers in Edge Function
- `fe01cd8`: feat(01-03): build frontend QBO connection UI
- `79d6b41`: fix(01): create expenses table and replace Vault with direct token storage

### Redirect URI
- Registered in Intuit Developer Dashboard: ✓

## Resume Instructions

1. User provides Vercel URL
2. Set final secret: `npx supabase secrets set QBO_FRONTEND_URL=<VERCEL_URL>`
3. Also set CORS in Edge Function (QBO_FRONTEND_URL env var drives it)
4. Set Vercel env vars: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
5. Test OAuth flow end-to-end
6. If approved: create 01-03-SUMMARY.md, 01-USER-SETUP.md, update STATE/ROADMAP
7. Run phase verification
8. Complete Phase 1

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (01-01, 01-02)
- 01-03: 2/3 tasks done
- Average duration: 2min
- Total execution time: ~8min

## Accumulated Context

### Decisions

- [Setup]: Supabase Edge Functions with Hono routing (single fat function)
- [Setup]: Entity resolution by name, not hardcoded IDs
- [Setup]: minorversion=75 required on all QBO API calls
- [Setup]: RequestID (UUID v4) per transaction for idempotency on retry
- [01-01]: Vault NOT available on Supabase plan — tokens stored directly in qbo_connection table (deny-all RLS protects them)
- [01-02]: JSR import paths: jsr:@hono/hono and jsr:@hono/hono/cors
- [01-02]: /auth/callback permanently excluded from JWT; /auth/start and /connection/status temporarily excluded — TODO(Phase 2) to re-lock
- [01-02]: qboFetch() mandatory entry point for all QBO API calls
- [01-03]: In-memory CSRF state Map for OAuth (single-company, admin-only flow)

### Blockers/Concerns

- [Phase 1 - ACTIVE]: Need Vercel URL to set QBO_FRONTEND_URL secret and test OAuth
- [Phase 2]: JWT exclusion list must remove /auth/start and /connection/status when Supabase Auth is wired
- [Phase 2]: Token refresh — tokens now in qbo_connection columns (not Vault), update refresh logic accordingly

## Session Continuity

Last session: 2026-02-17
Stopped at: Plan 01-03 checkpoint — waiting for Vercel URL
Resume: User will return with Vercel URL → set QBO_FRONTEND_URL → test OAuth → complete phase
