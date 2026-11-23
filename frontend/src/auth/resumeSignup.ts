import type { Me } from '../api/types'
import { authService } from './authService'

/**
 * Someone signed up, confirmed their email, but never got a profile (for
 * example the profile step failed). Signing up again with the same email and
 * password logs them in so the email screen can finish creating the profile.
 * Throws a plain-language error when that is not the case.
 */
export async function resumeSignup(email: string, password: string, loadMe: () => Promise<Me | null>): Promise<void> {
  try {
    await authService.signIn(email, password, true)
  } catch {
    throw new Error('An account with this email already exists. Log in instead, or use “Forgot password?”.')
  }
  const me = await loadMe().catch(() => null)
  if (me) {
    await authService.signOut()
    throw new Error('You already have an account with this email. Please log in.')
  }
}
