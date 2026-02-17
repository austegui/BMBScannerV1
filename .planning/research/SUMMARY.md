# Project Research Summary

**Project:** BMB QBO Receipt-to-Expense Integration
**Domain:** QuickBooks Online Integration (Receipt Scanner to Accounting System)
**Researched:** 2026-02-16
**Confidence:** HIGH

## Executive Summary

This project integrates QuickBooks Online into an existing React + Supabase receipt scanner PWA, allowing small teams (2-5 technicians) to automatically sync scanned receipts to QuickBooks as Purchase transactions. Research reveals this is a mature domain with established patterns, but successful implementations require careful attention to OAuth token management, entity synchronization, and rate limiting.

The recommended approach uses **Supabase Edge Functions** (Deno runtime) as a minimal backend layer with native `fetch` API and `jose` for OAuth, avoiding heavy Node.js dependencies like `node-quickbooks` or `intuit-oauth`. The architecture follows a "fat function with Hono routing" pattern to minimize cold starts, stores OAuth tokens in Supabase Vault with transparent encryption, and tracks sync state using columns in the existing expenses table. Critical implementation path: OAuth setup → token management → Purchase entity creation → attachment upload.

The highest risks are **refresh token race conditions** (causing integration breakage requiring re-authentication), **5-year token expiration** (February 2027 deadline for tokens issued in 2022), and **sandbox-to-production entity ID mismatches** (causing data corruption). Mitigation requires atomic token storage with database locking, proactive expiration monitoring with user notifications, and entity resolution by name rather than cached IDs.

## Key Findings

### Recommended Stack

QuickBooks Online API v3 has no official Deno SDK, but the REST API is straightforward to integrate using web-standard APIs. Research strongly recommends building a custom OAuth + API client using Deno/web standards rather than adapting Node.js packages that create compatibility friction in Supabase Edge Functions.

**Core technologies:**
- **Native `fetch` (built-in)**: HTTP client for QBO API calls — Deno has native web-standard fetch, no library needed
- **`jose` (npm:jose@^5.9.6)**: JWT verification for OAuth tokens — zero dependencies, designed for Deno/web runtimes
- **Supabase Vault**: Encrypted token storage — purpose-built for secrets, transparent encryption, service_role-only access
- **Hono routing framework**: Internal Edge Function routing — consolidates endpoints into single function, reduces cold starts

**Key decision:** Do NOT use `node-quickbooks` (15+ dependencies, Node.js filesystem patterns) or `intuit-oauth` (7 Node.js dependencies including axios, csrf middleware). These add unnecessary complexity and compatibility issues. The QBO REST API is simple enough that custom implementation is cleaner and more maintainable.

**Critical version requirement:** Minor version 75 is **required as of August 1, 2025** (versions 1-74 deprecated). All API requests must include `minorversion=75` query parameter.

### Expected Features

The QBO receipt/expense integration market is mature with established players (Dext, Hubdoc, Expensify, Shoeboxed) defining clear feature expectations. For small teams, focus on **automation without complexity** — eliminate manual entry while avoiding enterprise-grade approval workflows.

**Must have (table stakes):**
- Receipt image capture (mobile photo + email + drag-drop) — users expect this
- OCR data extraction (vendor, date, amount, tax with 95%+ accuracy) — manual entry defeats the purpose
- Receipt image attachment to QBO transaction — QBO supports this, users expect it
- Vendor mapping (OCR vendor name to QBO vendor list) — required by QBO Purchase entity
- Expense account selection from synced Chart of Accounts — required by QBO
- Payment account selection (credit card accounts) — track which card was used
- Create QBO Purchase transaction (not Bill) — credit card purchases are paid at time of purchase
- Local data storage (Supabase) — dual flow: save locally + optionally push to QBO
- Basic error handling with retry logic — API calls fail sometimes

**Should have (competitive):**
- Class tracking — BMB's current workflow uses Class field for job tracking
- Memo and Reference Number fields — BMB tracks cardholder initials + notes
- Duplicate detection (hash-based + fuzzy match) — prevent same receipt from being pushed twice
- Vendor auto-detection (fuzzy match + learning) — suggest vendor based on OCR + history
- Smart categorization (remember vendor→account patterns) — reduces clicks for repeat vendors
- Immediate vs batch push toggle — user controls when to sync to QBO
- Audit trail (who scanned, when pushed, edit history) — accountability for small team

