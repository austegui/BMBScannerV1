import { useState, useEffect } from 'react';
import { getQueueOverview, QueueOverview } from '../services/adminService';
import { useToast } from './Toast';

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  sent: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
};

export function AdminSyncQueue() {
  const { toast } = useToast();
  const [data, setData] = useState<QueueOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const overview = await getQueueOverview();
        setData(overview);
      } catch {
        toast('error', 'Failed to load queue');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ padding: '1rem', color: '#6b7280' }}>Loading queue...</p>;
  if (!data) return <p style={{ padding: '1rem', color: '#ef4444' }}>Failed to load queue data</p>;

  return (
    <div>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#374151' }}>Sync Queue</h3>

      {/* Status counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {Object.entries(data.counts).map(([status, count]) => (
          <div key={status} style={{
            padding: '0.75rem', textAlign: 'center',
            backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: statusColors[status] || '#6b7280' }}>
              {count}
            </div>
            <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'capitalize' }}>
              {status}
            </div>
          </div>
        ))}
      </div>

      {/* Recent items */}
      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#374151' }}>Recent Items</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {data.recent.map(item => (
          <div key={item.id} style={{
            padding: '0.5rem 0.75rem', backgroundColor: '#fff',
            border: '1px solid #e5e7eb', borderRadius: '6px',
            fontSize: '0.75rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>
                {item.request_type}
              </span>
              <span style={{
                padding: '1px 6px', fontSize: '0.625rem', fontWeight: '600',
                borderRadius: '9999px',
                backgroundColor: `${statusColors[item.status] || '#6b7280'}20`,
                color: statusColors[item.status] || '#6b7280',
              }}>
                {item.status}
              </span>
            </div>
            {item.related_id && (
              <div style={{ color: '#9ca3af', fontSize: '0.6875rem', marginTop: '2px' }}>
                {item.related_id.length > 40 ? item.related_id.slice(0, 40) + '...' : item.related_id}
              </div>
            )}
            {item.error_message && (
              <div style={{ color: '#dc2626', fontSize: '0.6875rem', marginTop: '2px' }}>
                {item.error_message}
              </div>
            )}
            <div style={{ color: '#d1d5db', fontSize: '0.625rem', marginTop: '2px' }}>
              {new Date(item.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {data.recent.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', padding: '1rem' }}>
            Queue is empty
          </p>
        )}
      </div>
    </div>
  );
}
