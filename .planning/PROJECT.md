# BMB QBO Receipt Scanner

## What This Is

A mobile-friendly web app that lets BMB Enterprises HVAC technicians photograph receipts, extract expense data via OCR, and push it directly into QuickBooks Online as Credit Card Purchase/Charge entries — with receipt images attached. Built on top of an existing receipt scanner that uses Google Cloud Vision OCR and Supabase for local storage.

## Core Value

Technicians scan a receipt on their phone and it appears in QuickBooks Online as a properly categorized expense with the receipt image attached — no manual QBO data entry by the CFO.

## Requirements

### Validated

- ✓ Camera capture works on mobile browsers — existing
- ✓ OCR extracts text from receipt images via Google Cloud Vision — existing
- ✓ Receipt data parsed into structured fields (vendor, date, total, tax, line items) — existing
- ✓ Image quality checks (blur, darkness) with warnings — existing
- ✓ Review form with QuickBooks-style categories and payment methods — existing
- ✓ Expenses saved to Supabase database — existing
- ✓ Receipt images uploaded to Supabase Storage — existing
- ✓ PWA support for mobile home screen install — existing

### Active

- [ ] QBO OAuth 2.0 authentication flow (single BMB Enterprises account)
- [ ] Secure token management via Supabase Edge Functions (access token refresh, refresh token rotation)
- [ ] Create "Credit Card Purchase/Charge" entries in QBO (Purchase entity, PaymentType=CreditCard)
- [ ] Pull chart of accounts from QBO for dynamic expense account mapping
- [ ] Pull credit card accounts from QBO for payment source selection
- [ ] Cardholder identification (Ref No field — initials dropdown, small team of 2-5)
- [ ] QBO Class tracking on expenses
- [ ] Attach receipt image to QBO transaction via Attachable API
- [ ] Memo field maps to QBO PrivateNote/Memo
- [ ] Dual save flow: save to Supabase locally + optional immediate push to QBO
- [ ] Batch review: list of saved expenses with "Send to QBO" action per expense
- [ ] QBO sync status tracking per expense (not sent / sending / sent / failed)
- [ ] Error handling with retry for failed QBO submissions
- [ ] Vendor matching/creation in QBO (match by name or create new)

### Out of Scope

- Multi-tenant / multi-company QBO connections — single BMB account only
- QBO user authentication (technicians don't log into QBO, just the app)
- Offline mode — requires connectivity for OCR and QBO
- Editing expenses already sent to QBO — one-way push
- QBO Bill creation — only Credit Card Purchase/Charge
- Automated receipt categorization via AI — manual category selection by user
- Line item breakdown in QBO — single expense line per receipt (matching Adam's current workflow)

## Context

- **Company:** BMB Enterprises Inc., HVAC equipment distributor in Jacksonville, FL (50+ years)
- **Users:** Small team of 2-5 technicians with company credit cards
- **CFO workflow:** Adam currently enters receipts manually in QBO as Credit Card Purchase/Charge
- **QBO structure observed from examples:**
  - Payment accounts: Amers Business Visa, Amers Pcard (credit card accounts)
  - Chart of accounts: Nested (e.g., 6000→6060→6010 Vehicle Fuel, 7000→7700→7710 Meals & Entertainment)
  - Ref No: Cardholder initials (e.g., "JA" for JAdministrative)
  - Classes: Used for tracking (e.g., "JA")
  - Single expense line per receipt with one account
  - Memo with purchase context
  - Receipt image attached to transaction
- **Existing stack:** React 19, Vite 7, TypeScript, Supabase, Google Cloud Vision API, Zod, react-hook-form
- **Intuit App ID:** 0d714481-a1c4-43b0-b51a-2c7331010309 (Development keys configured)
- **QBO API endpoints:**
  - Sandbox: https://sandbox-quickbooks.api.intuit.com
  - Production: https://quickbooks.api.intuit.com
  - Auth: https://appcenter.intuit.com/connect/oauth2
  - Token: https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer
  - Scope: com.intuit.quickbooks.accounting
- **Token lifecycle:** Access token = 1 hour, Refresh token = 100 days

## Constraints

- **Backend:** Supabase Edge Functions for all QBO server-side operations (OAuth, API calls, token storage) — no standalone backend server
- **Security:** Client ID/Secret stored as Supabase secrets, never in frontend code. Tokens stored in Supabase database, not browser.
- **API:** QBO Accounting API v3 — Purchase entity with PaymentType=CreditCard
- **Compatibility:** Must not break existing receipt scanning, OCR, or Supabase storage functionality
- **Architecture:** QBO integration logic must be cleanly separated from core receipt processing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Edge Functions for backend | Reuses existing infrastructure, no new server deployment | — Pending |
| Pull chart of accounts from QBO | Accounts change over time; hardcoding would drift | — Pending |
| Keep Supabase as local DB alongside QBO | Decouples receipt capture from QBO availability; enables batch review | — Pending |
| Single expense line per receipt | Matches Adam's current QBO entry workflow (observed in examples) | — Pending |
| Credit Card Purchase/Charge only | All examples show this entity type; bills not needed | — Pending |
| Cardholder dropdown (not auth) | Small team, no need for user accounts; simple initials picker | — Pending |

---
*Last updated: 2026-02-16 after initialization*