**Defer (v2+):**
- Bank transaction auto-matching — HIGH complexity, marginal value for small team (let Adam manually match in QBO)
- Multi-receipt per transaction (line-item splitting) — rare use case, UI complexity high
- Tax jurisdiction handling — single location business, not needed
- Multi-level approval workflows — overkill for 2-5 person team, trust-based model instead
- Spend analytics dashboard — QBO already provides reporting, avoid duplication

### Architecture Approach

The architecture integrates QBO into a serverless React + Supabase receipt scanner by adding Supabase Edge Functions (Deno runtime) as a minimal backend layer. The core challenge is adding OAuth 2.0 server-side token management and QBO API calls to a frontend-only architecture.

**Major components:**
1. **Frontend (React 19 + Vite 7 PWA)** — Receipt capture, OCR integration, expense review UI, Supabase client for database operations. Never calls QBO API directly, never sees OAuth tokens.
2. **Supabase Edge Functions (single "fat function" with Hono routing)** — OAuth handler (start flow, handle callback, exchange code for tokens), Token manager (proactive refresh, Vault storage), Purchase service (create QBO Purchase entities), Attachment service (upload receipt images as Attachables), Account/Vendor services (sync entities). Only component that calls QBO API and reads tokens.
3. **Supabase Database** — Extends existing `expenses` table with sync columns (`qbo_pushed_at`, `qbo_purchase_id`, `qbo_error`, `qbo_sync_attempts`), new `qbo_connection` table (single-tenant model with `realm_id`, `token_vault_id`, `token_expires_at`), Vault extension (`vault.secrets`) for encrypted token storage with service_role-only access.
4. **Supabase Storage** — Private `receipts` bucket for receipt images. Frontend uploads directly (authenticated), Edge Functions fetch via signed URLs (time-limited), QBO receives as base64/multipart.

**Key architectural decisions:**
- Single Edge Function with Hono routing (not multiple small functions) → reduces cold starts per Supabase recommendation
- Supabase Vault for token storage (not environment variables) → transparent encryption, purpose-built for secrets
- Sync state in `expenses` table (not separate sync_status table) → simpler queries, clear RLS ownership, avoids JOINs
- Proactive token refresh 5 minutes before expiry (not on-demand when expired) → avoids API failures, better UX
- Signed URLs for image access (not upload from frontend to Edge Function) → reduces payload size (10MB → <1KB)

### Critical Pitfalls

Research identified 16 pitfalls across critical/moderate/minor severity. Top 5 highest-impact issues:

1. **Refresh Token Race Conditions** — Multiple concurrent API requests trigger simultaneous token refreshes, causing one process to overwrite another's refresh token. QBO invalidates old tokens immediately, breaking integration until re-authentication. **Prevention:** Implement single-flight token refresh with database-level locking (`SELECT FOR UPDATE`), store both access AND refresh tokens atomically in single transaction, validate stored token before refresh.

2. **Refresh Token 5-Year Expiration (February 2027 Deadline)** — QBO changed policy in 2025: all refresh tokens have 5-year maximum validity. Tokens issued in February 2022 expire February 2027 (12 months from now). Integration breaks silently when tokens expire. **Prevention:** Store token issue date, calculate expiration (issue_date + 5 years), warn users 90 days before expiration, implement "Reconnect URL" field (mandatory Jan 2026), proactively prompt re-authentication.

3. **Sandbox-to-Production Entity ID Mismatch** — Application caches entity IDs (Account, Vendor, Class) during sandbox testing. Production environment has completely different IDs. Expenses posted to wrong accounts, API calls fail with "entity not found". **Prevention:** Never hardcode entity IDs, store mappings by (company_id, entity_type, entity_name), fetch fresh entities on production connection, implement entity resolution by name not ID, require user account mapping during onboarding.

4. **API Rate Limiting Without Backoff** — Exceeds 500 req/min per company or 10 concurrent requests during bulk operations. API returns HTTP 429, receipts fail to sync silently. **Prevention:** Implement token bucket rate limiter tracking requests per company (Redis/Supabase cache with TTL 60s), exponential backoff on 429 (wait 1s, 2s, 4s, 8s), queue receipt processing instead of parallel execution, use QBO Batch API for 30 operations per request.

