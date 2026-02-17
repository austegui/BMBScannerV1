import { useState, useEffect } from 'react'
import { getConnectionStatus, startOAuthFlow } from '../services/qboService'

interface QboConnectionStatusProps {
  // TODO: Replace with real admin check when Supabase Auth is added.
  isAdmin: boolean
}

export function QboConnectionStatus({ isAdmin }: QboConnectionStatusProps) {
  const [connected, setConnected] = useState(false)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    // Check URL params from OAuth callback redirect
    const params = new URLSearchParams(window.location.search)
    const qboConnected = params.get('qbo_connected')
    const qboError = params.get('qbo_error')

    // Clean URL params after reading (avoid showing stale params on refresh)
    if (qboConnected || qboError) {
      const cleanUrl =
        window.location.pathname +
        window.location.search
          .replace(/[?&]qbo_connected=[^&]*/g, '')
          .replace(/[?&]qbo_error=[^&]*/g, '')
          .replace(/^&/, '?')
      window.history.replaceState({}, '', cleanUrl || window.location.pathname)
    }

    if (qboError) {
      const messages: Record<string, string> = {
        invalid_state: 'OAuth session expired or invalid. Please try again.',
        token_exchange_failed: 'Failed to connect to QuickBooks. Please try again.',
      }
      setError(messages[qboError] ?? `Connection error: ${qboError}`)
    }

    if (qboConnected === 'true') {
      setSuccessMessage('Successfully connected to QuickBooks!')
      setTimeout(() => setSuccessMessage(null), 5000)
    }

    // Load connection status from Edge Function
    checkStatus()
  }, [])

  async function checkStatus() {
    setLoading(true)
    setError(null)
    try {
      const status = await getConnectionStatus()
      setConnected(status.connected)
      setCompanyName(status.company_name)
    } catch (err) {
      console.error('[QBO] Status check failed:', err)
      setConnected(false)
      setCompanyName(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleConnect() {
    setError(null)
    try {
      await startOAuthFlow()
    } catch (err) {
      console.error('[QBO] OAuth flow start failed:', err)
      setError('Failed to start QuickBooks connection. Please try again.')
    }
  }

  // Admin gate — only admins see this component
  if (!isAdmin) return null

  if (loading) {
    return (
      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Checking...</span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      {successMessage && (
        <span style={{ fontSize: '0.7rem', color: '#166534', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '9999px' }}>
          {successMessage}
        </span>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>{error}</span>
          <button
            onClick={checkStatus}
            style={{
              fontSize: '0.7rem',
              color: '#2563eb',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {connected ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: '#dcfce7',
            color: '#166534',
            fontSize: '0.75rem',
            fontWeight: '500',
            padding: '3px 10px',
            borderRadius: '9999px',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ width: '7px', height: '7px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
          Connected to QuickBooks{companyName ? `: ${companyName}` : ''}
        </span>
      ) : (
        !error && (
          <button
            onClick={handleConnect}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#2e7d32',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: '500',
              padding: '5px 12px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Connect to QuickBooks
          </button>
        )
      )}
    </div>
  )
}
