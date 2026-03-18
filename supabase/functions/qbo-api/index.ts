// QBD API Edge Function
// Adapted from QBO REST API to QuickBooks Desktop (QBWC) queue-based architecture.
// Instead of calling QBO REST APIs, this function writes QBXML requests to a queue
// table that the QBWC SOAP server picks up during sync cycles.
//
// See: https://supabase.com/docs/guides/functions/routing

import { Hono } from 'jsr:@hono/hono'
import { cors } from 'jsr:@hono/hono/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import * as jose from 'npm:jose@^5'

// ---------------------------------------------------------------------------
// App with basePath matching the Edge Function directory name.
// CRITICAL: Without basePath('/qbo-api') ALL routes return 404.
// ---------------------------------------------------------------------------
const app = new Hono().basePath('/qbo-api')

// ---------------------------------------------------------------------------
// 1. CORS middleware (must be first)
// ---------------------------------------------------------------------------
const FRONTEND_URL = Deno.env.get('QBO_FRONTEND_URL') ?? ''

app.use(
  '*',
  cors({
    origin: (origin) => {
      const allowed = ['http://localhost:5173']
      if (FRONTEND_URL) allowed.push(FRONTEND_URL)
      return allowed.includes(origin) ? origin : allowed[0]
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

// ---------------------------------------------------------------------------
// 2. JWT auth middleware
// All routes require a valid Supabase Auth JWT.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`

app.use('*', async (c, next) => {
  const path = c.req.path

  // Public health check only (not /admin/health which requires auth)
  if (path.endsWith('/health') && !path.includes('/admin/')) {
    return next()
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or missing JWT' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const JWKS = jose.createRemoteJWKSet(new URL(JWKS_URL))
    const { payload } = await jose.jwtVerify(token, JWKS)
    c.set('jwtPayload', payload)

    // Extract user ID from JWT
    const userId = payload.sub as string
    c.set('userId', userId)

    // Get role from JWT app_metadata first, then fall back to profiles table
    const appMetadata = (payload as Record<string, unknown>).app_metadata as Record<string, unknown> | undefined
    let userRole = (appMetadata?.role as string) || ''

    // If JWT doesn't have the role yet (stale token), check profiles table
    if (!userRole) {
      const { data: profile } = await getServiceClient()
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()
      userRole = profile?.role || 'user'
    }

    c.set('userRole', userRole)
    return next()
  } catch (_err) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or missing JWT' }, 401)
  }
})

// ---------------------------------------------------------------------------
// Admin guard helper
// ---------------------------------------------------------------------------
// deno-lint-ignore no-explicit-any
function requireAdmin(c: any): Response | null {
  const role = c.get('userRole') as string
  if (role !== 'admin') {
    return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403)
  }
  return null
}

// ---------------------------------------------------------------------------
// 3. Request logging middleware
// ---------------------------------------------------------------------------
app.use('*', async (c, next) => {
  const start = Date.now()
  console.log(`[${new Date().toISOString()}] --> ${c.req.method} ${c.req.path}`)
  await next()
  console.log(
    `[${new Date().toISOString()}] <-- ${c.req.method} ${c.req.path} ${c.res.status} (${Date.now() - start}ms)`
  )
})

// ---------------------------------------------------------------------------
// 4. Supabase service client helper
// ---------------------------------------------------------------------------
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

let _serviceClient: ReturnType<typeof createClient> | null = null

function getServiceClient() {
  if (!_serviceClient) {
    _serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return _serviceClient
}

// ---------------------------------------------------------------------------
// 5. QBXML builder helpers
// QBD uses XML instead of JSON. We build QBXML strings for the queue.
// ---------------------------------------------------------------------------

// Decode XML/HTML entities first to avoid double-encoding (e.g. &amp; → &amp;amp;)
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function escapeXml(str: string): string {
  return decodeEntities(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildCreditCardChargeAdd(data: {
  paymentAccountName: string
  txnDate: string
  vendorName: string
  memo?: string
  expenseAccountName: string
  amount: number
  lineMemo?: string
}): string {
  return `<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CreditCardChargeAddRq>
      <CreditCardChargeAdd>
        <AccountRef><FullName>${escapeXml(data.paymentAccountName)}</FullName></AccountRef>
        <PayeeEntityRef><FullName>${escapeXml(data.vendorName)}</FullName></PayeeEntityRef>
        <TxnDate>${data.txnDate}</TxnDate>${
    data.memo ? `
        <Memo>${escapeXml(data.memo)}</Memo>` : ''
  }
        <ExpenseLineAdd>
          <AccountRef><FullName>${escapeXml(data.expenseAccountName)}</FullName></AccountRef>
          <Amount>${data.amount.toFixed(2)}</Amount>${
    data.lineMemo ? `
          <Memo>${escapeXml(data.lineMemo)}</Memo>` : ''
  }
        </ExpenseLineAdd>
      </CreditCardChargeAdd>
    </CreditCardChargeAddRq>
  </QBXMLMsgsRq>
</QBXML>`
}

function buildCheckAdd(data: {
  paymentAccountName: string
  txnDate: string
  vendorName: string
  memo?: string
  expenseAccountName: string
  amount: number
  lineMemo?: string
}): string {
  return `<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CheckAddRq>
      <CheckAdd>
        <AccountRef><FullName>${escapeXml(data.paymentAccountName)}</FullName></AccountRef>
        <PayeeEntityRef><FullName>${escapeXml(data.vendorName)}</FullName></PayeeEntityRef>
        <TxnDate>${data.txnDate}</TxnDate>${
    data.memo ? `
        <Memo>${escapeXml(data.memo)}</Memo>` : ''
  }
        <ExpenseLineAdd>
          <AccountRef><FullName>${escapeXml(data.expenseAccountName)}</FullName></AccountRef>
          <Amount>${data.amount.toFixed(2)}</Amount>${
    data.lineMemo ? `
          <Memo>${escapeXml(data.lineMemo)}</Memo>` : ''
  }
        </ExpenseLineAdd>
      </CheckAdd>
    </CheckAddRq>
  </QBXMLMsgsRq>
</QBXML>`
}

function buildVendorAddQbxml(name: string): string {
  return `<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <VendorAddRq>
      <VendorAdd>
        <Name>${escapeXml(name)}</Name>
      </VendorAdd>
    </VendorAddRq>
  </QBXMLMsgsRq>
</QBXML>`
}

function buildAccountQueryQbxml(): string {
  return `<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <AccountQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </AccountQueryRq>
  </QBXMLMsgsRq>
</QBXML>`
}

function buildClassQueryQbxml(): string {
  return `<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <ClassQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </ClassQueryRq>
  </QBXMLMsgsRq>
</QBXML>`
}

function buildVendorQueryQbxml(): string {
  return `<?xml version="1.0"?>
<?qbxml version="16.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <VendorQueryRq>
      <ActiveStatus>ActiveOnly</ActiveStatus>
    </VendorQueryRq>
  </QBXMLMsgsRq>
</QBXML>`
}

// ---------------------------------------------------------------------------
// Helper: get active QBD connection
// ---------------------------------------------------------------------------
async function getActiveQbdConnection(): Promise<{ company_id: string; company_name: string | null; last_sync_at: string | null; sync_interval_minutes: number } | null> {
  const { data, error } = await getServiceClient()
    .from('qbd_connection')
    .select('company_id, company_name, last_sync_at, sync_interval_minutes')
    .eq('is_active', true)
    .single()

  if (error || !data) return null
  return data
}

// Entity cache TTL (24 hours)
const ENTITY_TTL_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// 6. Routes
// ---------------------------------------------------------------------------

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ---------------------------------------------------------------------------
// Connection status (replaces OAuth-based connection check)
// ---------------------------------------------------------------------------
app.get('/connection/status', async (c) => {
  try {
    const conn = await getActiveQbdConnection()
    if (!conn) {
      return c.json({
        connected: false,
        company_name: null,
        last_sync_at: null,
        sync_interval_minutes: null,
      })
    }

    return c.json({
      connected: true,
      company_name: conn.company_name,
      last_sync_at: conn.last_sync_at,
      sync_interval_minutes: conn.sync_interval_minutes,
    })
  } catch (err) {
    console.error('[Connection] Status check error:', err)
    return c.json({ connected: false, company_name: null, last_sync_at: null }, 500)
  }
})

// ---------------------------------------------------------------------------
// Entity cache routes (read from cache tables — populated by QBWC SOAP server)
// These are the same cache tables as before, just populated by QBWC sync
// instead of QBO REST calls.
// ---------------------------------------------------------------------------

app.get('/entities/accounts', async (c) => {
  try {
    const conn = await getActiveQbdConnection()
    if (!conn) return c.json({ error: 'No active QuickBooks connection' }, 400)

    const sb = getServiceClient()
    const { data: accounts, error } = await sb
      .from('qbo_entity_accounts')
      .select('qbo_id, name, fully_qualified_name, account_type')
      .eq('realm_id', conn.company_id)
      .eq('is_active', true)
      .order('fully_qualified_name')

    if (error) {
      console.error('[Entities] Account query error:', error)
      return c.json({ error: 'Failed to fetch accounts' }, 500)
    }

    return c.json({ accounts: accounts ?? [] })
  } catch (err) {
    console.error('[Entities] Accounts error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

app.get('/entities/classes', async (c) => {
  try {
    const conn = await getActiveQbdConnection()
    if (!conn) return c.json({ error: 'No active QuickBooks connection' }, 400)

    const sb = getServiceClient()
    const { data: classes, error } = await sb
      .from('qbo_entity_classes')
      .select('qbo_id, name, fully_qualified_name')
      .eq('realm_id', conn.company_id)
      .eq('is_active', true)
      .order('fully_qualified_name')

    if (error) {
      console.error('[Entities] Class query error:', error)
      return c.json({ error: 'Failed to fetch classes' }, 500)
    }

    return c.json({ classes: classes ?? [] })
  } catch (err) {
    console.error('[Entities] Classes error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

app.get('/entities/vendors', async (c) => {
  try {
    const conn = await getActiveQbdConnection()
    if (!conn) return c.json({ error: 'No active QuickBooks connection' }, 400)

    const sb = getServiceClient()
    const { data: vendors, error } = await sb
      .from('qbo_entity_vendors')
      .select('qbo_id, display_name')
      .eq('realm_id', conn.company_id)
      .eq('is_active', true)
      .order('display_name')

    if (error) {
      console.error('[Entities] Vendor query error:', error)
      return c.json({ error: 'Failed to fetch vendors' }, 500)
    }

    return c.json({ vendors: vendors ?? [] })
  } catch (err) {
    console.error('[Entities] Vendors error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Vendor find-or-create (queue-based for QBD)
// If vendor exists in cache, return it. Otherwise queue a VendorAdd for next sync.
// ---------------------------------------------------------------------------
app.post('/entities/vendors/find-or-create', async (c) => {
  try {
    const conn = await getActiveQbdConnection()
    if (!conn) return c.json({ error: 'No active QuickBooks connection' }, 400)

    const body = await c.req.json()
    const name = body.name?.trim()
    if (!name) return c.json({ error: 'Vendor name required' }, 400)

    const sb = getServiceClient()

    // Check cache first
    const { data: existing } = await sb
      .from('qbo_entity_vendors')
      .select('qbo_id, display_name')
      .eq('realm_id', conn.company_id)
      .ilike('display_name', name)
      .limit(1)
      .single()

    if (existing) {
      return c.json({ vendor: existing, source: 'cache' })
    }

    // Queue a VendorAdd request for the next QBWC sync cycle
    const qbxml = buildVendorAddQbxml(name)
    const { data: queueItem, error: queueError } = await sb
      .from('qbd_sync_queue')
      .insert({
        company_id: conn.company_id,
        request_type: 'vendor_create',
        qbxml_request: qbxml,
        related_id: name,
        status: 'pending',
      })
      .select('id')
      .single()

    if (queueError) {
      console.error('[Vendors] Queue insert error:', queueError)
      return c.json({ error: 'Failed to queue vendor creation' }, 500)
    }

    // Return a temporary vendor entry (will be resolved after sync)
    return c.json({
      vendor: { qbo_id: null, display_name: name },
      source: 'queued',
      queue_id: queueItem?.id,
    })
  } catch (err) {
    console.error('[Vendors] Find-or-create error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Entity refresh — queue entity sync requests for next QBWC cycle
// ---------------------------------------------------------------------------
app.post('/entities/refresh', async (c) => {
  try {
    const conn = await getActiveQbdConnection()
    if (!conn) return c.json({ error: 'No active QuickBooks connection' }, 400)

    const sb = getServiceClient()
    const entityTypes = [
      { type: 'accounts', qbxml: buildAccountQueryQbxml() },
      { type: 'classes', qbxml: buildClassQueryQbxml() },
      { type: 'vendors', qbxml: buildVendorQueryQbxml() },
    ]

    for (const entity of entityTypes) {
      await sb.from('qbd_sync_queue').insert({
        company_id: conn.company_id,
        request_type: 'entity_sync',
        qbxml_request: entity.qbxml,
        related_id: entity.type,
        status: 'pending',
      })
    }

    return c.json({ queued: true, message: 'Entity sync queued for next QBWC cycle' })
  } catch (err) {
    console.error('[Entities] Refresh error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Expense submit — queue-based (replaces direct QBO Purchase creation)
// ---------------------------------------------------------------------------
app.post('/expenses/:expenseId/submit', async (c) => {
  const expenseId = c.req.param('expenseId')

  try {
    const conn = await getActiveQbdConnection()
    if (!conn) return c.json({ error: 'No active QuickBooks connection' }, 400)

    const sb = getServiceClient()

    // Load expense
    const { data: expense, error: expError } = await sb
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single()

    if (expError || !expense) {
      return c.json({ error: 'Expense not found' }, 404)
    }

    // Ownership check: users can only submit their own expenses
    const userId = c.get('userId') as string
    const userRole = c.get('userRole') as string
    if (userRole !== 'admin' && expense.user_id !== userId) {
      return c.json({ error: 'Forbidden', message: 'You can only submit your own expenses' }, 403)
    }

    if (expense.qbo_purchase_id) {
      return c.json({ error: 'Expense already synced to QuickBooks' }, 409)
    }

    // Determine payment type from payment account type
    // Default to credit card if payment method contains "credit" or "card"
    const paymentMethod = (expense.payment_method || '').toLowerCase()
    const isCreditCard = paymentMethod.includes('credit') || paymentMethod.includes('card') || paymentMethod.includes('visa') || paymentMethod.includes('mastercard') || paymentMethod.includes('amex')

    // Need entity full names for QBXML
    // Use stored names, or fall back to looking up from cache
    let vendorName = expense.qbo_vendor_name || expense.vendor
    let expenseAccountName = expense.qbo_account_full_name || expense.qbo_account_name || expense.category
    let paymentAccountName = expense.qbo_payment_account_name || expense.payment_method

    // If we have QBO IDs but no names, look up from cache
    if (expense.qbo_vendor_id && !expense.qbo_vendor_name) {
      const { data: v } = await sb
        .from('qbo_entity_vendors')
        .select('display_name')
        .eq('qbo_id', expense.qbo_vendor_id)
        .single()
      if (v) vendorName = v.display_name
    }

    if (expense.qbo_account_id && !expense.qbo_account_full_name) {
      const { data: a } = await sb
        .from('qbo_entity_accounts')
        .select('fully_qualified_name')
        .eq('qbo_id', expense.qbo_account_id)
        .single()
      if (a) expenseAccountName = a.fully_qualified_name
    }

    if (expense.qbo_payment_account_id && !expense.qbo_payment_account_name) {
      const { data: pa } = await sb
        .from('qbo_entity_accounts')
        .select('fully_qualified_name')
        .eq('qbo_id', expense.qbo_payment_account_id)
        .single()
      if (pa) paymentAccountName = pa.fully_qualified_name
    }

    // Transaction-level memo: merchant/store name from receipt + receipt image URL
    // This goes into the main "Memo" field on the QB Credit Card Charge screen
    const merchantName = expense.vendor || ''
    let txnMemo = merchantName
    if (expense.image_url) {
      txnMemo = txnMemo ? `${txnMemo} | Receipt: ${expense.image_url}` : `Receipt: ${expense.image_url}`
    }

    // Line-level memo: user's notes from the memo field
    // This goes into the expense line "Memo" field on the QB Credit Card Charge screen
    const lineMemo = expense.memo || ''

    // Build QBXML
    const buildData = {
      paymentAccountName,
      txnDate: expense.date,
      vendorName,
      memo: txnMemo || undefined,
      expenseAccountName,
      amount: Number(expense.amount),
      lineMemo: lineMemo || undefined,
    }

    const qbxml = isCreditCard
      ? buildCreditCardChargeAdd(buildData)
      : buildCheckAdd(buildData)

    // Insert into queue
    const { data: queueItem, error: queueError } = await sb
      .from('qbd_sync_queue')
      .insert({
        company_id: conn.company_id,
        request_type: 'expense_submit',
        qbxml_request: qbxml,
        related_id: expenseId,
        status: 'pending',
      })
      .select('id')
      .single()

    if (queueError) {
      console.error('[Submit] Queue insert error:', queueError)
      return c.json({ error: 'Failed to queue expense for sync' }, 500)
    }

    // Update expense status
    await sb.from('expenses').update({
      qbd_queue_id: queueItem.id,
      qbd_sync_status: 'queued',
      qbo_error: null,
      qbo_sync_attempts: (expense.qbo_sync_attempts || 0) + 1,
    }).eq('id', expenseId)

    console.log(`[Submit] Expense ${expenseId} queued as ${queueItem.id}`)

    return c.json({
      status: 'queued',
      queue_id: queueItem.id,
      message: 'Expense queued for QuickBooks sync',
    })
  } catch (err) {
    console.error('[Submit] Error:', err)

    // Record error on expense
    const sb = getServiceClient()
    await sb.from('expenses').update({
      qbo_error: err instanceof Error ? err.message : 'Unknown error',
      qbd_sync_status: 'failed',
    }).eq('id', expenseId)

    return c.json({ error: err instanceof Error ? err.message : 'Submit failed' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Queue status check
// ---------------------------------------------------------------------------
app.get('/queue/:id/status', async (c) => {
  const queueId = c.req.param('id')

  try {
    const sb = getServiceClient()
    const { data, error } = await sb
      .from('qbd_sync_queue')
      .select('id, status, error_message, created_at, sent_at, completed_at')
      .eq('id', queueId)
      .single()

    if (error || !data) {
      return c.json({ error: 'Queue item not found' }, 404)
    }

    return c.json(data)
  } catch (err) {
    console.error('[Queue] Status check error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Current user profile
// ---------------------------------------------------------------------------
app.get('/me/profile', async (c) => {
  try {
    const userId = c.get('userId') as string
    const sb = getServiceClient()

    const { data: profile, error } = await sb
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      return c.json({ error: 'Profile not found' }, 404)
    }

    return c.json(profile)
  } catch (err) {
    console.error('[Profile] Error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Admin routes
// ---------------------------------------------------------------------------

// List all users with profiles
app.get('/admin/users', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const sb = getServiceClient()
    const { data: profiles, error } = await sb
      .from('profiles')
      .select('id, email, full_name, role, is_active, created_at, updated_at')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Admin] Users query error:', error)
      return c.json({ error: 'Failed to fetch users' }, 500)
    }

    return c.json({ users: profiles ?? [] })
  } catch (err) {
    console.error('[Admin] Users error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// Invite (create) a new user
app.post('/admin/users/invite', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const body = await c.req.json()
    const { email, full_name, password, role } = body

    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400)
    }
    if (password.length < 6) {
      return c.json({ error: 'Password must be at least 6 characters' }, 400)
    }

    const userRole = role === 'admin' ? 'admin' : 'user'
    const sb = getServiceClient()

    // Create user via admin API
    const { data: newUser, error: createError } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: userRole },
      user_metadata: { full_name: full_name || '' },
    })

    if (createError) {
      console.error('[Admin] Create user error:', createError)
      return c.json({ error: createError.message }, 400)
    }

    return c.json({
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        full_name: full_name || '',
        role: userRole,
      },
    })
  } catch (err) {
    console.error('[Admin] Invite error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// Change user role
app.patch('/admin/users/:id/role', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const targetId = c.req.param('id')
    const body = await c.req.json()
    const newRole = body.role

    if (!newRole || !['admin', 'user'].includes(newRole)) {
      return c.json({ error: 'Invalid role. Must be "admin" or "user"' }, 400)
    }

    const sb = getServiceClient()

    // Update app_metadata on auth.users
    const { error: authError } = await sb.auth.admin.updateUserById(targetId, {
      app_metadata: { role: newRole },
    })

    if (authError) {
      console.error('[Admin] Update role auth error:', authError)
      return c.json({ error: authError.message }, 400)
    }

    // Update profiles table
    const { error: profileError } = await sb
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetId)

    if (profileError) {
      console.error('[Admin] Update role profile error:', profileError)
    }

    return c.json({ success: true, role: newRole })
  } catch (err) {
    console.error('[Admin] Role update error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// Activate/deactivate user
app.patch('/admin/users/:id/status', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const targetId = c.req.param('id')
    const body = await c.req.json()
    const isActive = Boolean(body.is_active)

    const sb = getServiceClient()

    // Ban/unban in Supabase Auth
    const { error: authError } = await sb.auth.admin.updateUserById(targetId, {
      ban_duration: isActive ? 'none' : '876000h', // ~100 years ban = deactivated
    })

    if (authError) {
      console.error('[Admin] Update status auth error:', authError)
      return c.json({ error: authError.message }, 400)
    }

    // Update profiles table
    const { error: profileError } = await sb
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', targetId)

    if (profileError) {
      console.error('[Admin] Update status profile error:', profileError)
    }

    return c.json({ success: true, is_active: isActive })
  } catch (err) {
    console.error('[Admin] Status update error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// All expenses with user info (admin view)
app.get('/admin/expenses', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const sb = getServiceClient()

    // Fetch expenses and profiles separately (no direct FK between them)
    const [expResult, profileResult] = await Promise.all([
      sb.from('expenses')
        .select('id, user_id, vendor, date, amount, category, payment_method, memo, qbd_sync_status, qbo_error, created_at')
        .order('date', { ascending: false })
        .limit(200),
      sb.from('profiles')
        .select('id, email, full_name'),
    ])

    if (expResult.error) {
      console.error('[Admin] Expenses query error:', expResult.error)
      return c.json({ error: 'Failed to fetch expenses' }, 500)
    }

    // Build profile lookup map
    const profileMap = new Map<string, { email: string; full_name: string }>()
    for (const p of (profileResult.data ?? [])) {
      profileMap.set(p.id, { email: p.email, full_name: p.full_name })
    }

    // Attach profile info to each expense
    const expenses = (expResult.data ?? []).map(exp => ({
      ...exp,
      profiles: profileMap.get(exp.user_id) || null,
    }))

    return c.json({ expenses })
  } catch (err) {
    console.error('[Admin] Expenses error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// Queue overview (admin view)
app.get('/admin/queue', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const sb = getServiceClient()

    // Get counts by status
    const statuses = ['pending', 'sent', 'completed', 'failed']
    const counts: Record<string, number> = {}
    for (const status of statuses) {
      const { count } = await sb
        .from('qbd_sync_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', status)
      counts[status] = count ?? 0
    }

    // Recent items
    const { data: recent, error } = await sb
      .from('qbd_sync_queue')
      .select('id, request_type, related_id, status, error_message, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[Admin] Queue query error:', error)
      return c.json({ error: 'Failed to fetch queue' }, 500)
    }

    return c.json({ counts, recent: recent ?? [] })
  } catch (err) {
    console.error('[Admin] Queue error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// System health (admin view)
app.get('/admin/health', async (c) => {
  const denied = requireAdmin(c)
  if (denied) return denied

  try {
    const sb = getServiceClient()

    // Connection info
    const conn = await getActiveQbdConnection()

    // Cache stats — query individually to avoid destructuring issues
    const accountsRes = await sb.from('qbo_entity_accounts').select('*', { count: 'exact', head: true })
    const classesRes = await sb.from('qbo_entity_classes').select('*', { count: 'exact', head: true })
    const vendorsRes = await sb.from('qbo_entity_vendors').select('*', { count: 'exact', head: true })

    // Expense totals
    const totalRes = await sb.from('expenses').select('*', { count: 'exact', head: true })
    const syncedRes = await sb.from('expenses').select('*', { count: 'exact', head: true }).eq('qbd_sync_status', 'synced')
    const queuedRes = await sb.from('expenses').select('*', { count: 'exact', head: true }).eq('qbd_sync_status', 'queued')
    const failedRes = await sb.from('expenses').select('*', { count: 'exact', head: true }).eq('qbd_sync_status', 'failed')

    // User count
    const usersRes = await sb.from('profiles').select('*', { count: 'exact', head: true })

    return c.json({
      connection: conn ? {
        connected: true,
        company_name: conn.company_name,
        last_sync_at: conn.last_sync_at,
      } : { connected: false },
      cache: {
        accounts: accountsRes.count ?? 0,
        classes: classesRes.count ?? 0,
        vendors: vendorsRes.count ?? 0,
      },
      expenses: {
        total: totalRes.count ?? 0,
        synced: syncedRes.count ?? 0,
        queued: queuedRes.count ?? 0,
        failed: failedRes.count ?? 0,
      },
      users: usersRes.count ?? 0,
    })
  } catch (err) {
    console.error('[Admin] Health error:', err)
    return c.json({ error: 'Internal error' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Serve
// ---------------------------------------------------------------------------
Deno.serve(app.fetch)
