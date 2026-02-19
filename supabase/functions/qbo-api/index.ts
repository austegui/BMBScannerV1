// QBO API Edge Function
// Single "fat function" that handles ALL QBO server-side operations.
// Plan 01-03 (OAuth flow) and every subsequent phase adds route handlers
// into this scaffold. Middleware stack: CORS -> JWT auth -> logging.
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
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
)

// ---------------------------------------------------------------------------
// 2. JWT auth middleware
//
// Only /auth/callback is excluded — browser navigates here directly from QBO.
// All other routes require a valid Supabase Auth JWT.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`

const AUTH_EXCLUDED_SUFFIXES = [
  '/auth/callback',
]

// Dynamic route patterns excluded from JWT
const AUTH_EXCLUDED_PATTERNS: RegExp[] = []

app.use('*', async (c, next) => {
  const path = c.req.path

  // Skip JWT verification for excluded paths
  if (
    AUTH_EXCLUDED_SUFFIXES.some((suffix) => path.endsWith(suffix)) ||
    AUTH_EXCLUDED_PATTERNS.some((pattern) => pattern.test(path))
  ) {
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
    return next()
  } catch (_err) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or missing JWT' }, 401)
  }
})

// ---------------------------------------------------------------------------
// 3. Request logging middleware
// Logs are viewable in Supabase Edge Function logs dashboard.
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
// Uses service role key for Vault access and qbo_connection queries.
// Cached — not recreated per request.
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
// 5. QBO fetch helper
// MANDATORY: minorversion=75 is appended to EVERY QBO API request.
// (Required as of August 2025 per project decision.)
// ---------------------------------------------------------------------------
const QBO_BASE_URL =
  Deno.env.get('QBO_BASE_URL') ?? 'https://sandbox-quickbooks.api.intuit.com'

async function qboFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  // Always append minorversion=75
  const separator = path.includes('?') ? '&' : '?'
  const url = `${QBO_BASE_URL}${path}${separator}minorversion=75`

  const method = (options.method ?? 'GET').toUpperCase()

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    ...((method === 'POST' || method === 'PUT') && {
      'Content-Type': 'application/json',
    }),
    ...(options.headers as Record<string, string>),
  }

  console.log(`[qboFetch] ${method} ${url}`)

  const response = await fetch(url, { ...options, method, headers })

  console.log(`[qboFetch] ${method} ${url} -> ${response.status}`)

  return response
}

// ---------------------------------------------------------------------------
// 6. Token refresh helper (Phase 2)
// ---------------------------------------------------------------------------

const INTUIT_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

interface ActiveConnection {
  id: string
  realm_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  refresh_token_expires_at: string
}

async function getActiveConnection(): Promise<ActiveConnection | null> {
  const { data, error } = await getServiceClient()
    .from('qbo_connection')
    .select('id, realm_id, access_token, refresh_token, token_expires_at, refresh_token_expires_at')
    .eq('is_active', true)
    .single()

  if (error || !data) {
    console.warn('[TokenRefresh] No active QBO connection found')
    return null
  }
  return data as ActiveConnection
}

async function refreshTokensFromIntuit(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
  const clientSecret = Deno.env.get('QBO_CLIENT_SECRET') ?? ''
  const credentials = btoa(`${clientId}:${clientSecret}`)

  console.log('[TokenRefresh] Calling Intuit token endpoint...')

  const response = await fetch(INTUIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[TokenRefresh] Intuit refresh failed:', response.status, errText)
    // invalid_grant means the refresh token was already rotated by another invocation
    if (errText.includes('invalid_grant')) {
      console.warn('[TokenRefresh] invalid_grant — another invocation likely refreshed first')
      return null
    }
    throw new Error(`Token refresh failed: ${response.status}`)
  }

  return response.json()
}

/**
 * Get a valid access token, refreshing if needed.
 * Uses CAS (Compare-And-Swap) to safely handle concurrent refresh attempts.
 *
 * @param forceRefresh - If true, skip expiry check and always refresh (used on 401 retry)
 */
