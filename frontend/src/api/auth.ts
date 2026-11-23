import { api } from './client'
import type { Me } from './types'

// Build prompt 7.1. Log-in, log-out, email code, resend and password reset
// happen in Supabase on the front end; only these four calls hit FastAPI.

export const authApi = {
  /** GET /api/auth/me */
  me: () => api<Me>('/auth/me'),

  /** POST /api/auth/register/user — body: name, age. Creates a general, active account. */
  registerUser: (body: { name: string; age: number | null }) =>
    api<Me>('/auth/register/user', { method: 'POST', json: body }),

  /** POST /api/auth/register/organizer — multipart: org fields + proof file. Status pending_approval. */
  registerOrganizer: (form: FormData) => api<Me>('/auth/register/organizer', { method: 'POST', form }),

  /** POST /api/auth/register/sponsor — multipart: company fields + trade licence file. Status pending_approval. */
  registerSponsor: (form: FormData) => api<Me>('/auth/register/sponsor', { method: 'POST', form }),
}
