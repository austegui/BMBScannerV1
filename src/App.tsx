import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { CameraCapture } from './components/CameraCapture';
import { ExpenseList } from './components/ExpenseList';
import { QboConnectionStatus } from './components/QboConnectionStatus';

type View = 'list' | 'scan';

function AppContent() {
  const { user, isAdmin, signOut, initials } = useAuth();
  const [view, setView] = useState<View>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleScanComplete = () => {
    setRefreshTrigger(prev => prev + 1);
    setView('list');
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f9fafb'
    }}>
      <header style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#111827'
        }}>
          Receipt Scanner
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{initials}</span>
          <QboConnectionStatus isAdmin={isAdmin} />
          <button
            onClick={() => signOut()}
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main style={{
        flex: 1,
        maxWidth: '600px',
        width: '100%',
        margin: '0 auto',
        backgroundColor: '#ffffff',
        minHeight: 'calc(100vh - 60px)'
      }}>
        {view === 'list' ? (
          <ExpenseList
            onScanNew={() => setView('scan')}
            refreshTrigger={refreshTrigger}
            isAdmin={isAdmin}
          />
        ) : (
          <CameraCapture
            onComplete={handleScanComplete}
            onCancel={() => setView('list')}
            userInitials={initials}
            userId={user.id}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
