# Requirements: BMB QBO Receipt Scanner

**Defined:** 2026-02-16
**Core Value:** Technicians scan a receipt on their phone and it appears in QuickBooks Online as a properly categorized expense — no manual QBO data entry.

## v1 Requirements

### Authentication (Transparent)

- [ ] **AUTH-01**: App connects to QBO via OAuth 2.0 (one-time admin setup, not user-facing)
- [ ] **AUTH-02**: Access tokens refresh automatically every hour (transparent to users)
- [ ] **AUTH-03**: Refresh token rotation handled atomically (race-condition safe with DB locking)
- [ ] **AUTH-04**: Token expiration tracked (5-year limit) with proactive re-auth before expiry

### Entity Sync

- [ ] **SYNC-01**: Chart of Accounts fetched from QBO for expense account dropdown
- [ ] **SYNC-02**: Vendor list fetched from QBO with fuzzy name matching to OCR results
- [ ] **SYNC-03**: QBO Classes fetched for job/department tracking dropdown
- [ ] **SYNC-04**: Credit card accounts fetched from QBO for payment source dropdown
- [ ] **SYNC-05**: Entity cache refreshed periodically (entities resolved by name, not hardcoded IDs)
- [ ] **SYNC-06**: New vendors created in QBO when no match found

### Purchase Creation

- [ ] **PURCH-01**: Expense pushed to QBO as Credit Card Purchase/Charge (Purchase entity, PaymentType=CreditCard)
- [ ] **PURCH-02**: Single expense line with AccountBasedExpenseLineDetail and mapped AccountRef
- [ ] **PURCH-03**: VendorRef mapped from expense vendor to QBO vendor
- [ ] **PURCH-04**: Memo field maps to QBO PrivateNote
- [ ] **PURCH-05**: Cardholder Ref No (technician initials) maps to QBO DocNumber
- [ ] **PURCH-06**: Class tracking on expense line
- [ ] **PURCH-07**: Payment account (credit card) maps to QBO AccountRef on Purchase
- [ ] **PURCH-08**: Receipt image attached to QBO Purchase via Attachable API

### User Workflow

- [ ] **FLOW-01**: Cardholder dropdown (2-5 technicians, configurable initials list)
- [ ] **FLOW-02**: Payment account picker populated from QBO credit card accounts
- [ ] **FLOW-03**: Expense category picker populated from QBO Chart of Accounts
- [ ] **FLOW-04**: Class picker populated from QBO Classes
- [ ] **FLOW-05**: Dual save: save to Supabase locally, optional immediate push to QBO
- [ ] **FLOW-06**: Batch review: list expenses with "Send to QBO" per-expense and bulk action
- [ ] **FLOW-07**: Sync status badge per expense (not sent / sending / sent / failed)

### Reliability

- [ ] **REL-01**: RequestID-based idempotency prevents duplicate QBO entries on retry
- [ ] **REL-02**: Exponential backoff on QBO API failures (1s, 2s, 4s, 8s)
- [ ] **REL-03**: Max 3 retry attempts before marking as failed
- [ ] **REL-04**: Rate limiter respects QBO's 500 req/min limit
- [ ] **REL-05**: Hash-based duplicate detection (same vendor + amount + date)
- [ ] **REL-06**: All QBO API calls routed through Supabase Edge Functions (secrets never in frontend)

### Infrastructure

- [ ] **INFRA-01**: Supabase Edge Function with Hono routing (single fat function)
- [ ] **INFRA-02**: OAuth tokens stored in Supabase Vault (encrypted, service_role only)
- [ ] **INFRA-03**: Expenses table extended with QBO sync columns (qbo_purchase_id, qbo_pushed_at, qbo_error, qbo_sync_attempts)
- [ ] **INFRA-04**: QBO connection table for realm_id and token management
- [ ] **INFRA-05**: All QBO API calls use minorversion=75

## v2 Requirements

### Smart Features

- **SMART-01**: Vendor auto-detection (fuzzy match OCR to QBO vendor list + learning)
- **SMART-02**: Smart categorization (remember vendor-to-account patterns, suggest on future receipts)
- **SMART-03**: Bank transaction auto-matching in QBO

### Monitoring

- **MON-01**: Token expiration dashboard (alert 90 days before 5-year limit)
- **MON-02**: QBO connection health checks (daily status verification)
- **MON-03**: Error rate monitoring (alert if sync success rate < 95%)

### Audit

- **AUDIT-01**: Audit trail (who scanned, when pushed, edit history)
- **AUDIT-02**: Sync history dashboard (activity log)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-tenant / multi-company QBO | Single BMB account only |
| User authentication in app | Technicians don't log in; cardholder dropdown instead |
| QBO Bill creation | All receipts are Credit Card Purchase/Charge per Adam's workflow |
| Editing expenses after push to QBO | One-way push; edits happen in QBO directly |
| Line item breakdown in QBO | Single expense line per receipt matches current workflow |
| Offline mode | Requires connectivity for OCR and QBO API |
| Approval workflows | Overkill for 2-5 person team; trust-based model |
| Tax jurisdiction handling | Single-location business |
| Spend analytics dashboard | QBO already provides reporting |
| Mobile native app | PWA sufficient for this use case |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| SYNC-01 | Phase 3 | Pending |
| SYNC-02 | Phase 3 | Pending |
| SYNC-03 | Phase 3 | Pending |
| SYNC-04 | Phase 3 | Pending |
| SYNC-05 | Phase 3 | Pending |
| SYNC-06 | Phase 3 | Pending |
| PURCH-01 | Phase 4 | Pending |
| PURCH-02 | Phase 4 | Pending |
| PURCH-03 | Phase 4 | Pending |
| PURCH-04 | Phase 4 | Pending |
| PURCH-05 | Phase 4 | Pending |
| PURCH-06 | Phase 4 | Pending |
| PURCH-07 | Phase 4 | Pending |
| PURCH-08 | Phase 5 | Pending |
| FLOW-01 | Phase 4 | Pending |
| FLOW-02 | Phase 4 | Pending |
| FLOW-03 | Phase 3 | Pending |
| FLOW-04 | Phase 3 | Pending |
| FLOW-05 | Phase 4 | Pending |
| FLOW-06 | Phase 6 | Pending |
| FLOW-07 | Phase 6 | Pending |
| REL-01 | Phase 4 | Pending |
| REL-02 | Phase 6 | Pending |
| REL-03 | Phase 6 | Pending |
| REL-04 | Phase 4 | Pending |
| REL-05 | Phase 7 | Pending |
| REL-06 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after initial definition*
