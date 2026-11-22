import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../lib/env'
import { mockAuth } from '../api/mock/mockAuth'
import { AccountExistsError } from './AccountExistsError'

export { AccountExistsError }

/**
 * Supabase is used only for identity (build prompt 1 and 3): sign-up, the
 * 6-digit email code, log-in, password reset and the access token.
 * Everything else goes through our FastAPI API.
 */
export type AuthService = {
  signUp(email: string, password: string): Promise<void>
  verifyOtp(email: string, token: string): Promise<void>
  resendOtp(email: string): Promise<void>
  signIn(email: string, password: string, remember: boolean): Promise<void>
  signOut(): Promise<void>
  resetPassword(email: string): Promise<void>
  getAccessToken(): Promise<string | null>
  /** Calls back when the session starts or ends. Returns an unsubscribe function. */
  onChange(cb: (signedIn: boolean) => void): () => void
}

/** Turns Supabase's error messages into plain words for the screen. */
function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'That email and password do not match.'
  if (m.includes('email not confirmed')) return 'Please confirm your email with the 6-digit code first.'
  if (m.includes('expired') || m.includes('invalid') && m.includes('token'))
    return 'That code is wrong or has expired. Check it, or ask for a new one.'
  if (m.includes('already registered')) return 'An account with this email already exists. Try logging in.'
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Please wait a moment before trying again.'
  return message
}

function supabaseAuth(client: SupabaseClient): AuthService {
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(friendly(error.message))
  }
  return {
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/login` },
      })
      if (error && error.message.toLowerCase().includes('already registered')) throw new AccountExistsError()
      check(error)
      // With email confirmation on, Supabase does not say "already exists" (so emails cannot be
      // guessed); it returns a user with no identities instead.
      if (data.user && data.user.identities?.length === 0) throw new AccountExistsError()
    },
    async verifyOtp(email, token) {
      const { error } = await client.auth.verifyOtp({ email, token, type: 'signup' })
      check(error)
    },
    async resendOtp(email) {
      const { error } = await client.auth.resend({ email, type: 'signup' })
      check(error)
    },
    async signIn(email, password) {
      // "Keep me logged in": Supabase persists the session by default.
      const { error } = await client.auth.signInWithPassword({ email, password })
      check(error)
    },
    async signOut() {
      await client.auth.signOut()
    },
    async resetPassword(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      check(error)
    },
    async getAccessToken() {
      const { data } = await client.auth.getSession()
      return data.session?.access_token ?? null
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(!!session))
      return () => data.subscription.unsubscribe()
    },
  }
}

export const authService: AuthService = env.useMocks
  ? mockAuth
  : supabaseAuth(createClient(env.supabaseUrl, env.supabaseAnonKey))
