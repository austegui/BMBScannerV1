import type { Session } from '@supabase/supabase-js';

/**
 * Check if the user is an admin.
 * Admin = user_metadata.role === 'admin' OR email matches VITE_ADMIN_EMAIL
 * Everyone else = staff (can upload, admin receives previous-month ones)
 */
export function isAdmin(session: Session | null): boolean {
  if (!session?.user) return false;

  const meta = session.user.user_metadata as Record<string, string> | undefined;
  const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || '').trim();

  // Role in user metadata (set in Supabase Dashboard or on signup)
  if (meta?.role === 'admin') return true;

  // Fallback: email match
  if (adminEmail && session.user.email === adminEmail) return true;

  return false;
}