async function getValidAccessToken(
  forceRefresh = false
): Promise<{ accessToken: string; realmId: string }> {
  const conn = await getActiveConnection()
  if (!conn) {
    throw new Error('No active QBO connection')
  }

  const expiresAt = new Date(conn.token_expires_at).getTime()
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000

  // If token is still valid (>5 min remaining) and not force-refreshing, return it
  if (!forceRefresh && expiresAt > fiveMinutesFromNow) {
    return { accessToken: conn.access_token, realmId: conn.realm_id }
  }

  console.log(`[TokenRefresh] Token ${forceRefresh ? 'force-refresh requested' : 'expired or expiring soon'}, refreshing...`)

  const tokens = await refreshTokensFromIntuit(conn.refresh_token)

  if (!tokens) {
    // invalid_grant — another invocation already refreshed. Re-read DB for the winner's token.
    console.log('[TokenRefresh] Re-reading DB for fresh token (race loser fallback)...')
    const freshConn = await getActiveConnection()
    if (!freshConn) throw new Error('No active QBO connection after refresh race')
    return { accessToken: freshConn.access_token, realmId: freshConn.realm_id }
  }

  // CAS update: only update if token_expires_at hasn't changed (we're the first writer)
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  const { data: updated, error: updateError } = await getServiceClient()
    .from('qbo_connection')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: newExpiresAt,
      token_issued_at: new Date().toISOString(),
    })
    .eq('id', conn.id)
    .eq('token_expires_at', conn.token_expires_at) // CAS condition
    .select('access_token')

  if (updateError) {
    console.error('[TokenRefresh] DB update error:', updateError)
    throw new Error('Failed to store refreshed tokens')
  }

  if (!updated || updated.length === 0) {
    // CAS miss — another invocation updated first. Re-read the winner's token.
    console.log('[TokenRefresh] CAS miss — re-reading DB for winner token...')
    const freshConn = await getActiveConnection()
    if (!freshConn) throw new Error('No active QBO connection after CAS miss')
    return { accessToken: freshConn.access_token, realmId: freshConn.realm_id }
  }

  console.log('[TokenRefresh] Tokens refreshed and stored successfully')
  return { accessToken: tokens.access_token, realmId: conn.realm_id }
}

// ---------------------------------------------------------------------------
// 7. Authenticated QBO fetch wrapper (Phase 2)
// ---------------------------------------------------------------------------

/**
 * High-level wrapper for QBO API calls. Gets a valid token, calls qboFetch,
 * and retries once on 401 with a force-refreshed token.
 *
 * Use `{realmId}` placeholder in path — it's replaced automatically.
 * This is the standard way all future phases should call QBO APIs.
 */
async function authenticatedQboFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const { accessToken, realmId } = await getValidAccessToken()
  const resolvedPath = path.replace(/\{realmId\}/g, realmId)

  const response = await qboFetch(accessToken, resolvedPath, options)

  if (response.status === 401) {
    console.warn('[authenticatedQboFetch] Got 401, force-refreshing token and retrying...')
    const { accessToken: freshToken } = await getValidAccessToken(true)
    return qboFetch(freshToken, resolvedPath, options)
  }

  return response
}

// ---------------------------------------------------------------------------
// 7b. QBO Attachment upload helper (Phase 5)
// Uses multipart/form-data — separate from authenticatedQboFetch (which is JSON).
// ---------------------------------------------------------------------------

async function qboUploadAttachment(
  purchaseId: string,
  fileName: string,
  imageBytes: Uint8Array,
  contentType: string
): Promise<string | null> {
  try {
    const { accessToken, realmId } = await getValidAccessToken()

    // Build multipart body manually (Deno edge functions don't have FormData.set for files reliably)
    const boundary = `----FormBoundary${crypto.randomUUID().replace(/-/g, '')}`

    const metadataJson = JSON.stringify({
      AttachableRef: [{ EntityRef: { type: 'Purchase', value: purchaseId } }],
      FileName: fileName,
      ContentType: contentType,
    })

    // Assemble parts
    const encoder = new TextEncoder()
    const metadataPart = encoder.encode(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file_metadata_0"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      metadataJson + `\r\n`
    )
    const fileHeader = encoder.encode(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file_content_0"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    )
    const fileFooter = encoder.encode(`\r\n--${boundary}--\r\n`)

    // Concatenate into single Uint8Array
    const bodyLength = metadataPart.length + fileHeader.length + imageBytes.length + fileFooter.length
    const body = new Uint8Array(bodyLength)
    let offset = 0
    body.set(metadataPart, offset); offset += metadataPart.length
    body.set(fileHeader, offset); offset += fileHeader.length
    body.set(imageBytes, offset); offset += imageBytes.length
    body.set(fileFooter, offset)

    const url = `${QBO_BASE_URL}/v3/company/${realmId}/upload?minorversion=75`
    console.log(`[qboUploadAttachment] POST ${url} (${imageBytes.length} bytes)`)

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: body,
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[qboUploadAttachment] Upload failed:', resp.status, errText)
      return null
    }

    const result = await resp.json()
    const attachableId = result?.AttachableResponse?.[0]?.Attachable?.Id ?? null
    console.log(`[qboUploadAttachment] Attachable created: ${attachableId}`)
    return attachableId ? String(attachableId) : null
  } catch (err) {
    console.error('[qboUploadAttachment] Error:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// 8. Routes
// ---------------------------------------------------------------------------

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ---------------------------------------------------------------------------
// OAuth routes (Plan 01-03)
// ---------------------------------------------------------------------------

// HMAC-signed state tokens for CSRF protection.
// Survives edge function cold starts (no server-side storage needed).
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

let _hmacKey: CryptoKey | null = null

async function getHmacKey(): Promise<CryptoKey> {
  if (!_hmacKey) {
    const secret = Deno.env.get('QBO_CLIENT_SECRET') ?? ''
    _hmacKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
  }
  return _hmacKey
}

async function createSignedState(): Promise<string> {
  const timestamp = Date.now().toString()
  const key = await getHmacKey()
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return `${timestamp}.${sigB64}`
}

async function verifySignedState(state: string): Promise<boolean> {
  const dotIdx = state.indexOf('.')
  if (dotIdx === -1) return false

  const timestamp = state.substring(0, dotIdx)
  const sigB64 = state.substring(dotIdx + 1)

  // Check expiry
  const age = Date.now() - parseInt(timestamp, 10)
  if (isNaN(age) || age < 0 || age > STATE_TTL_MS) return false

  // Verify HMAC
  const key = await getHmacKey()
  const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0))
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(timestamp))
}

