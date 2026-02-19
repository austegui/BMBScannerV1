import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

type Mode = 'login' | 'signup';

export function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signUp, error, loading, clearError } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        if (!fullName.trim()) {
          throw new Error('Full name is required');
        }
        await signUp(email, password, fullName.trim());
      }
    } catch {
      // Error set in context
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
      }}>
        <span style={{ color: '#6b7280' }}>Loading...</span>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          color: '#111827',
          marginBottom: '0.5rem',
        }}>
          Receipt Scanner
        </h1>
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          marginBottom: '1.5rem',
        }}>
          {mode === 'login' ? 'Sign in to continue' : 'Create your staff account'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="fullName" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.375rem',
              }}>
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Sarah Jones"
                autoComplete="name"
                required={mode === 'signup'}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                }}
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Your initials (e.g. SJ) will be used on expense memos
              </p>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.375rem',
            }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                fontSize: '1rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.375rem',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '0.625rem 2.5rem 0.625rem 0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <p style={{
              fontSize: '0.875rem',
              color: '#dc2626',
              marginBottom: '1rem',
              padding: '0.5rem',
              backgroundColor: '#fef2f2',
              borderRadius: '6px',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              fontWeight: '600',
              backgroundColor: submitting ? '#9ca3af' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{
          marginTop: '1.25rem',
          fontSize: '0.875rem',
          color: '#6b7280',
          textAlign: 'center',
        }}>
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); clearError(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontSize: 'inherit',
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => { setMode('login'); clearError(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                  fontSize: 'inherit',
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
