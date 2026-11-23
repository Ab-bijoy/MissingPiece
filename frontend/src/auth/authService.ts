import { AuthClient, type GoTrueClient } from '@supabase/auth-js'
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
  /** Emails a link that opens /reset-password, signed in just enough to set a new password. */
  resetPassword(email: string): Promise<void>
  /** Sets a new password for the signed-in user (after opening the reset link). */
  updatePassword(password: string): Promise<void>
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
  if (m.includes('already registered')) return 'This email is already in use.'
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Please wait a moment before trying again.'
  if (m.includes('should be different')) return 'Your new password must be different from your old one.'
  if (m.includes('weak') || (m.includes('password') && m.includes('at least')))
    return 'This password is too weak. Use at least 8 characters with uppercase and lowercase letters and a number.'
  if (m.includes('session') && (m.includes('missing') || m.includes('not found')))
    return 'This reset link has expired. Ask for a new one.'
  return message
}

/**
 * Only Supabase's sign-in part (@supabase/auth-js), not the whole supabase-js
 * package: the database, storage and realtime parts are never used here (files go
 * through our API), and leaving them out makes the app's first download smaller.
 * The settings match what supabase-js uses, including where the session is saved,
 * so people who were already logged in stay logged in.
 */
function createAuthClient(supabaseUrl: string, anonKey: string): GoTrueClient {
  const base = new URL(supabaseUrl.endsWith('/') ? supabaseUrl : `${supabaseUrl}/`)
  return new AuthClient({
    url: new URL('auth/v1', base).href,
    headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey },
    storageKey: `sb-${base.hostname.split('.')[0]}-auth-token`,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  })
}

function supabaseAuth(auth: GoTrueClient): AuthService {
  const check = (error: { message: string } | null) => {
    if (error) throw new Error(friendly(error.message))
  }
  return {
    async signUp(email, password) {
      const { data, error } = await auth.signUp({
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
      const { error } = await auth.verifyOtp({ email, token, type: 'signup' })
      check(error)
    },
    async resendOtp(email) {
      const { error } = await auth.resend({ email, type: 'signup' })
      check(error)
    },
    async signIn(email, password) {
      // "Keep me logged in": Supabase persists the session by default.
      const { error } = await auth.signInWithPassword({ email, password })
      check(error)
    },
    async signOut() {
      // 'local' clears this browser's session first, so logging out never depends on the
      // network. (The default 'global' keeps the session when the request to Supabase fails,
      // which left people signed in as the old account.) Supabase still revokes the token.
      const { error } = await auth.signOut({ scope: 'local' })
      if (error) console.warn('Supabase sign-out request failed; this browser is signed out anyway.', error.message)
    },
    async resetPassword(email) {
      const { error } = await auth.resetPasswordForEmail(email, {
        // Must be in Supabase's Redirect URLs list (Authentication > URL Configuration)
        redirectTo: `${window.location.origin}/reset-password`,
      })
      check(error)
    },
    async updatePassword(password) {
      const { error } = await auth.updateUser({ password })
      check(error)
    },
    async getAccessToken() {
      const { data } = await auth.getSession()
      return data.session?.access_token ?? null
    },
    onChange(cb) {
      const { data } = auth.onAuthStateChange((_event, session) => cb(!!session))
      return () => data.subscription.unsubscribe()
    },
  }
}

export const authService: AuthService = env.useMocks
  ? mockAuth
  : supabaseAuth(createAuthClient(env.supabaseUrl, env.supabaseAnonKey))
