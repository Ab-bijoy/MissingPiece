import type {
  AdminComment,
  AdminPayment,
  AdminUser,
  Me,
  OrganizerProfile,
  RegistrationDetail,
  RegistrationSummary,
  SponsorProfile,
  Template,
  TemplateInput,
} from '../types'
import { accountMeta, data, newId, nowIso, saveData } from './mockData'
import { mockDb } from './mockDb'
import { nameOf, notify } from './mockOrganizer'

/** Demo-mode answers for the admin endpoints (build prompt 7.2). */
type Res = { status: number; body?: unknown }
const ok = (body?: unknown, status = 200): Res => ({ status, body })
const fail = (status: number, detail: string, code: string): Res => ({ status, body: { detail, code } })

const ORG_TYPE = { ngo: 'NGO', university: 'University club or office', community_group: 'Community group' }

function kindOf(u: Me) {
  return u.role === 'organizer' ? ORG_TYPE[(u.profile as OrganizerProfile).org_type] : (u.profile as SponsorProfile).industry
}

export function handleAdmin(method: string, path: string, body: unknown, me: Me, search: URLSearchParams): Res | null {
  const m = (re: RegExp) => path.match(re)
  const done = (r: Res) => {
    saveData()
    mockDb.save()
    return r
  }

  // Files: admin or owner. Demo mode keeps no file contents, so there is no link.
  let g = m(/^\/files\/([^/]+)$/)
  if (g && method === 'GET') {
    const owner = Object.entries(data.accountMeta).find(([, v]) => v.documents.some((d) => d.id === g![1]))
    if (!owner) return fail(404, 'File not found.', 'not_found')
    if (me.role !== 'admin' && owner[0] !== me.id) return fail(403, 'Not allowed.', 'forbidden')
    return ok({ url: null })
  }

  if (!path.startsWith('/admin/')) return null
  if (me.role !== 'admin') return fail(403, 'Admins only.', 'forbidden')

  // Registrations
  if (path === '/admin/registrations' && method === 'GET') {
    const status = search.get('status') ?? 'pending'
    const want = status === 'approved' ? ['active', 'suspended'] : status === 'rejected' ? ['rejected'] : ['pending_approval']
    const list: RegistrationSummary[] = mockDb.accounts
      .filter((a) => a.user && (a.user.role === 'organizer' || a.user.role === 'sponsor') && want.includes(a.user.status))
      .map((a) => ({
        user_id: a.user!.id, name: a.user!.name, role: a.user!.role as 'organizer' | 'sponsor', kind: kindOf(a.user!),
        sent_at: accountMeta(a.user!).sent_at, status: a.user!.status,
      }))
      .sort((a, b) => b.sent_at.localeCompare(a.sent_at))
    return ok(list)
  }
  g = m(/^\/admin\/registrations\/([^/]+)(?:\/(approve|reject))?$/)
  if (g) {
    const acc = mockDb.accounts.find((a) => a.user?.id === g![1])
    const u = acc?.user
    if (!u || (u.role !== 'organizer' && u.role !== 'sponsor')) return fail(404, 'Request not found.', 'not_found')
    const meta = accountMeta(u)
    if (!g[2] && method === 'GET') {
      const d: RegistrationDetail = {
        user_id: u.id, role: u.role as 'organizer' | 'sponsor', status: u.status, email: u.email, name: u.name, sent_at: meta.sent_at,
        rejection_note: u.rejection_note, profile: u.profile as OrganizerProfile | SponsorProfile, documents: meta.documents,
      }
      return ok(d)
    }
    if (method === 'POST' && g[2] === 'approve') {
      if (u.status !== 'pending_approval') return fail(409, 'Only a waiting request can be approved.', 'bad_status')
      u.status = 'active'
      u.rejection_note = null
      meta.verified = true
      notify(u.id, 'registration_approved', u.id, 'Your registration was approved. You can log in now.')
      console.info(`[demo email] to ${u.email}: your MissingPiece registration was approved.`)
      return done(ok(undefined, 204))
    }
    if (method === 'POST' && g[2] === 'reject') {
      const note = String((body as { note?: string })?.note ?? '').trim()
      if (!note) return fail(422, 'Please write a note saying why. The applicant will see it.', 'note_required')
      if (u.status !== 'pending_approval') return fail(409, 'Only a waiting request can be rejected.', 'bad_status')
      u.status = 'rejected'
      u.rejection_note = note
      notify(u.id, 'registration_rejected', u.id, `Your registration was not approved: ${note}`)
      console.info(`[demo email] to ${u.email}: your MissingPiece registration was not approved. Reason: ${note}`)
      return done(ok(undefined, 204))
    }
  }

  // Accounts
  if (path === '/admin/users' && method === 'GET') {
    const role = search.get('role')
    const list: AdminUser[] = mockDb.accounts
      .filter((a) => a.user && (!role || a.user.role === role))
      .map((a) => {
        const meta = accountMeta(a.user!)
        return {
          id: a.user!.id, name: a.user!.name, email: a.email, role: a.user!.role, status: a.user!.status,
          verified: meta.verified, is_demo: meta.is_demo, created_at: meta.created_at,
        }
      })
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
    return ok(list)
  }
  g = m(/^\/admin\/users\/([^/]+)$/)
  if (g) {
    const acc = mockDb.accounts.find((a) => a.user?.id === g![1])
    if (!acc?.user) return fail(404, 'Account not found.', 'not_found')
    const meta = accountMeta(acc.user)
    if (method === 'PATCH') {
      const b = body as { status?: Me['status']; verified?: boolean }
      if (acc.user.id === me.id && b.status === 'suspended') return fail(409, 'You cannot suspend your own account.', 'self')
      if (b.status) acc.user.status = b.status
      if (typeof b.verified === 'boolean') meta.verified = b.verified
      return done(ok({ id: acc.user.id }))
    }
    if (method === 'DELETE') {
      if (!meta.is_demo) return fail(409, 'Only demo accounts can be deleted. Suspend real accounts instead.', 'not_demo')
      mockDb.accounts = mockDb.accounts.filter((a) => a !== acc)
      delete data.accountMeta[acc.user.id]
      return done(ok(undefined, 204))
    }
  }

  // Templates
  if (path === '/admin/templates') {
    if (method === 'GET') return ok(data.templates)
    if (method === 'POST') {
      const b = body as TemplateInput
      if (!b.name?.trim()) return fail(422, 'Give the template a name.', 'validation')
      if (data.templates.some((t) => t.name.toLowerCase() === b.name.trim().toLowerCase()))
        return fail(409, 'A template with this name already exists.', 'duplicate')
      const t: Template = { ...b, id: newId('t'), name: b.name.trim() }
      data.templates.push(t)
      return done(ok(t, 201))
    }
  }
  g = m(/^\/admin\/templates\/([^/]+)$/)
  if (g && method === 'PATCH') {
    const t = data.templates.find((x) => x.id === g![1])
    if (!t) return fail(404, 'Template not found.', 'not_found')
    Object.assign(t, body as Partial<TemplateInput>)
    return done(ok(t))
  }

  // Payments (payouts are sent by hand in v1)
  if (path === '/admin/payments' && method === 'GET') {
    const list: AdminPayment[] = data.payments
      .map((p) => {
        const o = data.offers.find((x) => x.id === p.offer_id)!
        const n = data.needs.find((x) => x.id === o.need_id)!
        return {
          id: p.id, offer_id: p.offer_id, project_name: data.projects.find((x) => x.id === n.project_id)!.name,
          sponsor_name: nameOf(o.from_user_id), gross_amount: p.gross_amount, commission_amount: p.commission_amount,
          net_amount: p.net_amount, status: p.status, paid_out_at: p.paid_out_at ?? null, created_at: p.created_at ?? nowIso(),
        }
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    return ok(list)
  }
  g = m(/^\/admin\/payments\/([^/]+)\/payout$/)
  if (g && method === 'POST') {
    const p = data.payments.find((x) => x.id === g![1])
    if (!p) return fail(404, 'Payment not found.', 'not_found')
    if (p.status !== 'succeeded') return fail(409, 'Only a succeeded payment can be paid out.', 'bad_status')
    p.status = 'paid_out'
    p.paid_out_at = nowIso()
    return done(ok({ id: p.id }))
  }

  // Hidden comments
  if (path === '/admin/comments' && method === 'GET') {
    const list: AdminComment[] = data.comments
      .filter((c) => c.status === 'hidden')
      .map((c) => ({ ...c, author_name: nameOf(c.user_id), project_name: data.projects.find((p) => p.id === c.project_id)?.name ?? '' }))
    return ok(list)
  }
  g = m(/^\/admin\/comments\/([^/]+)$/)
  if (g && method === 'DELETE') {
    if (!data.comments.some((c) => c.id === g![1])) return fail(404, 'Comment not found.', 'not_found')
    data.comments = data.comments.filter((c) => c.id !== g![1] && c.parent_id !== g![1])
    return done(ok(undefined, 204))
  }

  return fail(404, 'Not found.', 'not_found')
}
