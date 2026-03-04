// QBD service module for communicating with the Edge Function.
// Adapted from QBO REST API to QBD queue-based architecture.
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

// ---------------------------------------------------------------------------
// Connection status (QBD — no OAuth, just sync status)
// ---------------------------------------------------------------------------

export interface ConnectionStatus {
  connected: boolean
  company_name: string | null
  last_sync_at: string | null
  sync_interval_minutes: number | null
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/connection/status`,
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) {
    console.error('[QBD] Failed to check connection status:', response.status)
    return {
      connected: false,
      company_name: null,
      last_sync_at: null,
      sync_interval_minutes: null,
    }
  }
  return response.json()
}

// ---------------------------------------------------------------------------
// Entity types (same cache tables, populated by QBWC sync)
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
    console.error('[QBD] Failed to fetch accounts:', response.status)
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
    console.error('[QBD] Failed to fetch classes:', response.status)
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
    console.error('[QBD] Failed to fetch vendors:', response.status)
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
// Expense Submit (QBD — queue-based, not real-time)
// ---------------------------------------------------------------------------

export interface SubmitExpenseResult {
  status: 'queued'
  queue_id: string
  message: string
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
// Queue status check
// ---------------------------------------------------------------------------

export interface QueueStatus {
  id: string
  status: 'pending' | 'sent' | 'completed' | 'failed'
  error_message: string | null
  created_at: string
  sent_at: string | null
  completed_at: string | null
}

export async function getQueueStatus(queueId: string): Promise<QueueStatus | null> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/queue/${queueId}/status`,
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) return null
  return response.json()
}
