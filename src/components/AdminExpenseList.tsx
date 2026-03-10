import { useState, useEffect } from 'react';
import { getAdminExpenses, AdminExpense } from '../services/adminService';
import { useToast } from './Toast';

const statusColors: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#f3f4f6', color: '#6b7280' },
  queued: { bg: '#fef9c3', color: '#a16207' },
  synced: { bg: '#dcfce7', color: '#15803d' },
  failed: { bg: '#fef2f2', color: '#dc2626' },
};

export function AdminExpenseList() {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<AdminExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getAdminExpenses();
        setExpenses(data);
      } catch {
        toast('error', 'Failed to load expenses');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ padding: '1rem', color: '#6b7280' }}>Loading expenses...</p>;

  const userEmails = [...new Set(expenses.map(e => e.profiles?.email || 'Unknown'))];

  const filtered = filterUser
    ? expenses.filter(e => (e.profiles?.email || '') === filterUser)
    : expenses;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>
          All Expenses ({filtered.length})
        </h3>
        <select
          value={filterUser}
          onChange={e => setFilterUser(e.target.value)}
          style={{
            padding: '4px 8px', fontSize: '0.75rem', border: '1px solid #d1d5db',
            borderRadius: '4px', backgroundColor: '#fff',
          }}
        >
          <option value="">All users</option>
          {userEmails.map(email => (
            <option key={email} value={email}>{email}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.map(exp => {
          const status = exp.qbd_sync_status || 'pending';
          const colors = statusColors[status] || statusColors.pending;
          return (
            <div key={exp.id} style={{
              padding: '0.75rem 1rem', backgroundColor: '#fff',
              border: '1px solid #e5e7eb', borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#111827' }}>
                    {exp.vendor}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                    {exp.date} &middot; {exp.category}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: '2px' }}>
                    By: {exp.profiles?.full_name || exp.profiles?.email || 'Unknown'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.875rem', color: '#111827' }}>
                    ${Number(exp.amount).toFixed(2)}
                  </div>
                  <span style={{
                    display: 'inline-block', marginTop: '4px',
                    padding: '2px 8px', fontSize: '0.6875rem', fontWeight: '600',
                    borderRadius: '9999px', backgroundColor: colors.bg, color: colors.color,
                  }}>
                    {status}
                  </span>
                </div>
              </div>
              {exp.qbo_error && (
                <div style={{
                  marginTop: '0.5rem', padding: '4px 8px',
                  fontSize: '0.6875rem', color: '#dc2626',
                  backgroundColor: '#fef2f2', borderRadius: '4px',
                }}>
                  {exp.qbo_error}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', padding: '2rem' }}>
            No expenses found
          </p>
        )}
      </div>
    </div>
  );
}