5. **Missing RequestID Causing Duplicates** — Network timeout after QBO creates Purchase but before app receives response. App retries, creating duplicate expense. **Prevention:** Generate unique RequestID (UUID v4) for each transaction, pass as query parameter `?requestId=uuid&minorversion=75`, reuse same RequestID on retry (QBO returns original response instead of creating duplicate), store RequestID in database for audit trail.

## Implications for Roadmap

Based on research, suggested phase structure prioritizes OAuth foundation, then core API integration, then polish features. Dependency order: authentication → token management → entity sync → transaction creation → attachment upload → error handling → optimization.

### Phase 1: Database Foundation & OAuth Setup (Day 1-5)
**Rationale:** OAuth authentication is prerequisite for all QBO API calls. Database schema must exist before Edge Functions can store tokens. OAuth is well-documented but requires careful implementation to avoid race conditions (Pitfall 1) and token expiration tracking (Pitfall 2).

**Delivers:**
- Extended `expenses` table with QBO sync columns (`qbo_pushed_at`, `qbo_purchase_id`, `qbo_error`, `qbo_sync_attempts`)
- New `qbo_connection` table (single-tenant model)
- Supabase Vault extension enabled with helper functions (`store_qbo_token`, `get_qbo_token`)
- RLS policies (service_role-only access to tokens)
- Edge Function scaffold with Hono routing and middleware (CORS, auth, error handling)
- OAuth flow endpoints (`/auth/start`, `/auth/callback`)
- Token storage in Vault with issue date tracking
- Frontend "Connect to QuickBooks" button

**Addresses features:**
- QBO authentication and connection (table stakes)
- Token security (store encrypted, never expose to frontend)

**Avoids pitfalls:**
- Pitfall 1: Refresh token race conditions → implement atomic token storage from start
- Pitfall 2: 5-year token expiration → store issue_date for future monitoring
- Pitfall 16: Client secret exposure → use Supabase secrets, never hardcode

**Research flag:** MEDIUM — OAuth flow is well-documented, but implementing race-condition-safe token refresh with Supabase transactions needs verification during build.

### Phase 2: Token Management & Connection Status (Day 5-6)
**Rationale:** Automatic token refresh is required before making any QBO API calls. Must handle QBO's 1-hour access token expiry and refresh token rotation (both tokens change on refresh).

**Delivers:**
- `getValidAccessToken()` helper with proactive 5-minute refresh window
- Token refresh logic handling refresh token rotation (store BOTH new tokens)
- `/connection/status` endpoint (frontend checks if connected)
- `/connection/disconnect` endpoint (revoke tokens, clear database)
- Token refresh failure handling (mark connection inactive, prompt re-auth)
- Error logging for debugging

**Addresses features:**
- Automatic token refresh (transparent to user)
- Connection status visibility

**Avoids pitfalls:**
- Pitfall 1: Race conditions → single-flight refresh with database lock
- Pitfall 15: Authentication propagation delays → wait 1-2s after refresh before API call

**Research flag:** LOW — Standard OAuth pattern, well-documented in QBO docs.

### Phase 3: Entity Synchronization (Accounts, Vendors, Classes) (Day 6-8)
**Rationale:** QBO Purchase creation requires valid Account IDs, Vendor IDs, and optionally Class IDs from the company's Chart of Accounts. Must fetch and cache these entities before creating transactions. Entity resolution by name (not hardcoded IDs) prevents sandbox-to-production mismatch (Pitfall 3).

**Delivers:**
- Account Service (fetch QBO Chart of Accounts via query API)
- Vendor Service (fetch QBO vendor list, find by name with fuzzy match)
- Class Service (fetch QBO classes for job tracking)
- Entity caching in Supabase (prevent repeated API calls)
- Category-to-account mapping UI during onboarding
- Periodic entity refresh (daily sync, invalidate after 24 hours)
- Entity resolution by name fallback (when ID not found)

**Addresses features:**
- Expense account selection from synced Chart of Accounts (table stakes)
- Vendor mapping with auto-detection (competitive)
- Class tracking for BMB workflow (competitive)

**Avoids pitfalls:**
- Pitfall 3: Sandbox-to-prod ID mismatch → resolve by name, never hardcode IDs
- Pitfall 11: Missing AccountRef → require account mapping before first sync
- Pitfall 13: Entity ID instability → periodic refresh, name-based fallback

