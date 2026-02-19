// QBO service module for communicating with the QBO Edge Function.
// NOTE: /auth/start and /connection/status are excluded from JWT middleware in Plan 02.
// No Authorization header is sent for these endpoints.

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

const authHeaders: HeadersInit = supabaseAnonKey
  ? { Authorization: `Bearer ${supabaseAnonKey}` }
  : {}

export interface ConnectionStatus {
  connected: boolean
  company_name: string | null
  token_healthy: boolean
  refresh_token_warning: boolean
  refresh_token_expires_at: string | null
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/connection/status`,
    { headers: authHeaders }
  )
  if (!response.ok) {
    console.error('[QBO] Failed to check connection status:', response.status)
    return {
      connected: false,
      company_name: null,
      token_healthy: false,
      refresh_token_warning: false,
      refresh_token_expires_at: null,
    }
  }
  return response.json()
}

export async function disconnectQbo(): Promise<boolean> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/connection/disconnect`,
    { method: 'POST', headers: authHeaders }
  )
  if (!response.ok) {
    console.error('[QBO] Failed to disconnect:', response.status)
    return false
  }
  const data = await response.json()
  return data.disconnected === true
}

export async function startOAuthFlow(): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/auth/start`,
    { headers: authHeaders }
  )
  if (!response.ok) {
    throw new Error('Failed to start OAuth flow')
  }
  const { url } = await response.json()
  window.location.href = url
}

// ---------------------------------------------------------------------------
// Entity types (Phase 3)
// ---------------------------------------------------------------------------

export interface QboAccount {
  qbo_id: string
  name: string
  fully_qualified_name: string
  account_type: string
}

export interface QboClass {
  qbo_id: string
  name: string
  fully_qualified_name: string
}

export interface QboVendor {
  qbo_id: string
  display_name: string
}

export async function getQboAccounts(): Promise<QboAccount[]> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/entities/accounts`,
    { headers: authHeaders }
  )
  if (!response.ok) {
    console.error('[QBO] Failed to fetch accounts:', response.status)
    return []
  }
  const data = await response.json()
  return data.accounts ?? []
}

export async function getQboClasses(): Promise<QboClass[]> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/entities/classes`,
    { headers: authHeaders }
  )
  if (!response.ok) {
    console.error('[QBO] Failed to fetch classes:', response.status)
    return []
  }
  const data = await response.json()
  return data.classes ?? []
}

export async function getQboVendors(): Promise<QboVendor[]> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/entities/vendors`,
    { headers: authHeaders }
  )
  if (!response.ok) {
    console.error('[QBO] Failed to fetch vendors:', response.status)
    return []
  }
  const data = await response.json()
  return data.vendors ?? []
}

export async function findOrCreateVendor(name: string): Promise<QboVendor> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/entities/vendors/find-or-create`,
    {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }
  )
  if (!response.ok) {
    throw new Error('Failed to find or create vendor')
  }
  const data = await response.json()
  return data.vendor
}

export async function refreshEntityCache(): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/entities/refresh`,
    { method: 'POST', headers: authHeaders }
  )
  if (!response.ok) {
    throw new Error('Failed to refresh entity cache')
  }
}

// ---------------------------------------------------------------------------
// Expense Submit (Phase 4)
// ---------------------------------------------------------------------------

export interface SubmitExpenseResult {
  purchase_id: string
  pushed_at: string
}

export async function submitExpenseToQbo(expenseId: string): Promise<SubmitExpenseResult> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/expenses/${expenseId}/submit`,
    { method: 'POST', headers: authHeaders }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `Submit failed: ${response.status}`)
  }
  return response.json()
}

// ---------------------------------------------------------------------------
// Admin: Approve / Reject previous-month expenses
// ---------------------------------------------------------------------------

export async function approveExpense(expenseId: string): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/expenses/${expenseId}/approve`,
    { method: 'POST', headers: authHeaders }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to approve expense')
  }
}

export async function rejectExpense(expenseId: string): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/expenses/${expenseId}/reject`,
    { method: 'POST', headers: authHeaders }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to reject expense')
  }
}
