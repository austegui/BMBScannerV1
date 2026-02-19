import { useState } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { ExpenseList } from './components/ExpenseList';
import { QboConnectionStatus } from './components/QboConnectionStatus';
import { LoginPage } from './components/LoginPage';
import { useAuth } from './hooks/useAuth';

type View = 'list' | 'scan';

function App() {
  const { session, loading, signIn, signOut } = useAuth();
  const [view, setView] = useState<View>('list');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleScanComplete = () => {
    setRefreshTrigger(prev => prev + 1);
    setView('list');
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
      }}>
        <p style={{ color: '#6b7280' }}>Loading...</p>
      </div>
    );
  }

  // Not authenticated — show login
  if (!session) {
    return <LoginPage onSignIn={signIn} />;
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
          <QboConnectionStatus />
          <button
            onClick={signOut}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              color: '#6b7280',
              backgroundColor: 'transparent',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Logout
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
          />
        ) : (
          <CameraCapture
            onComplete={handleScanComplete}
            onCancel={() => setView('list')}
          />
        )}
      </main>
    </div>
  );
}

export default App;
