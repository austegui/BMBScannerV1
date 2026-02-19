import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../services/supabase';

export type UserRole = 'staff' | 'admin';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  initials: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  initials: string | null;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function deriveInitials(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '??';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]![0] ?? '';
    const last = parts[parts.length - 1]![0] ?? '';
    return (first + last).toUpperCase().slice(0, 4);
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  const loadProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('user_profiles')
        .select('id, user_id, full_name, initials, role')
        .eq('user_id', userId)
        .single();

      if (error || !data) return null;
      return data as UserProfile;
    } catch {
      return null;
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    const client = getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
      setState({ user: null, session: null, profile: null, loading: false, error: null });
      return;
    }
    const profile = await loadProfile(session.user.id);
    setState({
      user: session.user,
      session,
      profile,
      loading: false,
      error: null,
    });
  }, [loadProfile]);

  useEffect(() => {
    const client = getSupabaseClient();
    refreshAuth();

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState({ user: null, session: null, profile: null, loading: false, error: null });
        return;
      }
      loadProfile(session.user.id).then((profile) => {
        setState({
          user: session.user,
          session,
          profile,
          loading: false,
          error: null,
        });
      });
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, refreshAuth]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, error: null }));
    const client = getSupabaseClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      setState((s) => ({ ...s, error: error.message }));
      throw new Error(error.message);
    }
    await refreshAuth();
  }, [refreshAuth]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      setState((s) => ({ ...s, error: null }));
      const client = getSupabaseClient();
      const initials = deriveInitials(fullName);
      const { error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), initials },
        },
      });
      if (error) {
        setState((s) => ({ ...s, error: error.message }));
        throw new Error(error.message);
      }
      await refreshAuth();
    },
    [refreshAuth]
  );

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    await client.auth.signOut();
    setState({ user: null, session: null, profile: null, loading: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((s) => (s.error ? { ...s, error: null } : s));
  }, []);

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    clearError,
    initials: state.profile?.initials ?? null,
    isAdmin: state.profile?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
