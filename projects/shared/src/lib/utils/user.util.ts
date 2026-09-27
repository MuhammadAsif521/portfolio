/** Display helpers for the signed-in admin ({ name?, email }). */
export interface NamedUser {
  name?: string | null;
  email?: string | null;
}

export function getUserFullName(user: NamedUser | null | undefined): string {
  return user?.name?.trim() || user?.email?.split('@')[0] || 'Admin';
}

/** "Muhammad Asif" → "MA"; falls back to the email's first letter. */
export function getUserInitials(user: NamedUser | null | undefined): string {
  const parts = (user?.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length) return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : '')).toUpperCase();
  return (user?.email?.[0] ?? 'A').toUpperCase();
}