**Research flag:** MEDIUM — QBO query syntax is documented, but designing robust entity resolution system (fuzzy matching, learning patterns) needs phase-specific research.

### Phase 4: Purchase Entity Creation (Day 8-10)
**Rationale:** Core feature — push expenses to QuickBooks as Purchase transactions. Depends on OAuth (Phase 1-2) and entity sync (Phase 3). Must implement idempotency with RequestID (Pitfall 5) and rate limiting (Pitfall 4) from start.

**Delivers:**
- Purchase Service (create QBO Purchase entity from expense data)
- `/purchase/create` endpoint with idempotent RequestID
- Update `expenses` table on success (set `qbo_purchase_id`, `qbo_pushed_at`)
- QBO API error handling (store in `qbo_error` column)
- Retry logic with exponential backoff for rate limits (429 errors)
- Rate limiter (token bucket, 500 req/min per company)
- Frontend "Push to QBO" UI with sync status badges
- Batch queue for selecting multiple receipts
- Memo and Reference Number field support

**Addresses features:**
- Create QBO Expense transaction (table stakes)
- Memo and Reference Number fields (competitive — BMB workflow)
- Batch push toggle (competitive)
- Basic error handling (table stakes)

**Avoids pitfalls:**
- Pitfall 4: Rate limiting → implement token bucket before first API call
- Pitfall 5: Missing RequestID → generate UUID for every request
- Pitfall 6: Minor version compatibility → explicitly use minorversion=75
- Pitfall 7: Edge Function timeouts → design async queue for bulk operations
- Pitfall 10: Misleading error messages → comprehensive logging and retry logic
- Pitfall 11: Missing AccountRef → validate account mapping before creation

**Research flag:** HIGH — QBO Purchase entity has multiple line types (AccountBasedExpenseLineDetail vs ItemBasedExpenseLineDetail), tax handling varies, need to verify exact schema for BMB's use case.

### Phase 5: Attachment Upload (Day 10-12)
**Rationale:** Attachments depend on Purchase entity existing (created in Phase 4). QBO Attachable API has two-step process (upload file → link to entity). Must handle large images with compression (Pitfall 8).

**Delivers:**
- Attachment Service (two-step QBO upload: multipart/form-data → link Attachable)
- Signed URL generation for Supabase Storage access
- Image fetch from Storage via signed URL
- `/attachment/upload` endpoint
- Image compression (target < 2MB for receipts, avoid memory limits)
- Link Attachable to Purchase entity
- Frontend "View in QBO" link (opens QBO web app)
- Support for PNG, JPG, PDF formats

**Addresses features:**
- Receipt image attachment to QBO transaction (table stakes)

**Avoids pitfalls:**
- Pitfall 7: Edge Function timeouts → implement attachment upload as separate async job (not in critical path)
- Pitfall 8: File size and memory limits → compress images, stream from storage, validate < 10MB

**Research flag:** HIGH — QBO Attachable API two-step process needs verification with Deno multipart/form-data handling. File streaming vs buffering in Edge Functions requires testing.

### Phase 6: Error Handling & Audit Trail (Day 12-14)
**Rationale:** Production-readiness requires graceful degradation, comprehensive error handling, and user-friendly retry mechanisms. Audit trail provides accountability for small team.

**Delivers:**
- Comprehensive error handling for QBO API responses (map error codes to user messages)
- Exponential backoff refinement (1s, 2s, 4s, 8s delays)
- Track `qbo_sync_attempts` to prevent infinite retries (max 3 attempts)
- Frontend "Retry" UI for failed syncs
- User-friendly error messages (avoid raw API errors)
- Structured logging (JSON logs with context)
- Audit trail logging (receipt scanned, OCR extraction, user edits, QBO push attempts, errors)
- Audit trail UI (Activity Log in receipt detail view, Sync History dashboard)

**Addresses features:**
- Audit trail (who scanned, when pushed, edit history) — competitive
- Advanced error recovery — table stakes for production

**Avoids pitfalls:**
- Pitfall 10: Misleading error messages → build error pattern library, check QBO status on Error 6000
- Pitfall 15: Authentication propagation delays → retry Error 3200 with backoff

