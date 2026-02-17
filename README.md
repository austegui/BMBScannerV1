# BMB Receipt Scanner

A mobile-first Progressive Web App that lets users photograph receipts, extract expense data via OCR, and submit them directly to QuickBooks Online as Purchase entities.

## How It Works

```
Camera/Photo -> OCR (Google Vision) -> Review Form -> Save to DB -> Submit to QBO
```

1. **Scan** — User photographs a receipt or uploads an image
2. **Extract** — Google Cloud Vision OCR pulls vendor, date, amount, tax, line items
3. **Review** — User reviews/edits extracted data and maps to QBO entities (vendor, expense account, payment account, class)
4. **Save** — Expense is stored in Supabase with QBO entity IDs
5. **Submit** — One-click push to QuickBooks Online as a Purchase entity

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 7, PWA (installable on mobile)
- **Backend:** Supabase Edge Function (Deno + Hono) — single function handles all QBO operations
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage (receipt images)
- **OCR:** Google Cloud Vision API
- **QBO Integration:** Intuit OAuth2 + QuickBooks Accounting API
- **Hosting:** Vercel (frontend), Supabase (backend)

## Live URLs

| Service | URL |
|---------|-----|
| App | https://bmb-scanner-v1.vercel.app |
| Supabase Dashboard | https://supabase.com/dashboard/project/lgodlepuythshpzayzba |
| Edge Function Logs | https://supabase.com/dashboard/project/lgodlepuythshpzayzba/functions/qbo-api/logs |
| QBO Sandbox | https://developer.intuit.com/app/developer/sandbox |

## Local Development

### Prerequisites

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- Access to the Supabase project and Intuit Developer app

### Setup

```bash
# Clone
git clone https://github.com/austegui/BMBScannerV1.git
cd BMBScannerV1

# Install dependencies
npm install

# Create .env with your keys (see Environment Variables below)

# Start dev server
npm run dev
```

The app runs at `http://localhost:5173`.

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://lgodlepuythshpzayzba.supabase.co
VITE_SUPABASE_ANON_KEY=<your supabase anon key>
VITE_GOOGLE_CLOUD_VISION_API_KEY=<your google vision api key>
```

The edge function uses Supabase Secrets (set via dashboard or CLI):

```
QBO_CLIENT_ID          — Intuit app client ID
QBO_CLIENT_SECRET      — Intuit app client secret
QBO_REDIRECT_URI       — https://lgodlepuythshpzayzba.supabase.co/functions/v1/qbo-api/auth/callback
QBO_FRONTEND_URL       — https://bmb-scanner-v1.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into edge functions.

## Project Structure

```
src/
  App.tsx                        # Top-level router (list vs scan view)
  components/
    CameraCapture.tsx            # Camera -> preview -> OCR -> review -> save
    ReceiptReview.tsx            # Editable form with QBO entity dropdowns
    ExpenseList.tsx              # Expense cards with QBO submit button
    QboConnectionStatus.tsx      # Connect/disconnect QBO in header
    ImagePreview.tsx             # Receipt image preview
    LineItemEditor.tsx           # OCR line item editor
    QualityWarning.tsx           # Image quality feedback
  services/
    supabase.ts                  # Supabase client, Expense type, CRUD
    qboService.ts                # Edge function API calls (connection, entities, submit)
    ocrService.ts                # Google Cloud Vision OCR
  utils/
    receiptParser.ts             # Parse OCR text into structured data
    imageCompression.ts          # Compress images before upload
    imageQuality.ts              # Image quality assessment
  types/
    receipt.ts                   # Receipt/expense TypeScript types

supabase/
  functions/
    qbo-api/
      index.ts                   # ALL QBO server-side logic (single fat function)
  migrations/
    20260217000001_*.sql         # expenses table + QBO sync columns
    20260217000002_*.sql         # qbo_connection table (deny-all RLS)
    20260217000003_*.sql         # receipts storage bucket policies
    20260218000001_*.sql         # refresh_token_expires_at column
    20260218000002_*.sql         # entity cache tables + expense QBO ID columns
```

