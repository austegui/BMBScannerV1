import type { Session } from '@supabase/supabase-js';

/**
 * Derive user initials from Supabase session.
 * Used for memo field: memo must match initials of user who inputs the tx.
 *
 * Priority: full_name → name → first_name+last_name → email (first 2 of local part) → "?"
 */
export function getUserInitials(session: Session | null): string {
  if (!session?.user) return '?';

  const meta = session.user.user_metadata as Record<string, string> | undefined;
  const email = session.user.email ?? '';

  // full_name: "John Adams" → "JA"
  const fullName = meta?.full_name ?? meta?.fullName;
  if (fullName && typeof fullName === 'string') {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  // name
  const name = meta?.name;
  if (name && typeof name === 'string') {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0][0].toUpperCase();
  }

  // first_name + last_name
  const first = meta?.first_name ?? meta?.firstName;
  const last = meta?.last_name ?? meta?.lastName;
  if (first && last) {
    return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
  }
  if (first) return first.slice(0, 2).toUpperCase();

  // email: deepak@targetdial.co → "DE"
  if (email) {
    const local = email.split('@')[0] ?? '';
    if (local.length >= 2) return local.slice(0, 2).toUpperCase();
    if (local.length === 1) return local[0].toUpperCase();
  }

  return '?';
}
