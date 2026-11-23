import type { AccountStatus, Me, UserRole } from '../api/types'

export const LOGIN_PATH: Record<UserRole, string> = {
  general: '/login',
  organizer: '/organizer/login',
  sponsor: '/sponsor/login',
  admin: '/admin/login',
}

export const SIGNUP_PATH: Record<Exclude<UserRole, 'admin'>, string> = {
  general: '/signup',
  organizer: '/organizer/register',
  sponsor: '/sponsor/register',
}

/** Where each role lands after logging in (build prompt 9.1). */
export const HOME_PATH: Record<UserRole, string> = {
  general: '/home',
  organizer: '/organizer',
  sponsor: '/sponsor',
  admin: '/admin/approvals',
}

export const ROLE_LABEL: Record<UserRole, string> = {
  general: 'General user',
  organizer: 'Organizer',
  sponsor: 'Sponsor',
  admin: 'Admin',
}

/** Plain-language reason a non-active account cannot log in (build prompt 3.4). */
export function statusMessage(status: AccountStatus, note?: string | null): string | null {
  switch (status) {
    case 'pending_approval':
      return 'Your registration is still waiting for an admin to check it. We will email you when there is a decision.'
    case 'rejected':
      return `Your registration was not approved.${note ? ` Reason: ${note}` : ''}`
    case 'suspended':
      return 'This account has been suspended. Please contact the MissingPiece team.'
    default:
      return null
  }
}

/** Why this account cannot use a given log-in screen, or null if it can. */
export function loginProblem(me: Me, screen: UserRole): string | null {
  // An account of another role is treated as not registered here: no hint about what it is.
  if (me.role !== screen) return 'This email is not registered.'
  return statusMessage(me.status, me.rejection_note)
}
