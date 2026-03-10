import { useState, useEffect } from 'react';
import { getUsers, inviteUser, updateUserRole, updateUserStatus, UserProfile } from '../services/adminService';
import { useToast } from './Toast';

export function AdminUserList() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', password: '', role: 'user' });
  const [inviting, setInviting] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch {
      toast('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.password) return;

    setInviting(true);
    try {
      await inviteUser(inviteForm);
      toast('success', `User ${inviteForm.email} created`);
      setInviteForm({ email: '', full_name: '', password: '', role: 'user' });
      setShowInvite(false);
      loadUsers();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (user: UserProfile, newRole: string) => {
    try {
      await updateUserRole(user.id, newRole);
      toast('success', `${user.email} is now ${newRole}`);
      loadUsers();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleStatusToggle = async (user: UserProfile) => {
    try {
      await updateUserStatus(user.id, !user.is_active);
      toast('success', `${user.email} ${user.is_active ? 'deactivated' : 'activated'}`);
      loadUsers();
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  if (loading) return <p style={{ padding: '1rem', color: '#6b7280' }}>Loading users...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#374151' }}>Users ({users.length})</h3>
        <button
          onClick={() => setShowInvite(!showInvite)}
          style={{
            padding: '6px 12px', fontSize: '0.8125rem', fontWeight: '600',
            backgroundColor: '#2563eb', color: '#fff', border: 'none',
            borderRadius: '6px', cursor: 'pointer',
          }}
        >
          + Add User
        </button>
      </div>

      {showInvite && (
        <form onSubmit={handleInvite} style={{
          padding: '1rem', marginBottom: '1rem', backgroundColor: '#f9fafb',
          borderRadius: '8px', border: '1px solid #e5e7eb',
        }}>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <input
              type="email" placeholder="Email" required value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              style={inputStyle}
            />
            <input
              type="text" placeholder="Full Name" value={inviteForm.full_name}
              onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
              style={inputStyle}
            />
            <input
              type="text" placeholder="Temporary Password" required minLength={6}
              value={inviteForm.password}
              onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))}
              style={inputStyle}
            />
            <select
              value={inviteForm.role}
              onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))}
              style={inputStyle}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" disabled={inviting} style={{
                padding: '8px 16px', fontSize: '0.8125rem', fontWeight: '600',
                backgroundColor: inviting ? '#93c5fd' : '#2563eb', color: '#fff',
                border: 'none', borderRadius: '6px', cursor: inviting ? 'not-allowed' : 'pointer',
              }}>
                {inviting ? 'Creating...' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowInvite(false)} style={{
                padding: '8px 16px', fontSize: '0.8125rem',
                backgroundColor: '#fff', color: '#6b7280',
                border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {users.map(user => (
          <div key={user.id} style={{
            padding: '0.75rem 1rem', backgroundColor: '#fff',
            border: '1px solid #e5e7eb', borderRadius: '8px',
            opacity: user.is_active ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.875rem', color: '#111827' }}>
                  {user.full_name || user.email}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{user.email}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  padding: '2px 8px', fontSize: '0.6875rem', fontWeight: '600',
                  borderRadius: '9999px',
                  backgroundColor: user.role === 'admin' ? '#dbeafe' : '#f3f4f6',
                  color: user.role === 'admin' ? '#1d4ed8' : '#6b7280',
                }}>
                  {user.role}
                </span>
                {!user.is_active && (
                  <span style={{
                    padding: '2px 8px', fontSize: '0.6875rem', fontWeight: '600',
                    borderRadius: '9999px', backgroundColor: '#fef2f2', color: '#dc2626',
                  }}>
                    inactive
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => handleRoleChange(user, user.role === 'admin' ? 'user' : 'admin')}
                style={smallBtnStyle}
              >
                Make {user.role === 'admin' ? 'User' : 'Admin'}
              </button>
              <button onClick={() => handleStatusToggle(user)} style={smallBtnStyle}>
                {user.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: '0.875rem', border: '1px solid #d1d5db',
  borderRadius: '6px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px', fontSize: '0.6875rem', color: '#6b7280',
  backgroundColor: '#fff', border: '1px solid #d1d5db',
  borderRadius: '4px', cursor: 'pointer',
};
