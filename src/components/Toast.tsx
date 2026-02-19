import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string, duration?: number) => {
    const defaultDuration = type === 'error' ? 6000 : 4000;
    const dur = duration ?? defaultDuration;
    const id = nextId++;
    const newToast: Toast = { id, type, message, duration: dur };

    setToasts(prev => [...prev, newToast]);

    const timer = setTimeout(() => {
      timersRef.current.delete(id);
      setToasts(prev => prev.filter(t => t.id !== id));
    }, dur);
    timersRef.current.set(id, timer);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const colors: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
    error: { bg: '#fef2f2', border: '#ef4444', text: '#dc2626' },
    info: { bg: '#eff6ff', border: '#3b82f6', text: '#2563eb' },
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            width: '90%',
            maxWidth: '400px',
            pointerEvents: 'none',
          }}
        >
          {toasts.map(t => (
            <div
              key={t.id}
              style={{
                backgroundColor: colors[t.type].bg,
                border: `1px solid ${colors[t.type].border}`,
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                pointerEvents: 'auto',
                animation: 'toast-in 0.2s ease-out',
              }}
            >
              <p style={{
                margin: 0,
                fontSize: '0.875rem',
                color: colors[t.type].text,
                fontWeight: '500',
                flex: 1,
              }}>
                {t.message}
              </p>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors[t.type].text,
                  cursor: 'pointer',
                  padding: '0 0.25rem',
                  fontSize: '1.125rem',
                  lineHeight: 1,
                  opacity: 0.7,
                  flexShrink: 0,
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