**Research flag:** LOW — Standard error handling patterns, QBO error codes documented.

### Phase 7: Performance Optimization & Smart Features (Day 14-16)
**Rationale:** Optimize after core functionality working. Add competitive features that differentiate from basic integrations.

**Delivers:**
- Cache QBO account list (1-hour TTL, reduce API calls)
- Compress images before upload (target < 2MB)
- Bulk sync throttling (respect 500 req/min limit)
- Edge Function cold start optimization (bundle size reduction, keep-alive pings)
- Database query optimization (add indexes if needed)
- Duplicate detection (hash-based for same image + fuzzy match for vendor+amount+date)
- Vendor auto-detection (fuzzy match OCR to QBO vendor list)
- Smart categorization (learn vendor→account patterns, suggest on future receipts)
- Performance monitoring (track cold start times, API latencies)

**Addresses features:**
- Duplicate detection (competitive)
- Vendor auto-detection (competitive)
- Smart categorization (competitive)

**Avoids pitfalls:**
- Pitfall 14: Cold start latency → optimize bundle size, implement warm-up pings

**Research flag:** MEDIUM — Optimization techniques are standard, but determining optimal batch sizes and cache TTLs requires testing with realistic data.

### Phase 8: Production Migration & Monitoring (Day 16-18)
**Rationale:** Transition from sandbox to production requires careful environment switching, production keys approval timeline (6+ weeks), and ongoing monitoring.

**Delivers:**
- Submit App Assessment Questionnaire (target 6+ weeks before launch)
- Environment switcher (sandbox vs production base URL)
- Clear all cached entity IDs when switching environments
- Re-fetch Chart of Accounts, Vendors, Classes in production
- Production OAuth credentials configuration
- Token expiration monitoring dashboard (alert 90 days before 5-year limit)
- QBO connection health checks (daily status verification)
- Error rate monitoring (alert if < 95% success rate)
- Performance metrics (p95/p99 latency, cold start frequency)

**Addresses features:**
- Production readiness (switch from sandbox to live QBO accounts)
- Ongoing monitoring and alerting

**Avoids pitfalls:**
- Pitfall 2: 5-year token expiration → implement monitoring now, alert before Feb 2027
- Pitfall 3: Sandbox-to-prod ID mismatch → clear cached IDs, re-fetch entities
- Pitfall 9: Production keys approval delays → submit questionnaire early with 6-week buffer

**Research flag:** LOW — Standard production migration and monitoring practices.

### Phase Ordering Rationale

**Dependency-driven sequencing:**
- OAuth (Phase 1) must come first → all API calls require authentication
- Token management (Phase 2) must precede API integration → prevents mid-call token expiry
- Entity sync (Phase 3) must precede transaction creation (Phase 4) → Purchase requires valid Account/Vendor IDs
- Attachment upload (Phase 5) must follow transaction creation (Phase 4) → Attachable links to Purchase entity
- Error handling (Phase 6) builds on working integration (Phases 1-5) → need production errors to refine
- Optimization (Phase 7) comes after core features (Phases 1-6) → avoid premature optimization
- Production migration (Phase 8) is final → requires completed, tested integration

**Pitfall mitigation built into each phase:**
- Phases 1-2 address authentication pitfalls (race conditions, token expiration, secret exposure)
- Phase 3 addresses entity ID pitfalls (sandbox-to-prod mismatch, ID instability)
- Phase 4 addresses transaction creation pitfalls (rate limiting, RequestID duplicates, missing AccountRef)
- Phase 5 addresses attachment pitfalls (file size limits, memory constraints, timeout risks)
- Phase 6 addresses error handling pitfalls (misleading messages, authentication propagation)
- Phase 7 addresses performance pitfalls (cold starts, bulk operation timeouts)
- Phase 8 addresses production readiness pitfalls (approval delays, environment switching)

