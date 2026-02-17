---
phase: 01-foundation
plan: 01-02
subsystem: api
tags: [hono, deno, edge-functions, jwt, cors, supabase, jose, quickbooks]

requires:
  - phase: 01-01
    provides: Edge Function scaffold at supabase/functions/qbo-api/index.ts
provides:
  - Hono-based Edge Function with CORS, JWT auth middleware, request logging
  - qboFetch() helper enforcing minorversion=75 on all QBO API calls
  - getServiceClient() cached Supabase service role client
  - GET /health route with JSON response
  - JSON error handler (never HTML)
  - Placeholder comments marking where Plan 01-03 adds OAuth routes
affects:
  - 01-03: OAuth route handlers plug into this Hono app scaffold
  - Phase 2: JWT exclusion list must remove /auth/start and /connection/status
  - All future phases: qboFetch() is the entry point for every QBO API call

tech-stack:
  added: [jsr:@hono/hono, jsr:@hono/hono/cors, npm:jose@^5, npm:@supabase/supabase-js@2]
  patterns:
    - "Hono basePath('/qbo-api') matching Edge Function directory name to prevent 404s"
    - "Middleware order: CORS -> JWT auth (with exclusions) -> logging"
    - "Jose JWKS remote key set for Supabase JWT verification"
    - "Cached service client pattern (singleton via module-level variable)"
    - "minorversion=75 appended as query param to every QBO fetch URL"

key-files:
  created: []
  modified:
    - supabase/functions/qbo-api/index.ts

key-decisions:
  - "JSR import path jsr:@hono/hono (NOT deno.land/x/hono — that is old and deprecated)"
  - "cors subpath import from jsr:@hono/hono/cors (NOT /middleware)"
  - "/auth/callback permanently excluded from JWT (browser redirect, no header possible)"
  - "/auth/start and /connection/status temporarily excluded Phase 1 (no Supabase Auth yet)"
  - "TODO(Phase 2) comment placed on exclusion list for re-locking"
  - "QBO_FRONTEND_URL env var drives production CORS origin"
  - "DENO_ENV=production toggles between detailed and generic error messages"

patterns-established:
  - "qboFetch: all QBO API calls go through this helper — never raw fetch()"
  - "getServiceClient: singleton pattern for service-role Supabase client"
  - "Hono c.set('jwtPayload', payload) to pass auth context to route handlers"

duration: 1min
completed: 2026-02-17
---

# Phase 1 Plan 02: Edge Function Scaffold Summary

**Hono Edge Function with CORS, jose JWT verification, minorversion=75 qboFetch helper, and JSON-only error handling — ready for OAuth route handlers in Plan 01-03.**

## Performance

- **Duration:** ~1 minute
- **Started:** 2026-02-17T14:52:47Z
- **Completed:** 2026-02-17T14:53:59Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Complete Hono Edge Function scaffold replacing the Plan 01-01 placeholder
- JWT auth middleware via `jose.jwtVerify()` against Supabase JWKS endpoint, with explicit exclusions for OAuth paths
- `qboFetch()` helper that mandatorily appends `minorversion=75` to every QBO API call
- JSON-only error responses via `app.onError()` and `app.notFound()` — Hono's default HTML replaced
- Health check, request logging, cached service client, and Plan 01-03 placeholder comments

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Hono Edge Function with middleware stack** - `daa50c0` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/functions/qbo-api/index.ts` - Complete Hono Edge Function (191 lines): CORS, JWT auth middleware, request logging, getServiceClient(), qboFetch(), GET /health, onError(), notFound(), Deno.serve()

## Decisions Made

- **JSR import paths:** Used `jsr:@hono/hono` and `jsr:@hono/hono/cors` per plan requirement. The old `deno.land/x/hono` path would fail on modern Deno/Supabase runtime.
- **JWT exclusion list (3 paths):** `/auth/callback` is permanently excluded (browser redirect cannot send Authorization header). `/auth/start` and `/connection/status` are temporarily excluded because Phase 1 has no Supabase Auth — the frontend sends the anon key, not a user JWT. A `TODO(Phase 2)` comment marks them for re-locking.
- **CORS origin function:** Used the callback form of `origin` rather than an array to properly reflect the requesting origin back (matching behavior, not wildcard).
- **qboFetch separator logic:** Checks if path already contains `?` before appending `minorversion=75` to handle paths that already have query params.
- **Error message in production:** `DENO_ENV !== 'production'` exposes the actual error message in dev; production returns generic message to avoid leaking internals.
- **Exported helpers:** `getServiceClient` and `qboFetch` exported so Plan 01-03 route handlers can import them without re-implementing.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this plan. The function uses env vars (`QBO_FRONTEND_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `QBO_BASE_URL`) that are already configured in Supabase's Edge Function environment when the project is linked.

## Next Phase Readiness

- **Plan 01-03 (OAuth flow):** READY — Hono app instance accepts new route handlers; `getServiceClient()` and `qboFetch()` are exported; placeholder comments mark exact insertion points for `/auth/start`, `/auth/callback`, and `/connection/status` routes.
- **Supabase CLI link + db push:** Still pending user auth gate from Plan 01-01. OAuth routes cannot be end-to-end tested until database migrations are applied.
- **minorversion=75 enforcement:** All future QBO API calls that use `qboFetch()` automatically get the mandatory query parameter — no per-call discipline required.

---
*Phase: 01-foundation*
*Completed: 2026-02-17*
