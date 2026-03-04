import { useState, useEffect } from 'react'
import { getConnectionStatus, ConnectionStatus } from '../services/qboService'

export function QboConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkStatus()
    // Poll connection status every 60 seconds to keep last_sync_at fresh
    const interval = setInterval(checkStatus, 60_000)
    return () => clearInterval(interval)
  }, [])

  async function checkStatus() {
    setLoading(true)
    try {
      const s = await getConnectionStatus()
      setStatus(s)
    } catch (err) {
      console.error('[QBD] Status check failed:', err)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !status) {
    return (
      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Checking...</span>
    )
  }

  if (!status?.connected) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          fontSize: '0.75rem',
          fontWeight: '500',
          padding: '3px 10px',
          borderRadius: '9999px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ width: '7px', height: '7px', backgroundColor: '#ef4444', borderRadius: '50%', display: 'inline-block' }} />
        QB Desktop not connected
      </span>
    )
  }

  const lastSync = status.last_sync_at ? formatTimeAgo(status.last_sync_at) : 'Never'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
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
        QB Desktop{status.company_name ? `: ${status.company_name}` : ''}
      </span>
      <span style={{ fontSize: '0.65rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
        Last synced: {lastSync}
      </span>
    </div>
  )
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
