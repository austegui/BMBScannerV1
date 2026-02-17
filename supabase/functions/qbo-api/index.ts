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

// OAuth routes (Plan 01-03)
// app.get('/auth/start', ...)
// app.get('/auth/callback', ...)
// app.get('/connection/status', ...)

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
