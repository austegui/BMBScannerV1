# QBWC SOAP Server

A Node.js + Express SOAP server that bridges a Supabase queue to **QuickBooks Desktop** via the **QuickBooks Web Connector (QBWC)**. Receipt expenses are queued by the frontend/edge function, and this server delivers them to QBD on each QBWC poll cycle.

## Architecture

```
Frontend → Supabase Edge Function → qbd_sync_queue (Supabase DB)
                                           ↓
    Client PC: QBD ← QBWC ← polls → This SOAP Server
                                           ↓
                                     Reads queue, returns QBXML
                                     Writes responses back to DB
```

QBWC polls the SOAP server every 5 minutes. Each sync cycle follows this sequence:

1. **`authenticate`** — validates `company_id` + shared password (bcrypt)
2. **`sendRequestXML`** — returns next pending QBXML from `qbd_sync_queue` (loops until empty)
3. **`receiveResponseXML`** — parses QBD response, updates queue + expense/entity tables
4. **`closeConnection`** — updates `last_sync_at` timestamp

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js (ES modules) |
| Framework | Express |
| SOAP | `soap` npm package |
| Database | Supabase (PostgreSQL via `@supabase/supabase-js`) |
| Auth | bcrypt password hashing |
| TypeScript | Strict mode, ES2022 target |

## Project Structure

```
soap-server/
├── src/
│   ├── index.ts          # Express server, SOAP mount, QWC file endpoint
│   ├── qbwc-service.ts   # QBWC WSDL method implementations
│   ├── qbxml.ts          # QBXML builder and parser utilities
│   └── qbwc.wsdl         # WSDL definition for QBWC interface
├── package.json
├── tsconfig.json
└── .gitignore
```

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project with the required tables (see [Database Schema](#database-schema))
- HTTPS hosting (Railway, Render, VPS) — QBWC requires SSL for remote connections

### Install & Run

```bash
npm install
npm run dev      # development (tsx watch)
npm run build    # compile TypeScript
npm start        # production (node dist/index.js)
```

### Environment Variables

Create a `.env` file:

```env
PORT=8080
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SOAP_SERVER_URL=https://your-deployed-url.com
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 8080) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) |
| `SOAP_SERVER_URL` | Public HTTPS URL of this server (used in QWC file generation) |

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check (`{ status: "ok" }`) |
| GET | `/qwc` | Download `.qwc` file for QBWC client setup |
| POST | `/qbwc` | SOAP endpoint (called by QBWC) |
| GET | `/qbwc?wsdl` | WSDL definition |

## QBWC SOAP Methods

All methods are defined in the WSDL and implemented in `qbwc-service.ts`:

| Method | Purpose |
|--------|---------|
| `serverVersion` | Returns server version string |
| `clientVersion` | Accepts/rejects QBWC client version |
| `authenticate` | Validates username + password against `qbd_connection` table |
| `sendRequestXML` | Returns next pending QBXML from sync queue |
| `receiveResponseXML` | Processes QBD response, updates DB accordingly |
| `getLastError` | Returns last error message for a session |
| `connectionError` | Handles QBWC connection-level errors |
| `closeConnection` | Cleanup, updates `last_sync_at` |

## QBXML Request Types

The server handles three categories of QBXML operations:

### Expense Submission
- **`CreditCardChargeAddRq`** — credit card expenses
- **`CheckAddRq`** — check expenses
- Uses `<EntityRef>` for credit card charges, `<PayeeEntityRef>` for checks

### Vendor Management
- **`VendorAddRq`** — create new vendors in QBD

### Entity Sync (cache refresh)
- **`AccountQueryRq`** — sync chart of accounts
- **`ClassQueryRq`** — sync class list
- **`VendorQueryRq`** — sync vendor list

## Database Schema

The server reads/writes these Supabase tables:

### `qbd_connection`
| Column | Type | Purpose |
|--------|------|---------|
| `company_id` | text | Unique identifier (also used as QBWC username) |
| `soap_password_hash` | text | bcrypt hash of the shared password |
| `is_active` | boolean | Whether this connection is active |
| `last_sync_at` | timestamptz | Updated on each `closeConnection` |

### `qbd_sync_queue`
| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `company_id` | text | Links to `qbd_connection` |
| `request_type` | text | `expense_submit`, `vendor_create`, or `entity_sync` |
| `qbxml_request` | text | The QBXML to send to QBD |
| `qbxml_response` | text | QBD's response (populated after sync) |
| `related_id` | text | Expense ID or entity type (`accounts`/`classes`/`vendors`) |
| `status` | text | `pending` → `sent` → `completed` / `failed` |
| `error_message` | text | Error details if failed |
| `created_at` | timestamptz | When queued |
| `sent_at` | timestamptz | When sent to QBD |
| `completed_at` | timestamptz | When response received |

### `expenses` (updated on sync)
| Column | Type | Purpose |
|--------|------|---------|
| `qbo_purchase_id` | text | QBD TxnID (set on successful sync) |
| `qbo_pushed_at` | timestamptz | When synced |
| `qbo_error` | text | Error message if sync failed |
| `qbd_sync_status` | text | `queued` / `synced` / `failed` |

### Entity Cache Tables
Populated by entity sync responses:
- **`qbo_entity_accounts`** — `realm_id`, `qbo_id` (ListID), `name`, `fully_qualified_name`, `account_type`
- **`qbo_entity_classes`** — `realm_id`, `qbo_id` (ListID), `name`, `fully_qualified_name`
- **`qbo_entity_vendors`** — `realm_id`, `qbo_id` (ListID), `display_name`

## Client Setup (QBWC)

1. Install **QuickBooks Web Connector** (QBWC 2.3+) on the PC running QuickBooks Desktop
2. Download the `.qwc` file from `https://<your-server>/qwc`
3. Open the `.qwc` file in QBWC — it registers the SOAP endpoint
4. Enter the shared password when prompted
5. Grant "always allow" access to the company file
6. Set auto-run interval to 5 minutes
7. Keep QBWC running (auto-start with Windows recommended)

## Deployment

### Railway

```bash
cd soap-server
npx @railway/cli up
```

Set environment variables in Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SOAP_SERVER_URL` (the Railway-provided HTTPS URL)

### Render / Other

Any persistent Node.js host with HTTPS works. The server **must stay running** — it is not compatible with serverless platforms (Lambda, Cloud Functions) because QBWC expects a persistent SOAP endpoint.

## Implementing Your Own Version

To adapt this server for a different project:

1. **Fork this repo**
2. **Update the QBXML builders** in `qbxml.ts` to match your data model
3. **Update `processResponse()`** in `qbwc-service.ts` to write results to your tables
4. **Update the `authenticate` method** to validate against your connection table
5. **Update the QWC generator** in `index.ts` with your app name and IDs
6. **Set up your Supabase tables** matching the schema above (or adapt to your DB)

### Key Implementation Notes

- **QBXML uses `FullName` strings** for entity references, not numeric IDs
- **`CreditCardChargeAdd` uses `<EntityRef>`** for the vendor
- **`CheckAdd` uses `<PayeeEntityRef>`** for the vendor (different tag name)
- **QBD has no attachment API** via QBXML — receipt images stay in your storage
- **SOAP server must be persistent** — not serverless
- **QBWC requires HTTPS** for remote connections
- **QWC file IDs (`OwnerID`, `FileID`) must be stable** — changing them causes QBWC to re-register
- **The `soap` npm package** handles WSDL parsing and XML serialization automatically

## License

MIT
