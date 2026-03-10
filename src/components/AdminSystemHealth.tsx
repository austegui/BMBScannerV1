import { useState, useEffect } from 'react';
import { getSystemHealth, SystemHealth } from '../services/adminService';
import { useToast } from './Toast';

export function AdminSystemHealth() {
  const { toast } = useToast();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getSystemHealth();
        setHealth(data);
      } catch {
        toast('error', 'Failed to load health data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ padding: '1rem', color: '#6b7280' }}>Loading...</p>;
  if (!health) return <p style={{ padding: '1rem', color: '#ef4444' }}>Failed to load</p>;

  const timeSince = (iso: string | null | undefined) => {
    if (!iso) return 'Never';
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h ago`;
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#374151' }}>System Health</h3>

      {/* Connection */}
      <Section title="QB Desktop Connection">
        <Row label="Status" value={health.connection.connected ? 'Connected' : 'Disconnected'}
          valueColor={health.connection.connected ? '#22c55e' : '#ef4444'} />
        {health.connection.company_name && (
          <Row label="Company" value={health.connection.company_name} />
        )}
        <Row label="Last Sync" value={timeSince(health.connection.last_sync_at)} />
      </Section>

      {/* Entity Cache */}
      <Section title="Entity Cache">
        <Row label="Accounts" value={String(health.cache.accounts)} />
        <Row label="Classes" value={String(health.cache.classes)} />
        <Row label="Vendors" value={String(health.cache.vendors)} />
      </Section>

      {/* Expenses */}
      <Section title="Expenses">
        <Row label="Total" value={String(health.expenses.total)} />
        <Row label="Synced" value={String(health.expenses.synced)} valueColor="#22c55e" />
        <Row label="Queued" value={String(health.expenses.queued)} valueColor="#f59e0b" />
        <Row label="Failed" value={String(health.expenses.failed)} valueColor="#ef4444" />
      </Section>

      {/* Users */}
      <Section title="Users">
        <Row label="Total Users" value={String(health.users)} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: '1rem', padding: '0.75rem 1rem',
      backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
    }}>
      <div style={{ fontWeight: '600', fontSize: '0.8125rem', color: '#374151', marginBottom: '0.5rem' }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '4px 0', fontSize: '0.8125rem',
    }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: '600', color: valueColor || '#111827' }}>{value}</span>
    </div>
  );
}