**Grouping rationale:**
- OAuth + Token Management (Phases 1-2): Foundation layer, cannot proceed without working authentication
- Entity Sync + Transaction Creation (Phases 3-4): Core integration, delivers MVP value
- Attachment Upload (Phase 5): Enhances core integration, can ship MVP without if needed
- Error Handling + Optimization (Phases 6-7): Polish for production reliability
- Production Migration (Phase 8): Final deployment preparation

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1 (OAuth Setup):** Race-condition-safe token refresh with Supabase database locking — verify transaction patterns in Supabase Postgres, test concurrent token refresh scenarios
- **Phase 3 (Entity Sync):** Fuzzy vendor matching algorithms and learning patterns — research Levenshtein distance libraries in Deno, design vendor→account pattern storage
- **Phase 4 (Purchase Creation):** QBO Purchase entity line item structure — verify AccountBasedExpenseLineDetail vs ItemBasedExpenseLineDetail for simple receipts, confirm tax handling approach
- **Phase 5 (Attachment Upload):** Deno multipart/form-data handling for QBO Attachable API — test Deno's native FormData with QBO upload endpoint, verify streaming vs buffering approach

**Phases with standard patterns (skip research-phase):**
- **Phase 2 (Token Management):** Standard OAuth refresh flow, well-documented in QBO and Supabase docs
- **Phase 6 (Error Handling):** Standard retry patterns, QBO error codes documented
- **Phase 7 (Performance Optimization):** Standard optimization techniques (caching, compression, throttling)
- **Phase 8 (Production Migration):** Standard deployment and monitoring practices

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified with official Deno, Supabase, and Intuit documentation (Feb 2026). Native `fetch` and `jose` approach confirmed in Supabase Edge Functions docs. |
| Features | MEDIUM | Competitive analysis based on WebSearch with official product pages (Dext, Hubdoc, Expensify, Shoeboxed). Table stakes features confirmed across multiple sources. Anti-features validated for small team context. |
| Architecture | MEDIUM | Supabase Edge Functions "fat function" pattern confirmed in official docs. Vault encryption approach verified. Data flow patterns based on official QBO API reference, but real-world race condition handling needs testing. |
| Pitfalls | HIGH | Critical pitfalls (token race conditions, 5-year expiration, rate limiting, RequestID) verified with authoritative sources (Intuit blogs, Nango, official API docs). Moderate/minor pitfalls based on community reports and support forums. |

**Overall confidence:** HIGH

Research comprehensively covers OAuth implementation, API integration patterns, and common failure modes. Stack decisions backed by official documentation. Feature expectations validated against established competitors. Architecture follows Supabase best practices. Pitfalls sourced from official Intuit communications and experienced integration developers.

### Gaps to Address

**During Phase 1-2 (OAuth Setup):**
- **Gap:** Exact Supabase Postgres transaction syntax for atomic token storage with `SELECT FOR UPDATE` locking
- **Handle:** Research Supabase transaction patterns, test concurrent Edge Function invocations, validate locking behavior prevents race conditions

**During Phase 3 (Entity Sync):**
- **Gap:** Optimal fuzzy matching threshold for vendor name resolution (e.g., "HOME DEPOT" vs "The Home Depot, Inc.")
- **Handle:** Test Levenshtein distance libraries in Deno, experiment with thresholds using BMB's actual vendor list

**During Phase 4 (Purchase Creation):**
- **Gap:** Exact QBO Purchase entity JSON structure for BMB's simple receipts (single line item, no itemization)
- **Handle:** Test Purchase creation in sandbox with various AccountBasedExpenseLineDetail configurations, validate tax handling approach

**During Phase 5 (Attachment Upload):**
- **Gap:** Deno's native FormData behavior with QBO multipart/form-data upload endpoint
- **Handle:** Test Attachable upload in sandbox, verify Deno FormData compatibility, determine if custom binary handling needed

**During Phase 6-7 (Error Handling & Optimization):**
- **Gap:** Real-world QBO error patterns (Error 6000 frequency, rate limit 429 thresholds)
- **Handle:** Collect production error logs, build error pattern library based on actual failures, refine retry strategies

**Post-MVP (Future Enhancement):**
- **Gap:** QBO webhook setup for real-time sync status (e.g., if user edits Purchase in QBO)
- **Handle:** Evaluate webhooks during post-MVP planning, determine if needed for BMB's workflow (likely not critical for small team)

## Sources

### Primary (HIGH confidence)

