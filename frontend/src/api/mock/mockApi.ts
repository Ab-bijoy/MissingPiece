import type { Me, OrgType } from '../types'
import { handleAdmin } from './mockAdmin'
import { data, saveData } from './mockData'
import { mockDb } from './mockDb'
import { handleOrganizer } from './mockOrganizer'
import { handleSponsor } from './mockSponsor'
import { handleUser } from './mockUser'

/**
 * Demo-mode stand-in for the FastAPI back end. Answers the same paths with the
 * same shapes and the same { detail, code } errors. Extend it screen by screen.
 */
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const err = (status: number, detail: string, code?: string) => json(status, { detail, code })

const ALLOWED_FILES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_FILE = 5 * 1024 * 1024

function checkFile(form: FormData, field: string): Response | null {
  const file = form.get(field)
  if (!(file instanceof File) || file.size === 0) return err(422, 'Please attach the document.', 'file_missing')
  if (!ALLOWED_FILES.includes(file.type)) return err(422, 'The document must be a PDF, JPG or PNG.', 'file_type')
  if (file.size > MAX_FILE) return err(422, 'The document must be 5 MB or smaller.', 'file_too_large')
  return null
}

const str = (form: FormData, k: string) => String(form.get(k) ?? '').trim()

export async function mockFetch(url: string, init: RequestInit): Promise<Response> {
  await new Promise((r) => setTimeout(r, 300))
  const path = new URL(url).pathname.replace(/^.*?\/api/, '')
  const method = (init.method ?? 'GET').toUpperCase()
  const auth = (init.headers as Record<string, string> | undefined)?.Authorization ?? ''
  const account = auth.startsWith('Bearer mock.') ? mockDb.bySupabaseId(auth.slice('Bearer mock.'.length)) : undefined

  if (path === '/health') return json(200, { status: 'ok' })
  if (!account) return err(401, 'Please log in again.', 'unauthenticated')

  // ---- Auth and registration (7.1) ----
  if (path === '/auth/me' && method === 'GET') {
    if (!account.user) return err(404, 'No profile yet. Finish signing up first.', 'no_profile')
    return json(200, account.user)
  }

  if (path.startsWith('/auth/register/') && method === 'POST') {
    if (account.user) return err(409, 'This account already has a profile.', 'already_registered')
    const kind = path.slice('/auth/register/'.length)
    let user: Me

    if (kind === 'user') {
      const body = JSON.parse(String(init.body ?? '{}')) as { name?: string; age?: number | null }
      if (!body.name?.trim()) return err(422, 'Please enter your name.', 'validation')
      user = {
        id: `u-${crypto.randomUUID()}`, email: account.email, role: 'general', status: 'active',
        name: body.name.trim(), age: body.age ?? null, rejection_note: null, profile: null,
      }
    } else if (kind === 'organizer' || kind === 'sponsor') {
      const form = init.body as FormData
      const bad = checkFile(form, kind === 'organizer' ? 'proof' : 'trade_license')
      if (bad) return bad
      user =
        kind === 'organizer'
          ? {
              id: `u-${crypto.randomUUID()}`, email: account.email, role: 'organizer', status: 'pending_approval',
              name: str(form, 'org_name'), age: null, rejection_note: null,
              profile: {
                org_name: str(form, 'org_name'), org_type: str(form, 'org_type') as OrgType,
                registration_number: str(form, 'registration_number'), contact_person: str(form, 'contact_person'),
                phone: str(form, 'phone'),
              },
            }
          : {
              id: `u-${crypto.randomUUID()}`, email: account.email, role: 'sponsor', status: 'pending_approval',
              name: str(form, 'company'), age: null, rejection_note: null,
              profile: {
                company: str(form, 'company'), industry: str(form, 'industry'),
                trade_license_number: str(form, 'trade_license_number'), contact_person: str(form, 'contact_person'),
                phone: str(form, 'phone'), interests: [], preferred_types: [], location: null, description: null,
              },
            }
    } else {
      return err(404, 'Not found', 'not_found')
    }
    account.user = user
    const file = kind === 'user' ? null : ((init.body as FormData).get(kind === 'organizer' ? 'proof' : 'trade_license') as File)
    data.accountMeta[user.id] = {
      created_at: new Date().toISOString(), sent_at: new Date().toISOString(), verified: false, is_demo: false,
      documents: file
        ? [{ id: `d-${crypto.randomUUID().slice(0, 8)}`, file_name: file.name, content_type: file.type, size_bytes: file.size, kind: kind === 'organizer' ? 'registration_proof' : 'trade_license' }]
        : [],
    }
    mockDb.save()
    saveData()
    return json(201, user)
  }

  // Every other endpoint needs an active account (build prompt 3.4).
  if (!account.user) return err(403, 'Finish signing up first.', 'no_profile')
  if (account.user.status !== 'active') return err(403, 'Your account is not active.', 'not_active')

  let body: unknown = undefined
  if (typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body)
    } catch {
      return err(422, 'Invalid JSON body.', 'validation')
    }
  }
  const res =
    handleAdmin(method, path, body, account.user, new URL(url).searchParams) ??
    handleOrganizer(method, path, body, account.user) ??
    handleUser(method, path, body, account.user) ??
    handleSponsor(method, path, body, account.user)
  if (res) return res.status === 204 ? new Response(null, { status: 204 }) : json(res.status, res.body)

  return err(404, `Demo mode does not answer ${method} ${path} yet.`, 'not_found')
}