## Edge Function API Routes

All routes are under `POST/GET /functions/v1/qbo-api/...`

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Health check |
| GET | `/auth/start` | Generate QBO OAuth authorization URL |
| GET | `/auth/callback` | Handle OAuth redirect from Intuit |
| GET | `/connection/status` | Check if QBO is connected + token health |
| POST | `/connection/disconnect` | Disconnect QBO, clear tokens |
| GET | `/entities/accounts` | Get synced Expense + Credit Card accounts |
| GET | `/entities/classes` | Get synced QBO classes |
| GET | `/entities/vendors` | Get synced QBO vendors |
| POST | `/entities/vendors/find-or-create` | Find vendor by name or create in QBO |
| POST | `/entities/refresh` | Force-refresh all entity caches |
| POST | `/expenses/:id/submit` | Submit expense to QBO as Purchase |

## Database Schema

### `expenses`
Main table for all scanned receipts. Columns include standard fields (`vendor`, `date`, `amount`, `category`, `payment_method`, `tax`, `memo`, `image_url`) plus QBO mapping fields (`qbo_vendor_id`, `qbo_account_id`, `qbo_payment_account_id`, `qbo_class_id`) and sync tracking fields (`qbo_purchase_id`, `qbo_pushed_at`, `qbo_error`, `qbo_sync_attempts`). RLS: allow-all (no auth yet).

### `qbo_connection`
Stores OAuth tokens for the QBO connection. One active row per `realm_id`. RLS: deny-all (only accessible via service_role in edge functions). Key columns: `realm_id`, `access_token`, `refresh_token`, `token_expires_at`, `refresh_token_expires_at`, `is_active`.

### `qbo_entity_accounts` / `qbo_entity_classes` / `qbo_entity_vendors`
Cached QBO entities with 24-hour TTL. Synced from QBO on first request, then served from cache. RLS: deny-all. Each has `realm_id`, `qbo_id`, name fields, `is_active`, `synced_at`.

## Deployment

```bash
# Deploy edge function
npx supabase functions deploy qbo-api --no-verify-jwt

# Apply database migrations (preview first)
npx supabase db push --dry-run
npx supabase db push

# Deploy frontend to Vercel
npx vercel --prod
```

## Verifying QBO Submissions

After submitting an expense, verify it appeared in QBO:

1. Go to https://developer.intuit.com/app/developer/sandbox
2. Click your sandbox company to open the QBO UI
3. Navigate to **Expenses** in the left sidebar
4. The submitted Purchase should appear with the correct vendor, amount, date, and account

## Completed Features (Phases 1-4)

- **Phase 1 — OAuth:** Full QBO OAuth2 flow with HMAC-signed CSRF state tokens
- **Phase 2 — Token Management:** Auto-refresh with Compare-And-Swap for concurrent safety, 401 retry
- **Phase 3 — Entity Sync:** Live QBO accounts/classes/vendors with 24h cache, vendor find-or-create
- **Phase 4 — Submit Expense:** Push expenses to QBO as Purchase entities with submit/retry/failed UI states

## Known Limitations & Next Steps

- **No authentication** — All edge function routes currently skip JWT verification. Adding Supabase Auth is the most important next step.
- **No receipt attachments** — Receipt images are stored in Supabase but not attached to the QBO Purchase entity.
- **No bulk submit** — Expenses must be submitted one at a time.
- **No edit** — Expenses cannot be edited after saving (must delete and re-scan).
- **No duplicate detection** — Nothing prevents scanning the same receipt twice.
- **Alert-based errors** — Error feedback uses browser `alert()` instead of toast notifications.

## Claude Code Instructions

This project includes a `CLAUDE.md` file at the root with detailed architecture notes, critical gotchas, and development context for Claude Code users. It is automatically loaded when opening the project with Claude Code.
