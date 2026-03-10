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
// Types
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  updated_at?: string
}

export interface AdminExpense {
  id: string
  user_id: string
  vendor: string
  date: string
  amount: number
  category: string
  payment_method: string
  memo: string | null
  qbd_sync_status: string | null
  qbo_error: string | null
  created_at: string
  profiles?: { email: string; full_name: string } | null
}

export interface QueueItem {
  id: string
  request_type: string
  related_id: string | null
  status: string
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface QueueOverview {
  counts: Record<string, number>
  recent: QueueItem[]
}

export interface SystemHealth {
  connection: {
    connected: boolean
    company_name?: string | null
    last_sync_at?: string | null
  }
  cache: { accounts: number; classes: number; vendors: number }
  expenses: { total: number; synced: number; queued: number; failed: number }
  users: number
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function getMyProfile(): Promise<UserProfile | null> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/me/profile`,
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) return null
  return response.json()
}

export async function getUsers(): Promise<UserProfile[]> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/admin/users`,
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) throw new Error('Failed to fetch users')
  const data = await response.json()
  return data.users ?? []
}

export async function inviteUser(params: {
  email: string
  full_name: string
  password: string
  role: string
}): Promise<{ id: string; email: string }> {
  const headers = await getAuthHeaders()
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/admin/users/invite`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to invite user')
  }
  const data = await response.json()
  return data.user
}

export async function updateUserRole(userId: string, role: string): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/admin/users/${userId}/role`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to update role')
  }
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<void> {
  const headers = await getAuthHeaders()
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/admin/users/${userId}/status`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    }
  )
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to update status')
  }
}

export async function getAdminExpenses(): Promise<AdminExpense[]> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/admin/expenses`,
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) throw new Error('Failed to fetch expenses')
  const data = await response.json()
  return data.expenses ?? []
}

export async function getQueueOverview(): Promise<QueueOverview> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/admin/queue`,
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) throw new Error('Failed to fetch queue')
  return response.json()
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/admin/health`,
    { headers: await getAuthHeaders() }
  )
  if (!response.ok) throw new Error('Failed to fetch health')
  return response.json()
}
