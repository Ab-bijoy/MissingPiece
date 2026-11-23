import type { FeedItem, JoinInput, Me, MyContribution, MyProfile, OrganizerProfile, ProgramDetail } from '../types'
import { data, newId, nowIso, saveData, type DProject } from './mockData'
import { mockDb } from './mockDb'
import { nameOf, notify, qtyText } from './mockOrganizer'
import { eventFacts } from './mockSponsor'

/**
 * Demo-mode answers for general users (build prompt 7.5: feed, program page,
 * join, my contributions, profile) and the organizer profile.
 */
type Res = { status: number; body?: unknown }
const ok = (body?: unknown, status = 200): Res => ({ status, body })
const fail = (status: number, detail: string, code: string): Res => ({ status, body: { detail, code } })

const holding = (needId: string) => data.offers.find((o) => o.need_id === needId && (o.stage === 'accepted' || o.stage === 'received'))
// What community members can give: skills, time, and things to lend.
const HELPABLE = ['skill', 'time', 'equipment', 'space']

function seatsLeft(p: DProject) {
  return Math.max(0, p.audience - data.memberships.filter((m) => m.project_id === p.id && m.role === 'participant' && m.status === 'approved').length)
}

function myMembership(p: DProject, me: Me) {
  const m = data.memberships.find((x) => x.project_id === p.id && x.user_id === me.id)
  return m ? { id: m.id, role: m.role, status: m.status } : null
}

const visibleTop = (pid: string) => data.comments.filter((c) => c.project_id === pid && c.status === 'visible' && !c.parent_id)
const withName = <T extends { user_id: string }>(c: T) => ({ ...c, author_name: nameOf(c.user_id) })

function helpNeeded(p: DProject) {
  return data.needs
    .filter((n) => n.project_id === p.id && HELPABLE.includes(n.type) && !holding(n.id))
    .map((n) => ({ need_id: n.id, title: n.title, text: qtyText(n) }))
}

