/**
 * Holds what someone typed on a sign-up form while they confirm their email.
 * After the 6-digit code is verified, the matching register endpoint is
 * called with it. Kept in memory (the proof file cannot be saved to storage);
 * the email alone is also kept in sessionStorage so a reload can say what to do.
 */
export type PendingSignup =
  | { role: 'general'; email: string; name: string; age: number | null }
  | { role: 'organizer' | 'sponsor'; email: string; displayName: string; fields: Record<string, string>; file: File }

let current: PendingSignup | null = null
const KEY = 'mp-pending-email'

export const pendingSignup = {
  get: () => current,
  set(p: PendingSignup) {
    current = p
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ email: p.email, role: p.role }))
    } catch {
      /* ignore */
    }
  },
  clear() {
    current = null
    try {
      sessionStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
  /** Email and role from an earlier page load, if the form data was lost */
  remembered(): { email: string; role: PendingSignup['role'] } | null {
    try {
      const raw = sessionStorage.getItem(KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
}
