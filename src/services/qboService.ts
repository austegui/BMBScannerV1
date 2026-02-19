// QBO service module for communicating with the QBO Edge Function.
// Sends the user's Supabase Auth JWT as Authorization header.

import { supabase } from './supabase'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()

async function getAuthHeaders(): Promise<HeadersInit> {
  const session = (await supabase?.auth.getSession())?.data?.session
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` }
  }
  return {}
}

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
    { headers: await getAuthHeaders() }
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
    { method: 'POST', headers: await getAuthHeaders() }
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
    { headers: await getAuthHeaders() }
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
    { headers: await getAuthHeaders() }
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
    { headers: await getAuthHeaders() }
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
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) {
    console.error('[QBO] Failed to fetch vendors:', response.status)
    return []
  }
  const data = await response.json()
  return data.vendors ?? []
}

export async function findOrCreateVendor(name: string): Promise<QboVendor> {
  const headers = await getAuthHeaders()
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/entities/vendors/find-or-create`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
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
    { method: 'POST', headers: await getAuthHeaders() }
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
  attachment_id: string | null
}

export async function submitExpenseToQbo(expenseId: string): Promise<SubmitExpenseResult> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/expenses/${expenseId}/submit`,
    { method: 'POST', headers: await getAuthHeaders() }
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
    { method: 'POST', headers: await getAuthHeaders() }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to approve expense')
  }
}

export async function rejectExpense(expenseId: string): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/expenses/${expenseId}/reject`,
    { method: 'POST', headers: await getAuthHeaders() }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to reject expense')
  }
}
