import { AccountExistsError } from '../../auth/AccountExistsError'
import type { AuthService } from '../../auth/authService'
import { DEMO_OTP, mockDb } from './mockDb'

const SESSION_KEY = 'mp-demo-session'
const listeners = new Set<(signedIn: boolean) => void>()

function readSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
  } catch {
    return memorySession
  }
}
let memorySession: string | null = null

function writeSession(id: string | null, remember = true) {
  memorySession = id
  try {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    if (id) (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, id)
  } catch {
    /* memory only */
  }
  listeners.forEach((cb) => cb(!!id))
}

const wait = () => new Promise((r) => setTimeout(r, 350))

/** Testing only (VITE_SKIP_AUTH): start a session as the first active demo account of a role. */
const MAIN_DEMO: Record<string, string> = {
  general: 'aisha@example.com',
  organizer: 'csesociety@example.org',
  sponsor: 'csr@examplesoftware.example',
  admin: 'admin@missingpiece.example',
}

export function devSignInAs(role: string) {
  const acc =
    mockDb.byEmail(MAIN_DEMO[role] ?? '') ?? mockDb.accounts.find((a) => a.user?.role === role && a.user.status === 'active')
  if (acc) writeSession(acc.supabaseId)
}

/** Demo-mode stand-in for Supabase Auth. Same messages the real flow shows. */
export const mockAuth: AuthService = {
  async signUp(email, password) {
    await wait()
    const existing = mockDb.byEmail(email)
    if (existing?.confirmed) throw new AccountExistsError()
    if (existing) {
      existing.password = password
    } else {
      mockDb.accounts.push({
        supabaseId: `sb-${crypto.randomUUID()}`,
        email: email.trim(),
        password,
        confirmed: false,
        user: null,
      })
    }
    mockDb.save()
  },
  async verifyOtp(email, token) {
    await wait()
    const acc = mockDb.byEmail(email)
    if (!acc || token !== DEMO_OTP) throw new Error('That code is wrong or has expired. Check it, or ask for a new one.')
    acc.confirmed = true
    mockDb.save()
    writeSession(acc.supabaseId)
  },
  async resendOtp() {
    await wait()
  },
  async signIn(email, password, remember) {
    await wait()
    const acc = mockDb.byEmail(email)
    if (!acc || acc.password !== password) throw new Error('That email and password do not match.')
    if (!acc.confirmed) throw new Error('Please confirm your email with the 6-digit code first.')
    writeSession(acc.supabaseId, remember)
  },
  async signOut() {
    writeSession(null)
  },
  async resetPassword() {
    await wait()
  },
  async updatePassword(password) {
    await wait()
    const id = readSession()
    const acc = id ? mockDb.bySupabaseId(id) : undefined
    if (!acc) throw new Error('This reset link has expired. Ask for a new one.')
    if (acc.password === password) throw new Error('Your new password must be different from your old one.')
    acc.password = password
    mockDb.save()
  },
  async getAccessToken() {
    const id = readSession()
    return id ? `mock.${id}` : null
  },
  onChange(cb) {
    listeners.add(cb)
    return () => listeners.delete(cb)
  },
}
