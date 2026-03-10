import { useState } from 'react';
import { AdminUserList } from './AdminUserList';
import { AdminExpenseList } from './AdminExpenseList';
import { AdminSyncQueue } from './AdminSyncQueue';
import { AdminSystemHealth } from './AdminSystemHealth';

type Tab = 'users' | 'expenses' | 'queue' | 'health';

const tabs: { key: Tab; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'queue', label: 'Sync Queue' },
  { key: 'health', label: 'Health' },
];

interface AdminDashboardProps {
  onBack: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  return (
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button
          onClick={onBack}
          style={{
            padding: '4px 10px', fontSize: '0.75rem', color: '#6b7280',
            backgroundColor: 'transparent', border: '1px solid #d1d5db',
            borderRadius: '4px', cursor: 'pointer',
          }}
        >
          Back
        </button>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
          Admin Dashboard
        </h2>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '0', marginBottom: '1rem',
        borderBottom: '1px solid #e5e7eb',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px', fontSize: '0.8125rem', fontWeight: '500',
              color: activeTab === tab.key ? '#2563eb' : '#6b7280',
              backgroundColor: 'transparent', border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer', transition: 'color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'users' && <AdminUserList />}
      {activeTab === 'expenses' && <AdminExpenseList />}
      {activeTab === 'queue' && <AdminSyncQueue />}
      {activeTab === 'health' && <AdminSystemHealth />}
    </div>
  );
}
