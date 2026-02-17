# Phase 1: Foundation - Context

**Gathered:** 2026-02-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Database schema (expenses sync columns, qbo_connection table), Supabase Edge Function scaffold with Hono routing, and OAuth flow so the admin can connect BMB's single QBO company account. No QBO API calls beyond OAuth token exchange. Token refresh, entity sync, and purchase creation are later phases.

</domain>

<decisions>
## Implementation Decisions

### OAuth Experience
- "Connect to QuickBooks" button integrated into the existing app UI (not a standalone admin page)
- Admin role only — technicians should not see connection controls
- After successful OAuth, show a green "Connected to QuickBooks" status badge with company name, replacing the connect button
- No disconnect button needed in Phase 1 — keep it simple

### Edge Function Structure
- Frontend authenticates to Edge Function via Supabase JWT (user's auth token verified server-side)
- Console logging for debugging QBO API calls — viewable in Supabase Edge Function logs dashboard
- Log requests/responses to console, not to a database table

### Schema Design
- Sync status uses basic statuses: `not_sent`, `sent`, `failed`
- Researcher must inspect the existing expenses table schema before planning the migration — unknown whether existing rows need safe column additions or table is fresh
- Existing `expenses` table state is unknown — migration strategy depends on research findings

### Deployment & Environment
- QBO sandbox first for development, switch to production when ready
- QBO Client ID and Client Secret stored as Supabase Edge Function secrets (`supabase secrets set`) — accessed via `Deno.env` in Edge Functions
- Separate Supabase projects for dev and production — full isolation
- This is the first Edge Function — no deployment process exists yet, will use CLI (`supabase functions deploy`) initially

### Claude's Discretion
- Error response JSON format from Edge Function
- Route naming convention (namespaced vs flat paths)
- Soft delete vs hard delete on qbo_connection disconnect
- Whether to use a dedicated `qbo_sync_status` column or derive status from existing QBO columns (`qbo_purchase_id`, `qbo_error`, `qbo_pushed_at`)

</decisions>

<specifics>
## Specific Ideas

- Single-company setup for BMB — no multi-tenant considerations needed
- OAuth is a one-time admin action, not a frequent user flow
- Design should make sandbox-to-production switch a matter of changing Edge Function secrets, not code changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-16*