export function handleUser(method: string, path: string, body: unknown, me: Me): Res | null {
  const m = (re: RegExp) => path.match(re)
  const done = (r: Res) => {
    if (method !== 'GET') saveData()
    return r
  }

  // Organizer profile (not in the build prompt yet)
  if (path === '/organizer/profile' && me.role === 'organizer') {
    const acc = mockDb.accounts.find((a) => a.user?.id === me.id)!
    const prof = acc.user!.profile as OrganizerProfile
    if (method === 'PATCH') {
      const b = body as Partial<OrganizerProfile>
      // Type and registration number were checked by an admin, so they stay.
      for (const k of ['org_name', 'contact_person', 'phone'] as const) if (typeof b[k] === 'string' && b[k]!.trim()) prof[k] = b[k]!.trim()
      acc.user!.name = prof.org_name
      mockDb.save()
    }
    return ok({ ...prof, email: acc.email, status: acc.user!.status })
  }

  if (me.role !== 'general') return null

  if (path === '/feed' && method === 'GET') {
    const items: FeedItem[] = data.projects
      .filter((p) => p.status === 'live' && p.event_date >= nowIso().slice(0, 10))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => {
        const top = visibleTop(p.id).sort((a, b) => b.created_at.localeCompare(a.created_at))
        return {
          ...eventFacts(p),
          description: p.description,
          posted_at: p.created_at,
          still_needed: data.needs.filter((n) => n.project_id === p.id && !holding(n.id)).map((n) => `${qtyText(n)} for ${n.title.toLowerCase()}`),
          help_needed: helpNeeded(p),
          seats_left: seatsLeft(p),
          my_membership: myMembership(p, me),
          comment_count: data.comments.filter((c) => c.project_id === p.id && c.status === 'visible').length,
          comments_preview: top.slice(0, 1).map((c) => {
            const reply = data.comments.find((r) => r.parent_id === c.id && r.status === 'visible')
            return { ...withName(c), reply: reply ? withName(reply) : null }
          }),
        }
      })
    return ok(items)
  }

  let g = m(/^\/events\/([^/]+)$/)
  if (g && method === 'GET') {
    const p = data.projects.find((x) => x.id === g![1] && x.status !== 'draft')
    if (!p) return fail(404, 'Program not found.', 'not_found')
    const mine = data.memberships.find((x) => x.project_id === p.id && x.user_id === me.id)
    const detail: ProgramDetail = {
      ...eventFacts(p),
      description: p.description,
      needs: data.needs
        .filter((n) => n.project_id === p.id)
        .map((n) => {
          const h = holding(n.id)
          return { ...n, state: !h ? 'open' : h.stage === 'received' ? 'received' : 'covered' }
        }),
      my_membership: myMembership(p, me),
      my_offer_id: mine?.offer_id ?? null,
      comment_count: data.comments.filter((c) => c.project_id === p.id && c.status === 'visible').length,
      seats_left: seatsLeft(p),
    }
    return ok(detail)
  }

  // Join (rule 14): participants are in at once; contributors wait for approval.
  g = m(/^\/events\/([^/]+)\/join$/)
  if (g && method === 'POST') {
    const p = data.projects.find((x) => x.id === g![1] && x.status === 'live')
    if (!p) return fail(404, 'Program not found.', 'not_found')
    if (data.memberships.some((x) => x.project_id === p.id && x.user_id === me.id))
      return fail(409, 'You have already joined this program.', 'already_joined')
    const b = body as JoinInput
    if (b.role === 'participant') {
      if (seatsLeft(p) <= 0) return fail(409, 'Sorry, this program is full.', 'full')
      data.memberships.push({ id: newId('mb'), user_id: me.id, project_id: p.id, role: 'participant', status: 'approved', offer_id: null })
      return done(ok(undefined, 204))
    }
    const n = data.needs.find((x) => x.id === b.need_id && x.project_id === p.id)
    if (!n) return fail(422, 'Please choose what you can help with.', 'validation')
    if (holding(n.id)) return fail(409, 'Someone is already covering this. Thank you for offering!', 'need_covered')
    const offerId = newId('o')
    data.offers.push({
      id: offerId, need_id: n.id, from_user_id: me.id, request_id: null, stage: 'offered', contribution_role: b.contribution_role,
      conditions: null, exclusive_category: null, amount: null, resource: n.type === 'equipment' ? n.title.toLowerCase() : null,
      slot_start: n.slot_start ?? null, slot_end: n.slot_end ?? null, created_at: nowIso(),
    })
    const mb = { id: newId('mb'), user_id: me.id, project_id: p.id, role: 'contributor' as const, status: 'pending' as const, offer_id: offerId }
    data.memberships.push(mb)
    notify(p.organizer_id, 'membership_pending', mb.id, `${me.name} offered to help as a ${b.contribution_role} at ${p.name}.`)
    return done(ok(undefined, 204))
  }

  if (path === '/me/memberships' && method === 'GET') {
    const list: MyContribution[] = data.memberships
      .filter((x) => x.user_id === me.id)
      .map((x) => {
        const p = data.projects.find((y) => y.id === x.project_id)!
        const o = data.offers.find((y) => y.id === x.offer_id)
        const n = o && data.needs.find((y) => y.id === o.need_id)
        return {
          membership_id: x.id, role: x.role, status: x.status,
          project: { id: p.id, name: p.name, event_date: p.event_date, venue: p.venue, organizer_name: nameOf(p.organizer_id), status: p.status },
          offer: o && n ? { id: o.id, stage: o.stage, need_title: n.title, need_type: n.type, contribution_role: o.contribution_role, slot_start: o.slot_start, slot_end: o.slot_end } : null,
        }
      })
      .sort((a, b) => a.project.event_date.localeCompare(b.project.event_date))
    return ok(list)
  }

  if (path === '/me/profile') {
    const acc = mockDb.accounts.find((a) => a.user?.id === me.id)!
    const extra = (data.userExtras[me.id] ??= { skills: [], items: [] })
    if (method === 'PATCH') {
      const b = body as Partial<MyProfile>
      if (b.name !== undefined) {
        if (!b.name.trim()) return fail(422, 'Please enter your name.', 'validation')
        acc.user!.name = b.name.trim()
      }
      if (b.age !== undefined) {
        if (b.age !== null && (b.age < 0 || b.age > 130)) return fail(422, 'Please enter a real age.', 'validation')
        acc.user!.age = b.age
      }
      if (b.skills) extra.skills = b.skills
      if (b.items) extra.items = b.items
      mockDb.save()
      saveData()
    }
    return ok({ name: acc.user!.name, age: acc.user!.age, skills: extra.skills, items: extra.items })
  }

  return null
}