// GET /auth/start
// Generate QBO OAuth authorization URL and return it to the frontend.
app.get('/auth/start', async (c) => {
  const state = await createSignedState()

  const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
  const redirectUri = Deno.env.get('QBO_REDIRECT_URI') ?? ''

  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
  authUrl.searchParams.set('state', state)

  console.log(`[OAuth] /auth/start generated signed state`)

  return c.json({ url: authUrl.toString() })
})

// GET /auth/callback
// Handle QBO OAuth redirect, exchange code for tokens, store in Vault.
// CRITICAL: This route is EXCLUDED from JWT middleware — browser navigates here directly.
app.get('/auth/callback', async (c) => {
  const frontendUrl = Deno.env.get('QBO_FRONTEND_URL') ?? 'http://localhost:5173'

  try {
    const url = new URL(c.req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const realmId = url.searchParams.get('realmId')

    // Validate HMAC-signed state (CSRF protection, survives cold starts)
    if (!state || !(await verifySignedState(state))) {
      console.warn(`[OAuth] Invalid or expired state`)
      return c.redirect(`${frontendUrl}?qbo_error=invalid_state`)
    }

    if (!code || !realmId) {
      console.warn('[OAuth] Missing code or realmId in callback')
      return c.redirect(`${frontendUrl}?qbo_error=token_exchange_failed`)
    }

    // Exchange authorization code for tokens
    const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
    const clientSecret = Deno.env.get('QBO_CLIENT_SECRET') ?? ''
    const redirectUri = Deno.env.get('QBO_REDIRECT_URI') ?? ''

    const credentials = btoa(`${clientId}:${clientSecret}`)

    const tokenResponse = await fetch(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        }).toString(),
      }
    )

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text()
      console.error('[OAuth] Token exchange failed:', tokenResponse.status, errText)
      return c.redirect(`${frontendUrl}?qbo_error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Store tokens directly in qbo_connection (protected by deny-all RLS)
    const serviceClient = getServiceClient()

    // Fetch company name from QBO (non-blocking — failure does not abort the flow)
    let companyName: string | null = null
    try {
      const companyResponse = await qboFetch(
        access_token,
        `/v3/company/${realmId}/companyinfo/${realmId}`
      )
      if (companyResponse.ok) {
        const companyData = await companyResponse.json()
        companyName = companyData?.CompanyInfo?.CompanyName ?? null
      } else {
        console.warn('[OAuth] Company info fetch failed:', companyResponse.status)
      }
    } catch (err) {
      console.warn('[OAuth] Company info fetch error (non-fatal):', err)
    }

    // Upsert connection record (tokens stored directly, protected by deny-all RLS)
    const now = new Date()
    const { error: upsertError } = await serviceClient.from('qbo_connection').upsert(
      {
        realm_id: realmId,
        company_name: companyName,
        access_token: access_token,
        refresh_token: refresh_token,
        token_expires_at: new Date(now.getTime() + expires_in * 1000).toISOString(),
        token_issued_at: now.toISOString(),
        refresh_token_expires_at: new Date(now.getTime() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: true,
      },
      { onConflict: 'realm_id' }
    )

    if (upsertError) {
      console.error('[OAuth] Failed to upsert qbo_connection:', upsertError)
      return c.redirect(`${frontendUrl}?qbo_error=token_exchange_failed`)
    }

    console.log('[OAuth] Connected:', realmId, companyName)

    return c.redirect(`${frontendUrl}?qbo_connected=true`)
  } catch (err) {
    console.error('[OAuth] Unexpected error in /auth/callback:', err)
    return c.redirect(`${frontendUrl}?qbo_error=token_exchange_failed`)
  }
})

// GET /connection/status
// Return whether QBO is connected, company name, and token health info.
// Safe for frontend consumption — never returns tokens.
app.get('/connection/status', async (c) => {
  try {
    const serviceClient = getServiceClient()

    const { data } = await serviceClient
      .from('qbo_connection')
      .select('company_name, is_active, connected_at, refresh_token_expires_at')
      .eq('is_active', true)
      .single()

    if (!data) {
      return c.json({
        connected: false,
        company_name: null,
        token_healthy: false,
        refresh_token_warning: false,
        refresh_token_expires_at: null,
      })
    }

    const refreshExpiresAt = data.refresh_token_expires_at
      ? new Date(data.refresh_token_expires_at).getTime()
      : null
    const ninetyDaysFromNow = Date.now() + 90 * 24 * 60 * 60 * 1000

    return c.json({
      connected: true,
      company_name: data.company_name ?? null,
      token_healthy: refreshExpiresAt ? refreshExpiresAt > ninetyDaysFromNow : false,
      refresh_token_warning: refreshExpiresAt ? refreshExpiresAt <= ninetyDaysFromNow : false,
      refresh_token_expires_at: data.refresh_token_expires_at ?? null,
    })
  } catch (err) {
    console.error('[connection/status] Error:', err)
    return c.json({
      connected: false,
      company_name: null,
      token_healthy: false,
      refresh_token_warning: false,
      refresh_token_expires_at: null,
    })
  }
})

// POST /connection/disconnect
// Deactivate the QBO connection and clear token values.
app.post('/connection/disconnect', async (c) => {
  try {
    const serviceClient = getServiceClient()

    const { error } = await serviceClient
      .from('qbo_connection')
      .update({
        is_active: false,
        access_token: '',
        refresh_token: '',
      })
      .eq('is_active', true)

    if (error) {
      console.error('[disconnect] Error:', error)
      return c.json({ error: 'Failed to disconnect' }, 500)
    }

    console.log('[disconnect] QBO connection deactivated')
    return c.json({ disconnected: true })
  } catch (err) {
    console.error('[disconnect] Unexpected error:', err)
    return c.json({ error: 'Failed to disconnect' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Entity Sync (Phase 3)
// ---------------------------------------------------------------------------

const ENTITY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

type EntityType = 'accounts' | 'classes' | 'vendors'

const ENTITY_TABLE_MAP: Record<EntityType, string> = {
  accounts: 'qbo_entity_accounts',
  classes: 'qbo_entity_classes',
  vendors: 'qbo_entity_vendors',
}

/**
 * Check if cached data is fresh (within TTL).
 * Returns cached rows if fresh, null if stale/empty.
 */
async function getCachedEntities(
  entityType: EntityType,
  realmId: string,
  forceRefresh: boolean
): Promise<Record<string, unknown>[] | null> {
  if (forceRefresh) return null

  const table = ENTITY_TABLE_MAP[entityType]
  const client = getServiceClient()

  // Check most recent synced_at for this realm
  const { data: latest } = await client
    .from(table)
    .select('synced_at')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .order('synced_at', { ascending: false })
    .limit(1)
    .single()

  if (!latest) return null

  const age = Date.now() - new Date(latest.synced_at).getTime()
  if (age > ENTITY_TTL_MS) return null

  // Cache is fresh — return all active rows
  const { data } = await client
    .from(table)
    .select('*')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .order('name' in (latest ?? {}) ? 'name' : 'display_name', { ascending: true })

  return data ?? null
}

/**
 * Sync accounts (Expense + Credit Card) from QBO into cache.
 */
async function syncAccounts(realmId: string, forceRefresh = false) {
  const cached = await getCachedEntities('accounts', realmId, forceRefresh)
  if (cached) {
    console.log(`[EntitySync] Accounts cache hit for realm ${realmId} (${cached.length} rows)`)
    return cached
  }

  console.log(`[EntitySync] Fetching accounts from QBO for realm ${realmId}...`)
  const query = encodeURIComponent(
    "SELECT * FROM Account WHERE AccountType IN ('Expense', 'Credit Card') AND Active = true"
  )
  const resp = await authenticatedQboFetch(`/v3/company/{realmId}/query?query=${query}`)
  if (!resp.ok) {
    const errText = await resp.text()
    console.error('[EntitySync] QBO account query failed:', resp.status, errText)
    throw new Error(`QBO account query failed: ${resp.status}`)
  }

  const body = await resp.json()
  const accounts = body?.QueryResponse?.Account ?? []

  const client = getServiceClient()
  const now = new Date().toISOString()

  if (accounts.length > 0) {
    const rows = accounts.map((a: Record<string, unknown>) => ({
      realm_id: realmId,
      qbo_id: String(a.Id),
      name: a.Name as string,
      fully_qualified_name: (a.FullyQualifiedName as string) ?? (a.Name as string),
      account_type: a.AccountType as string,
      account_sub_type: (a.AccountSubType as string) ?? null,
      is_active: true,
      synced_at: now,
    }))

    const { error } = await client
      .from('qbo_entity_accounts')
      .upsert(rows, { onConflict: 'realm_id,qbo_id' })

    if (error) console.error('[EntitySync] Account upsert error:', error)
  }

  // Return fresh data from DB
  const { data } = await client
    .from('qbo_entity_accounts')
    .select('*')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  console.log(`[EntitySync] Synced ${accounts.length} accounts, returning ${data?.length ?? 0}`)
  return data ?? []
}

/**
 * Sync classes from QBO into cache.
 */
async function syncClasses(realmId: string, forceRefresh = false) {
  const cached = await getCachedEntities('classes', realmId, forceRefresh)
  if (cached) {
    console.log(`[EntitySync] Classes cache hit for realm ${realmId} (${cached.length} rows)`)
    return cached
  }

  console.log(`[EntitySync] Fetching classes from QBO for realm ${realmId}...`)
  const query = encodeURIComponent("SELECT * FROM Class WHERE Active = true")
  const resp = await authenticatedQboFetch(`/v3/company/{realmId}/query?query=${query}`)
  if (!resp.ok) {
    const errText = await resp.text()
    console.error('[EntitySync] QBO class query failed:', resp.status, errText)
    throw new Error(`QBO class query failed: ${resp.status}`)
  }

  const body = await resp.json()
  const classes = body?.QueryResponse?.Class ?? []

  const client = getServiceClient()
  const now = new Date().toISOString()

  if (classes.length > 0) {
    const rows = classes.map((cl: Record<string, unknown>) => ({
      realm_id: realmId,
      qbo_id: String(cl.Id),
      name: cl.Name as string,
      fully_qualified_name: (cl.FullyQualifiedName as string) ?? (cl.Name as string),
      is_active: true,
      synced_at: now,
    }))

    const { error } = await client
      .from('qbo_entity_classes')
      .upsert(rows, { onConflict: 'realm_id,qbo_id' })

    if (error) console.error('[EntitySync] Class upsert error:', error)
  }

  const { data } = await client
    .from('qbo_entity_classes')
    .select('*')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  console.log(`[EntitySync] Synced ${classes.length} classes, returning ${data?.length ?? 0}`)
  return data ?? []
}

/**
 * Sync vendors from QBO into cache.
 */
async function syncVendors(realmId: string, forceRefresh = false) {
  const cached = await getCachedEntities('vendors', realmId, forceRefresh)
  if (cached) {
    console.log(`[EntitySync] Vendors cache hit for realm ${realmId} (${cached.length} rows)`)
    return cached
  }

  console.log(`[EntitySync] Fetching vendors from QBO for realm ${realmId}...`)
  const query = encodeURIComponent(
    "SELECT * FROM Vendor WHERE Active = true ORDERBY DisplayName"
  )
  const resp = await authenticatedQboFetch(`/v3/company/{realmId}/query?query=${query}`)
  if (!resp.ok) {
    const errText = await resp.text()
    console.error('[EntitySync] QBO vendor query failed:', resp.status, errText)
    throw new Error(`QBO vendor query failed: ${resp.status}`)
  }

  const body = await resp.json()
  const vendors = body?.QueryResponse?.Vendor ?? []

  const client = getServiceClient()
  const now = new Date().toISOString()

  if (vendors.length > 0) {
    const rows = vendors.map((v: Record<string, unknown>) => ({
      realm_id: realmId,
      qbo_id: String(v.Id),
      display_name: v.DisplayName as string,
      is_active: true,
      synced_at: now,
    }))

    const { error } = await client
      .from('qbo_entity_vendors')
      .upsert(rows, { onConflict: 'realm_id,qbo_id' })

    if (error) console.error('[EntitySync] Vendor upsert error:', error)
  }

  const { data } = await client
    .from('qbo_entity_vendors')
    .select('*')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .order('display_name', { ascending: true })

  console.log(`[EntitySync] Synced ${vendors.length} vendors, returning ${data?.length ?? 0}`)
  return data ?? []
}

/**
 * Invalidate all entity caches for a realm by clearing synced_at far into the past.
 */
async function invalidateAllCaches(realmId: string) {
  const client = getServiceClient()
  const oldDate = '2000-01-01T00:00:00Z'

  await Promise.all([
    client.from('qbo_entity_accounts').update({ synced_at: oldDate }).eq('realm_id', realmId),
    client.from('qbo_entity_classes').update({ synced_at: oldDate }).eq('realm_id', realmId),
    client.from('qbo_entity_vendors').update({ synced_at: oldDate }).eq('realm_id', realmId),
  ])
}

// ---------------------------------------------------------------------------
// Entity routes (Phase 3)
// ---------------------------------------------------------------------------

// GET /entities/accounts
app.get('/entities/accounts', async (c) => {
  try {
    const conn = await getActiveConnection()
    if (!conn) return c.json({ error: 'No active QBO connection' }, 400)

    const rows = await syncAccounts(conn.realm_id)
    const accounts = rows.map((r: Record<string, unknown>) => ({
      qbo_id: r.qbo_id,
      name: r.name,
      fully_qualified_name: r.fully_qualified_name,
      account_type: r.account_type,
    }))

    return c.json({ accounts })
  } catch (err) {
    console.error('[entities/accounts] Error:', err)
    return c.json({ error: 'Failed to fetch accounts' }, 500)
  }
})

// GET /entities/classes
app.get('/entities/classes', async (c) => {
  try {
    const conn = await getActiveConnection()
    if (!conn) return c.json({ error: 'No active QBO connection' }, 400)

    const rows = await syncClasses(conn.realm_id)
    const classes = rows.map((r: Record<string, unknown>) => ({
      qbo_id: r.qbo_id,
      name: r.name,
      fully_qualified_name: r.fully_qualified_name,
    }))

    return c.json({ classes })
  } catch (err) {
    console.error('[entities/classes] Error:', err)
    return c.json({ error: 'Failed to fetch classes' }, 500)
  }
})

// GET /entities/vendors
app.get('/entities/vendors', async (c) => {
  try {
    const conn = await getActiveConnection()
    if (!conn) return c.json({ error: 'No active QBO connection' }, 400)

    const rows = await syncVendors(conn.realm_id)
    const vendors = rows.map((r: Record<string, unknown>) => ({
      qbo_id: r.qbo_id,
      display_name: r.display_name,
    }))

    return c.json({ vendors })
  } catch (err) {
    console.error('[entities/vendors] Error:', err)
    return c.json({ error: 'Failed to fetch vendors' }, 500)
  }
})

// POST /entities/vendors/find-or-create
app.post('/entities/vendors/find-or-create', async (c) => {
  try {
    const conn = await getActiveConnection()
    if (!conn) return c.json({ error: 'No active QBO connection' }, 400)

    const body = await c.req.json()
    const name = (body.name ?? '').trim()
    if (!name) return c.json({ error: 'name is required' }, 400)

    const client = getServiceClient()
    const nameLower = name.toLowerCase()

    // 1. Search cache for fuzzy match
    const { data: cachedVendors } = await client
      .from('qbo_entity_vendors')
      .select('*')
      .eq('realm_id', conn.realm_id)
      .eq('is_active', true)

    const cacheMatch = (cachedVendors ?? []).find(
      (v: Record<string, unknown>) =>
        (v.display_name as string).toLowerCase() === nameLower
    )
    if (cacheMatch) {
      return c.json({
        vendor: { qbo_id: cacheMatch.qbo_id, display_name: cacheMatch.display_name },
      })
    }

    // 2. Query QBO for fuzzy match
    const query = encodeURIComponent(
      `SELECT * FROM Vendor WHERE DisplayName LIKE '%${name.replace(/'/g, "\\'")}%'`
    )
    const qboResp = await authenticatedQboFetch(`/v3/company/{realmId}/query?query=${query}`)
    if (qboResp.ok) {
      const qboBody = await qboResp.json()
      const vendors = qboBody?.QueryResponse?.Vendor ?? []
      if (vendors.length > 0) {
        const match = vendors[0]
        // Upsert into cache
        await client.from('qbo_entity_vendors').upsert(
          {
            realm_id: conn.realm_id,
            qbo_id: String(match.Id),
            display_name: match.DisplayName,
            is_active: true,
            synced_at: new Date().toISOString(),
          },
          { onConflict: 'realm_id,qbo_id' }
        )
        return c.json({
          vendor: { qbo_id: String(match.Id), display_name: match.DisplayName },
        })
      }
    }

    // 3. Create new vendor in QBO
    console.log(`[EntitySync] Creating new vendor in QBO: "${name}"`)
    const createResp = await authenticatedQboFetch(`/v3/company/{realmId}/vendor`, {
      method: 'POST',
      body: JSON.stringify({ DisplayName: name }),
    })

    if (!createResp.ok) {
      const errText = await createResp.text()
      console.error('[EntitySync] Vendor create failed:', createResp.status, errText)
      throw new Error(`Failed to create vendor: ${createResp.status}`)
    }

    const created = await createResp.json()
    const newVendor = created.Vendor

    // Upsert into cache
    await client.from('qbo_entity_vendors').upsert(
      {
        realm_id: conn.realm_id,
        qbo_id: String(newVendor.Id),
        display_name: newVendor.DisplayName,
        is_active: true,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'realm_id,qbo_id' }
    )

    return c.json({
      vendor: { qbo_id: String(newVendor.Id), display_name: newVendor.DisplayName },
    })
  } catch (err) {
    console.error('[entities/vendors/find-or-create] Error:', err)
    return c.json({ error: 'Failed to find or create vendor' }, 500)
  }
})

