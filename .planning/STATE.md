# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Technicians scan a receipt on their phone and it appears in QuickBooks Online as a properly categorized expense with the receipt image attached — no manual QBO data entry by the CFO.
**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-17 — Completed 01-01-PLAN.md (CLI init + migrations)

Progress: [█░░░░░░░░░] ~6% (1/18 plans estimated)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 3min
- Total execution time: 3min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1/3 | 3min | 3min |

**Recent Trend:**
- Last 5 plans: 01-01 (3min)
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Setup]: Supabase Edge Functions with Hono routing (single fat function) for all QBO server-side operations
- [Setup]: Supabase Vault for encrypted token storage (service_role only, never in frontend)
- [Setup]: Entity resolution by name, not hardcoded IDs (prevents sandbox-to-production mismatch)
- [Setup]: minorversion=75 required on all QBO API calls (mandatory as of August 2025)
- [Setup]: RequestID (UUID v4) per transaction for idempotency on retry
- [01-01]: update_vault_secret provisioned in Phase 1 for Phase 2 use; no Phase 1 caller expected
- [01-01]: SECURITY DEFINER Vault wrapper functions (create/read/update) created in public schema for Edge Function .rpc() access

### Pending Todos

- **REQUIRED before 01-02/01-03:** User must authenticate Supabase CLI and push migrations:
  1. `npx supabase login` (opens browser)
  2. `npx supabase link --project-ref <YOUR_PROJECT_REF>` (ref = subdomain of Supabase URL)
  3. `npx supabase db push` (applies both migrations to hosted database)

### Blockers/Concerns

- [Phase 1 - ACTIVE]: Supabase CLI auth gate — `supabase link` and `supabase db push` require user to run `npx supabase login` interactively. Migration files are ready but NOT yet applied to database.
- [Phase 1]: Race-condition-safe token refresh requires Supabase `SELECT FOR UPDATE` locking — verify transaction syntax during Phase 2 build
- [Phase 3]: Fuzzy vendor matching threshold needs testing against BMB's actual vendor list
- [Phase 4]: QBO Purchase entity JSON structure for single-line receipts needs sandbox verification
- [Phase 5]: Deno FormData compatibility with QBO Attachable API multipart upload needs sandbox testing

## Session Continuity

Last session: 2026-02-17T14:49:57Z
Stopped at: Completed 01-01-PLAN.md — CLI init, Edge Function scaffold, migration files created
Resume file: None