**QuickBooks Online OAuth & API:**
- [QuickBooks Online API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/purchase) — Purchase entity structure, Attachable API, query syntax
- [QuickBooks OAuth 2.0 Docs](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0) — Official OAuth flow, token refresh, scope requirements
- [QuickBooks Minor Versions](https://developer.intuit.com/app/developer/qbo/docs/learn/explore-the-quickbooks-online-api/minor-versions) — Minor version 75 requirement (Aug 2025 deprecation)
- [Important changes to refresh token policy - Intuit Blog](https://blogs.intuit.com/2025/11/12/important-changes-to-refresh-token-policy/) — 5-year token expiration policy
- [API call limits and throttling - Intuit Help](https://help.developer.intuit.com/s/article/API-call-limits-and-throttling) — 500 req/min, 10 concurrent limit
- [Request ID update for QuickBooks Online - Intuit Blog](https://blogs.intuit.com/2015/04/06/15346/) — RequestID for idempotency

**Supabase Edge Functions:**
- [Edge Functions Architecture | Supabase Docs](https://supabase.com/docs/guides/functions/architecture) — Fat function pattern, cold start optimization
- [Handling Routing in Functions | Supabase Docs](https://supabase.com/docs/guides/functions/routing?queryGroups=framework&framework=hono) — Hono framework integration
- [Supabase Edge Function Limits](https://supabase.com/docs/guides/functions/limits) — 150s timeout, 150MB memory, 2s CPU
- [Supabase Vault](https://supabase.com/docs/guides/database/vault) — Transparent column encryption, service_role access

**Deno Runtime:**
- [Deno Node/npm Compatibility](https://docs.deno.com/runtime/fundamentals/node/) — npm: specifier support, compatibility caveats
- [jose Library GitHub](https://github.com/panva/jose) — Zero dependencies, Deno support confirmed

### Secondary (MEDIUM confidence)

**Competitive Analysis:**
- [Dext for QuickBooks](https://dext.com/us/business/product/integrate-with-accounting-software/quickbooks) — Feature set for established competitor
- [Hubdoc Integration with QuickBooks](https://www.dancingnumbers.com/hubdoc-quickbooks-integration/) — Supplier Rules, auto-match features
- [Expensify + QuickBooks Integration](https://use.expensify.com/all-integrations/quickbooks) — Real-time sync, approval workflows
- [Shoeboxed QuickBooks Integration](https://quickbooks.intuit.com/app/apps/appdetails/shoeboxed/en-us/) — Simple receipt scan workflow

**Integration Patterns:**
- [QuickBooks Online API Integration Guide](https://www.getknit.dev/blog/quickbooks-online-api-integration-guide-in-depth) — Community guide with examples
- [QuickBooks OAuth Tutorial](https://stateful.com/blog/quickbooks-oauth) — Step-by-step OAuth implementation
- [Supabase Vault: Store Secrets Securely](https://makerkit.dev/blog/tutorials/supabase-vault) — Vault implementation guide

**Pitfall Sources:**
- [QuickBooks OAuth refresh token invalid_grant - Nango Blog](https://nango.dev/blog/quickbooks-oauth-refresh-token-invalid-grant) — Token race condition documentation
- [Refresh Token Race Condition - Apideck](https://developers.apideck.com/guides/refresh-token-race-condition) — OAuth race condition patterns
- [A guide to using sandbox environments - Intuit Blog](https://blogs.intuit.com/2024/11/27/a-guide-to-using-sandbox-environments-for-quickbooks-integrations/) — Sandbox vs production entity IDs
- [How Long Does Intuit App Store Approval Take? - Satva Solutions](https://satvasolutions.com/blog/intuit-app-store-approval-timeline-developer-guide) — 2-8 week approval timeline

### Tertiary (LOW confidence)

**Error Handling:**
- [QuickBooks Online Error messages - Erplain](https://support.erplain.com/en/support/solutions/articles/77000434315-quickbooks-online-error-messages) — Error code mapping (community resource, needs validation)
- [QuickBooks Audit Trail Guide](https://www.webgility.com/blog/quickbooks-audit-trail) — Audit trail patterns (general guide, not QBO-specific)

**Performance:**
- [Supabase Edge Functions Troubleshooting](https://supabase.com/docs/guides/functions/troubleshooting) — Cold start behavior (general guidance)
- [Supabase Edge Functions EF005: Memory Limit Exceeded](https://drdroid.io/stack-diagnosis/supabase-edge-functions-ef005--memory-limit-exceeded) — Memory error patterns (community diagnosis)

---
*Research completed: 2026-02-16*
*Ready for roadmap: yes*
