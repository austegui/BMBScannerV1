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
// Routes excluded from JWT verification:
//   /auth/callback  -- browser redirect from QBO, no Authorization header possible
//   /auth/start     -- Phase 1 has no Supabase Auth, frontend sends anon key (not a JWT)
//   /connection/status -- Phase 1 has no Supabase Auth, frontend sends anon key (not a JWT)
//
// TODO(Phase 2): Remove /auth/start and /connection/status from exclusion list
// when Supabase Auth is wired. Only /auth/callback should remain permanently excluded.
// ---------------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`

const AUTH_EXCLUDED_SUFFIXES = ['/auth/callback', '/auth/start', '/connection/status']

app.use('*', async (c, next) => {
  const path = c.req.path

  // Skip JWT verification for excluded paths
  if (AUTH_EXCLUDED_SUFFIXES.some((suffix) => path.endsWith(suffix))) {
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
// 6. Routes
// ---------------------------------------------------------------------------

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ---------------------------------------------------------------------------
// OAuth routes (Plan 01-03)
// ---------------------------------------------------------------------------

// In-memory CSRF state store. Single-company admin-only flow — in-memory is acceptable.
// State entries expire after 10 minutes.
const pendingStates = new Map<string, number>()
const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function cleanExpiredStates() {
  const now = Date.now()
  for (const [state, timestamp] of pendingStates.entries()) {
    if (now - timestamp > STATE_TTL_MS) {
      pendingStates.delete(state)
    }
  }
}

// GET /auth/start
// Generate QBO OAuth authorization URL and return it to the frontend.
app.get('/auth/start', (c) => {
  cleanExpiredStates()

  const state = crypto.randomUUID()
  pendingStates.set(state, Date.now())

  const clientId = Deno.env.get('QBO_CLIENT_ID') ?? ''
  const redirectUri = Deno.env.get('QBO_REDIRECT_URI') ?? ''

  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
  authUrl.searchParams.set('state', state)

  console.log(`[OAuth] /auth/start generated state=${state}`)

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

    // Validate state (CSRF protection)
    if (!state || !pendingStates.has(state)) {
      console.warn(`[OAuth] Invalid or expired state: ${state}`)
      return c.redirect(`${frontendUrl}?qbo_error=invalid_state`)
    }

    const stateTimestamp = pendingStates.get(state)!
    pendingStates.delete(state) // One-time use

    if (Date.now() - stateTimestamp > STATE_TTL_MS) {
      console.warn(`[OAuth] Expired state: ${state}`)
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

    // Store tokens in Vault using service_role client
    const serviceClient = getServiceClient()

    const { data: accessVaultId, error: accessVaultError } = await serviceClient.rpc(
      'create_vault_secret',
      { secret: access_token, name: 'qbo_access_token' }
    )

    if (accessVaultError) {
      console.error('[OAuth] Failed to store access token in Vault:', accessVaultError)
      return c.redirect(`${frontendUrl}?qbo_error=token_exchange_failed`)
    }

    const { data: refreshVaultId, error: refreshVaultError } = await serviceClient.rpc(
      'create_vault_secret',
      { secret: refresh_token, name: 'qbo_refresh_token' }
    )

    if (refreshVaultError) {
      console.error('[OAuth] Failed to store refresh token in Vault:', refreshVaultError)
      return c.redirect(`${frontendUrl}?qbo_error=token_exchange_failed`)
    }

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

    // Upsert connection record
    const { error: upsertError } = await serviceClient.from('qbo_connection').upsert(
      {
        realm_id: realmId,
        company_name: companyName,
        token_vault_id: accessVaultId,
        refresh_token_vault_id: refreshVaultId,
        token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        token_issued_at: new Date().toISOString(),
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
// Return whether QBO is connected and the company name.
// Safe for frontend consumption — never returns tokens.
app.get('/connection/status', async (c) => {
  try {
    const serviceClient = getServiceClient()

    const { data } = await serviceClient
      .from('qbo_connection')
      .select('company_name, is_active, connected_at')
      .eq('is_active', true)
      .single()

    if (!data) {
      return c.json({ connected: false, company_name: null })
    }

    return c.json({ connected: true, company_name: data.company_name ?? null })
  } catch (err) {
    console.error('[connection/status] Error:', err)
    return c.json({ connected: false, company_name: null })
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
export { getServiceClient, qboFetch }
