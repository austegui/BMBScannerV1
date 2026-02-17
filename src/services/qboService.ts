// QBO service module for communicating with the QBO Edge Function.
// NOTE: /auth/start and /connection/status are excluded from JWT middleware in Plan 02.
// No Authorization header is sent for these endpoints.

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()

export interface ConnectionStatus {
  connected: boolean
  company_name: string | null
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/connection/status`
  )
  if (!response.ok) {
    console.error('[QBO] Failed to check connection status:', response.status)
    return { connected: false, company_name: null }
  }
  return response.json()
}

export async function startOAuthFlow(): Promise<void> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/qbo-api/auth/start`
  )
  if (!response.ok) {
    throw new Error('Failed to start OAuth flow')
  }
  const { url } = await response.json()
  window.location.href = url
}