// POST /entities/refresh — force-invalidate all entity caches
app.post('/entities/refresh', async (c) => {
  try {
    const conn = await getActiveConnection()
    if (!conn) return c.json({ error: 'No active QBO connection' }, 400)

    await invalidateAllCaches(conn.realm_id)

    // Re-sync all entities
    await Promise.all([
      syncAccounts(conn.realm_id, true),
      syncClasses(conn.realm_id, true),
      syncVendors(conn.realm_id, true),
    ])

    return c.json({ refreshed: true })
  } catch (err) {
    console.error('[entities/refresh] Error:', err)
    return c.json({ error: 'Failed to refresh entity cache' }, 500)
  }
})

// ---------------------------------------------------------------------------
// Expense Submit (Phase 4)
// ---------------------------------------------------------------------------

// POST /expenses/:expenseId/submit — push an expense to QBO as a Purchase
app.post('/expenses/:expenseId/submit', async (c) => {
  const expenseId = c.req.param('expenseId')
  const client = getServiceClient()

  try {
    // 1. Read the expense row
    const { data: expense, error: fetchError } = await client
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .single()

    if (fetchError || !expense) {
      console.error('[submit] Expense not found:', expenseId, fetchError)
      return c.json({ error: 'Expense not found' }, 404)
    }

    // 2. Validate required QBO fields
    if (!expense.qbo_account_id || !expense.qbo_payment_account_id) {
      return c.json(
        { error: 'Missing required QBO fields (qbo_account_id, qbo_payment_account_id)' },
        400
      )
    }

    // 3. Resolve vendor — if qbo_vendor_id is null but vendor name exists, find-or-create
    let vendorId = expense.qbo_vendor_id
    if (!vendorId && expense.vendor) {
      const conn = await getActiveConnection()
      if (!conn) return c.json({ error: 'No active QBO connection' }, 400)

      // Search cache first
      const nameLower = expense.vendor.trim().toLowerCase()
      const { data: cachedVendors } = await client
        .from('qbo_entity_vendors')
        .select('qbo_id, display_name')
        .eq('realm_id', conn.realm_id)
        .eq('is_active', true)

      const cacheMatch = (cachedVendors ?? []).find(
        (v: Record<string, unknown>) =>
          (v.display_name as string).toLowerCase() === nameLower
      )

      if (cacheMatch) {
        vendorId = cacheMatch.qbo_id as string
      } else {
        // Query QBO
        const query = encodeURIComponent(
          `SELECT * FROM Vendor WHERE DisplayName = '${expense.vendor.trim().replace(/'/g, "\\'")}'`
        )
        const qboResp = await authenticatedQboFetch(`/v3/company/{realmId}/query?query=${query}`)
        if (qboResp.ok) {
          const qboBody = await qboResp.json()
          const vendors = qboBody?.QueryResponse?.Vendor ?? []
          if (vendors.length > 0) {
            vendorId = String(vendors[0].Id)
            // Upsert cache
            await client.from('qbo_entity_vendors').upsert(
              {
                realm_id: conn.realm_id,
                qbo_id: vendorId,
                display_name: vendors[0].DisplayName,
                is_active: true,
                synced_at: new Date().toISOString(),
              },
              { onConflict: 'realm_id,qbo_id' }
            )
          }
        }

        // Still no vendor? Create in QBO
        if (!vendorId) {
          console.log(`[submit] Creating vendor in QBO: "${expense.vendor}"`)
          const createResp = await authenticatedQboFetch(`/v3/company/{realmId}/vendor`, {
            method: 'POST',
            body: JSON.stringify({ DisplayName: expense.vendor.trim() }),
          })
          if (!createResp.ok) {
            const errText = await createResp.text()
            console.error('[submit] Vendor create failed:', createResp.status, errText)
            await client
              .from('expenses')
              .update({
                qbo_error: `Vendor create failed: ${createResp.status}`,
                qbo_sync_attempts: (expense.qbo_sync_attempts ?? 0) + 1,
              })
              .eq('id', expenseId)
            return c.json({ error: `Failed to create vendor: ${createResp.status}` }, 500)
          }
          const created = await createResp.json()
          vendorId = String(created.Vendor.Id)
          await client.from('qbo_entity_vendors').upsert(
            {
              realm_id: conn.realm_id,
              qbo_id: vendorId,
              display_name: created.Vendor.DisplayName,
              is_active: true,
              synced_at: new Date().toISOString(),
            },
            { onConflict: 'realm_id,qbo_id' }
          )
        }

        // Save resolved vendor ID back to expense
        await client.from('expenses').update({ qbo_vendor_id: vendorId }).eq('id', expenseId)
      }
    }

    // 4. Build QBO Purchase payload
    const lineDetail: Record<string, unknown> = {
      AccountRef: { value: expense.qbo_account_id },
    }
    if (expense.qbo_class_id) {
      lineDetail.ClassRef = { value: expense.qbo_class_id }
    }

    const purchaseBody: Record<string, unknown> = {
      PaymentType: 'CreditCard',
      AccountRef: { value: expense.qbo_payment_account_id },
      TxnDate: expense.date,
      Line: [
        {
          Amount: Number(expense.amount),
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: lineDetail,
        },
      ],
    }

    if (vendorId) {
      purchaseBody.EntityRef = { value: vendorId, type: 'Vendor' }
    }
    if (expense.memo) {
      purchaseBody.PrivateNote = expense.memo
    }

    // 5. POST to QBO
    console.log(`[submit] Creating Purchase in QBO for expense ${expenseId}`, JSON.stringify(purchaseBody))
    const resp = await authenticatedQboFetch(`/v3/company/{realmId}/purchase`, {
      method: 'POST',
      body: JSON.stringify(purchaseBody),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      console.error('[submit] QBO Purchase create failed:', resp.status, errText)

      // 7. Failure — increment attempts, store error
      await client
        .from('expenses')
        .update({
          qbo_error: `Purchase create failed: ${resp.status} - ${errText.substring(0, 500)}`,
          qbo_sync_attempts: (expense.qbo_sync_attempts ?? 0) + 1,
        })
        .eq('id', expenseId)

      return c.json({ error: `QBO Purchase create failed: ${resp.status}` }, 500)
    }

    const result = await resp.json()
    const purchaseId = result?.Purchase?.Id

    // 6. Attempt to attach receipt image (non-fatal)
    let attachmentId: string | null = null
    if (expense.image_url) {
      try {
        console.log(`[submit] Downloading receipt image for attachment: ${expense.image_url}`)
        const imgResp = await fetch(expense.image_url)
        if (imgResp.ok) {
          const imageBytes = new Uint8Array(await imgResp.arrayBuffer())
          const contentType = imgResp.headers.get('content-type') || 'image/jpeg'
          // Extract filename from URL
          const urlPath = new URL(expense.image_url).pathname
          const fileName = urlPath.split('/').pop() || `receipt_${expenseId}.jpg`

          attachmentId = await qboUploadAttachment(
            String(purchaseId),
            fileName,
            imageBytes,
            contentType
          )
          if (attachmentId) {
            console.log(`[submit] Receipt attached: ${attachmentId}`)
          } else {
            console.warn('[submit] Attachment upload returned null (non-fatal)')
          }
        } else {
          console.warn(`[submit] Failed to download receipt image: ${imgResp.status}`)
        }
      } catch (attachErr) {
        console.error('[submit] Attachment upload failed (non-fatal):', attachErr)
      }
    }

    // 7. Success — update expense row
    const pushedAt = new Date().toISOString()
    await client
      .from('expenses')
      .update({
        qbo_purchase_id: String(purchaseId),
        qbo_pushed_at: pushedAt,
        qbo_error: null,
        qbo_sync_attempts: (expense.qbo_sync_attempts ?? 0) + 1,
        qbo_attachment_id: attachmentId,
      })
      .eq('id', expenseId)

    console.log(`[submit] Purchase created: ${purchaseId} for expense ${expenseId}`)
    return c.json({ purchase_id: String(purchaseId), pushed_at: pushedAt, attachment_id: attachmentId })
  } catch (err) {
    console.error('[submit] Unexpected error:', err)

    // Best-effort: store error on expense row
    await client
      .from('expenses')
      .update({
        qbo_error: `Unexpected: ${err instanceof Error ? err.message : String(err)}`,
      })
      .eq('id', expenseId)
      .then(() => {}, () => {})

    return c.json({ error: 'Failed to submit expense to QBO' }, 500)
  }
})

// ---------------------------------------------------------------------------
// 7. Error handling
// ---------------------------------------------------------------------------

app.onError((err, c) => {
  console.error(`[onError] ${c.req.method} ${c.req.path}`, err)
  const isDev = Deno.env.get('DENO_ENV') !== 'production'
  return c.json(
    {
      error: 'Internal Server Error',
      message: isDev ? err.message : 'An unexpected error occurred',
    },
    500
  )
})

app.notFound((c) => {
  return c.json({ error: 'Not Found', message: 'Route not found' }, 404)
})

// ---------------------------------------------------------------------------
// 8. Server bootstrap
// ---------------------------------------------------------------------------
Deno.serve(app.fetch)

// Export helpers for use in route handlers added by future plans
export { getServiceClient, qboFetch, authenticatedQboFetch, getValidAccessToken }
