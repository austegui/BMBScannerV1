# BMB Receipt Scanner

A mobile-first Progressive Web App (PWA) for photographing receipts, extracting expense data via OCR, and syncing them to QuickBooks Desktop through the QuickBooks Web Connector (QBWC).

**Live:** https://bmb-scanner-v1.vercel.app

## Status

| Feature | Status |
|---------|--------|
| Receipt capture + OCR | Done |
| Expense management (CRUD) | Done |
| QBD sync via QBWC | Done |
| Admin dashboard (Users, Expenses, Queue, Health) | Done |
| Role-based access control (admin/user) | Done |
| User management (invite, roles, activate/deactivate) | Done |
| SOAP server | Done (deploy to production host pending) |

## How It Works

```
Phone camera → OCR (Google Vision) → Review & edit → Save to DB
                                                         ↓
                                                   User clicks "Submit"
                                                         ↓
                                                   QBXML queued in DB
                                                         ↓
             QuickBooks Desktop ← QBWC polls → SOAP Server reads queue
                                                         ↓
                                                   Expense synced
```

Expenses are **queued**, not synced in real-time. The QuickBooks Web Connector polls the SOAP server every 5 minutes and processes pending items.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript, react-hook-form + zod |
| Edge Function | Supabase Edge Functions (Deno + Hono) |
| SOAP Server | Node.js + Express + `soap` package |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (`receipts` bucket) |
| OCR | Google Cloud Vision API |
| Auth | Supabase Auth (email/password, role-based) |
| Hosting | Vercel (frontend), Supabase (backend), Railway/Render (SOAP) |

## Local Development

### Prerequisites

- Node.js 18+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### Frontend

```bash
git clone https://github.com/austegui/BMBScannerV1.git
cd BMBScannerV1
npm install
npm run dev
```

Runs at `http://localhost:5173`.

### SOAP Server

```bash
cd soap-server
npm install
npm run dev
```

### Environment Variables

**Frontend** (`.env` or Vercel):

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_GOOGLE_CLOUD_VISION_API_KEY=<vision api key>
```

**Edge Function** (Supabase Secrets):

```
QBO_FRONTEND_URL=https://bmb-scanner-v1.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.

**SOAP Server** (`.env`):

```
PORT=8080
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>
SOAP_SERVER_URL=https://<deployed-url>
```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── App.tsx                 # Main router + auth state
│   │   ├── LoginPage.tsx           # Email/password login
│   │   ├── CameraCapture.tsx       # Receipt photo → quality check → OCR
│   │   ├── ReceiptReview.tsx       # Expense form with entity dropdowns
│   │   ├── ExpenseList.tsx         # Expense cards with sync status badges
│   │   ├── EditExpense.tsx         # Edit existing expense
│   │   ├── QboConnectionStatus.tsx # QBD connection + last sync indicator
│   │   ├── AdminDashboard.tsx      # Admin panel (4 tabs)
│   │   ├── AdminUserList.tsx       # User CRUD + role management
│   │   ├── AdminExpenseList.tsx    # All expenses across users
│   │   ├── AdminSyncQueue.tsx      # Sync queue monitoring
│   │   ├── AdminSystemHealth.tsx   # System health overview
│   │   ├── Toast.tsx               # Toast notifications
│   │   ├── ImagePreview.tsx        # Full-screen receipt image
│   │   ├── LineItemEditor.tsx      # Line item editing
│   │   └── QualityWarning.tsx      # Image quality alerts
│   ├── services/
│   │   ├── supabase.ts             # DB client + expense CRUD
│   │   ├── qboService.ts           # Edge function API calls
│   │   ├── adminService.ts         # Admin API calls
│   │   └── ocrService.ts           # Google Cloud Vision OCR
│   ├── hooks/
│   │   └── useAuth.ts              # Auth state, roles, sign in/out
│   ├── types/
│   │   └── receipt.ts              # OCR + receipt types
│   └── utils/
│       ├── imageCompression.ts     # Image optimization
│       ├── imageQuality.ts         # Blur/darkness detection
│       └── receiptParser.ts        # OCR text → structured data
├── supabase/
│   ├── functions/qbo-api/
│   │   └── index.ts                # Edge function (all API routes)
│   └── migrations/                 # 12 SQL migrations
├── soap-server/
│   └── src/
│       ├── index.ts                # Express + SOAP mount + .qwc generator
│       ├── qbwc-service.ts         # QBWC method implementations
│       ├── qbxml.ts                # QBXML builders/parsers
│       └── qbwc.wsdl               # WSDL definition
├── CLAUDE.md                       # Detailed dev documentation
└── README.md
```

## API Routes

All routes are under `/functions/v1/qbo-api/...`

### Public

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Health check |

### Authenticated (JWT required)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/connection/status` | QBD connection + last sync time |
| GET | `/entities/accounts` | Cached accounts from QBD |
| GET | `/entities/classes` | Cached classes from QBD |
| GET | `/entities/vendors` | Cached vendors from QBD |
| POST | `/entities/vendors/find-or-create` | Find or queue vendor creation |
| POST | `/entities/refresh` | Queue entity sync for next QBWC cycle |
| POST | `/expenses/:id/submit` | Build QBXML + queue for sync |
| GET | `/queue/:id/status` | Check queue item status |
| GET | `/me/profile` | Current user's profile |

### Admin only

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/admin/users` | List all users |
| POST | `/admin/users/invite` | Create new user |
| PATCH | `/admin/users/:id/role` | Change user role |
| PATCH | `/admin/users/:id/status` | Activate/deactivate user |
| GET | `/admin/expenses` | All expenses across users |
| GET | `/admin/queue` | Queue overview + recent items |
| GET | `/admin/health` | System health metrics |

## Database Tables

| Table | Purpose |
|-------|---------|
| `expenses` | User expenses with QBD sync tracking |
| `profiles` | User profiles (role, full_name, is_active) — auto-created on signup |
| `qbd_connection` | QBWC connection config (company_id, password, last_sync) |
| `qbd_sync_queue` | QBXML request/response queue |
| `qbo_entity_accounts` | Cached QBD accounts |
| `qbo_entity_classes` | Cached QBD classes |
| `qbo_entity_vendors` | Cached QBD vendors |

## Deployment

```bash
# Frontend
npx vercel --prod

# Edge function
npx supabase functions deploy qbo-api --no-verify-jwt

# Database migrations
npx supabase db push --dry-run   # preview first
npx supabase db push

# SOAP server (from soap-server/)
npm run build
# Deploy dist/ to Railway, Render, or any persistent HTTPS host
```

## QuickBooks Desktop Setup

1. Install QuickBooks Web Connector (QBWC 2.3+) on the PC running QuickBooks Desktop
2. Download `.qwc` file from `https://<soap-server>/qwc`
3. Open in QBWC and enter the shared password
4. Grant "always allow" access to the company file
5. Set auto-run interval to 5 minutes
6. Keep QBWC running (auto-start with Windows recommended)

## Testing

```bash
npm run test          # run tests
npm run test:watch    # watch mode
```

## Contributing

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation, database schema, middleware stack, environment setup, and critical gotchas that every developer should know.
