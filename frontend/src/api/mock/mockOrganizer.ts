import type {
  Comment,
  GapRow,
  Me,
  NeedInput,
  NotificationType,
  Offer,
  OfferConflict,
  Project,
  ProjectInput,
  ProjectSummary,
  ReadinessCheck,
  RequestInput,
  Thread,
} from '../types'
import { data, newId, nowIso, saveData, type DNeed, type DOffer, type DProject } from './mockData'
import { mockDb } from './mockDb'

/**
 * Demo-mode answers for the organizer endpoints (build prompt 7.3) and the
 * shared ones they use (7.6). Business rules from section 6 are enforced so
 * the screens behave like they will against FastAPI.
 */
type Res = { status: number; body?: unknown }
const ok = (body?: unknown, status = 200): Res => ({ status, body })
const fail = (status: number, detail: string, code: string): Res => ({ status, body: { detail, code } })

const BOOKABLE = ['skill', 'time', 'equipment', 'space']
export const nameOf = (userId: string) => mockDb.accounts.find((a) => a.user?.id === userId)?.user?.name ?? 'Someone'
export const qtyText = (n: Pick<NeedInput, 'type' | 'quantity' | 'unit'>) =>
  n.type === 'money' ? `BDT ${n.quantity.toLocaleString('en-US')}` : `${n.quantity.toLocaleString('en-US')} ${n.unit}`

export function notify(user_id: string, type: NotificationType, ref_id: string | null, text: string) {
  data.notifications.unshift({ id: newId('nt'), user_id, type, ref_id, read: false, created_at: nowIso(), text })
}

// ---- view builders --------------------------------------------------------

const projectNeeds = (pid: string) => data.needs.filter((n) => n.project_id === pid)
const needOffers = (nid: string) => data.offers.filter((o) => o.need_id === nid)
const holdingOffer = (nid: string) => needOffers(nid).find((o) => o.stage === 'accepted' || o.stage === 'received')

function toProject(p: DProject): Project {
  const tpl = data.templates.find((t) => t.id === p.template_id)
  return { ...p, project_type: tpl?.project_type ?? null, needs: projectNeeds(p.id) }
}

export function toOffer(o: DOffer): Offer {
  const need = data.needs.find((n) => n.id === o.need_id)!
  const m = data.memberships.find((x) => x.offer_id === o.id)
  const pay = data.payments.filter((x) => x.offer_id === o.id).at(-1)
  return {
    id: o.id, need_id: o.need_id, need_title: need.title, need_type: need.type, from_user_id: o.from_user_id,
    from_name: nameOf(o.from_user_id), request_id: o.request_id, stage: o.stage, contribution_role: o.contribution_role,
    conditions: o.conditions, exclusive_category: o.exclusive_category, amount: o.amount, slot_start: o.slot_start,
    slot_end: o.slot_end, benefits: data.benefits.filter((b) => b.offer_id === o.id), membership_id: m?.id ?? null,
    membership_status: m?.status ?? null, payment_status: pay?.status ?? null, created_at: o.created_at,
  }
}

function gaps(pid: string) {
  const rows: GapRow[] = projectNeeds(pid).map((n) => {
    const hold = holdingOffer(n.id)
    const reqs = data.requests.filter((r) => r.need_id === n.id).length
    const waiting = needOffers(n.id).filter((o) => o.stage === 'offered')
    const contributors = waiting.filter((o) => o.contribution_role).length
    let note: string | null = null
    if (!hold) {
      if (contributors) note = `${contributors} contributor${contributors > 1 ? 's' : ''} pending`
      else if (waiting.length) note = `${waiting.length} offer${waiting.length > 1 ? 's' : ''} to review`
      else if (reqs) note = `${reqs} request${reqs > 1 ? 's' : ''} sent`
      else note = 'No requests yet'
    }
    return {
      need_id: n.id, title: n.title, type: n.type, quantity: n.quantity, unit: n.unit,
      state: !hold ? 'open' : hold.stage === 'received' ? 'received' : 'covered',
      booked: !!hold && BOOKABLE.includes(n.type), covered_by: hold ? nameOf(hold.from_user_id) : null, note,
    }
  })
  const open = rows.filter((r) => r.state === 'open')
  const summary = open.length
    ? `Still needed: ${open.map((r) => `${qtyText(r)} for ${r.title.toLowerCase()}`).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`
    : 'Every need is covered.'
  return { needs: rows, summary }
}

function readiness(p: DProject) {
  const needs = projectNeeds(p.id)
  const held = needs.map((n) => holdingOffer(n.id)).filter(Boolean) as DOffer[]
  const received = held.filter((o) => o.stage === 'received').length
  const slotsOk = needs.every((n) => !n.slot_start || !n.slot_end || n.slot_end > n.slot_start)
  const openTime = needs.some((n) => (n.type === 'time' || n.type === 'skill') && !holdingOffer(n.id))
  const checks: ReadinessCheck[] = [
    { key: 'plan', label: 'Plan works', ok: needs.length > 0 && slotsOk, value: needs.length && slotsOk ? 'Passed' : 'Check needs', detail: needs.length ? (slotsOk ? 'Times and capacity fit' : 'A time slot ends before it starts') : 'Add at least one need' },
    { key: 'commitments', label: 'Commitments covered', ok: held.length === needs.length && needs.length > 0, value: `${held.length} of ${needs.length}`, detail: held.length === needs.length ? 'Every need is covered' : `${needs.length - held.length} need${needs.length - held.length > 1 ? 's' : ''} still open` },
    { key: 'items', label: 'Items received', ok: held.length > 0 && received === held.length, value: `${received} of ${held.length}`, detail: received === held.length ? (held.length ? 'Everything accepted has arrived' : 'Nothing accepted yet') : `${held.length - received} awaiting delivery` },
    { key: 'activity', label: 'Activity confirmed', ok: p.status === 'complete', value: p.status === 'complete' ? 'Yes' : 'Not yet', detail: p.status === 'complete' ? 'Project completed' : openTime ? 'Book volunteers first' : 'Complete after everything arrives' },
  ]
  const can_complete = p.status === 'live' && held.length > 0 && received === held.length
  return { checks, can_complete }
}

function conflicts(pid: string): OfferConflict[] {
  const live = data.offers.filter(
    (o) => projectNeeds(pid).some((n) => n.id === o.need_id) && (o.stage === 'offered' || o.stage === 'accepted') && !o.contribution_role,
  )
  const out: OfferConflict[] = []
  const byCat = new Map<string, DOffer[]>()
  live.forEach((o) => o.exclusive_category && byCat.set(o.exclusive_category, [...(byCat.get(o.exclusive_category) ?? []), o]))
  byCat.forEach((list, cat) => {
    if (list.length > 1)
      out.push({ offer_ids: list.map((o) => o.id), reason: `Both want to be the only ${cat} sponsor` })
  })
  const byNeed = new Map<string, DOffer[]>()
  live.filter((o) => o.stage === 'offered').forEach((o) => byNeed.set(o.need_id, [...(byNeed.get(o.need_id) ?? []), o]))
  byNeed.forEach((list) => {
    const ids = list.map((o) => o.id)
    if (list.length > 1 && !out.some((c) => ids.every((id) => c.offer_ids.includes(id))))
      out.push({ offer_ids: ids, reason: 'These offers are for the same need' })
  })
  return out
}

function report(pid: string) {
  const needs = projectNeeds(pid)
  const recv = needs.map((n) => holdingOffer(n.id)).filter((o): o is DOffer => o?.stage === 'received')
  return {
    people_taking_part: data.memberships.filter((m) => m.project_id === pid && m.status === 'approved').length,
    sessions_held: data.projects.find((p) => p.id === pid)?.status === 'complete' ? 1 : 0,
    money_received: recv.filter((o) => o.amount).reduce((s, o) => s + (o.amount ?? 0), 0),
    items_received: recv
      .map((o) => needs.find((n) => n.id === o.need_id)!)
      .filter((n) => n.type !== 'money')
      .map((n) => `${qtyText(n)} ${n.unit === n.title.toLowerCase() ? '' : n.title.toLowerCase()}`.trim()),
    needs_total: needs.length,
    needs_received: recv.length,
  }
}

const requestsLeft = (pid: string) => 5 - new Set(data.requests.filter((r) => r.project_id === pid).map((r) => r.sponsor_id)).size

function threadView(th: (typeof data.threads)[number], me: Me): Thread {
  const r = data.requests.find((x) => x.id === th.request_id)!
  const need = data.needs.find((n) => n.id === r.need_id)!
  const p = data.projects.find((x) => x.id === r.project_id)!
  const msgs = data.messages.filter((m) => m.thread_id === th.id)
  const last = msgs.at(-1)
  const offer = data.offers.find((o) => o.request_id === r.id && !['withdrawn', 'declined', 'expired'].includes(o.stage))
  return {
    id: th.id, request_id: r.id, project_id: p.id, project_name: p.name, need_title: need.title,
    request_summary: `${need.title}, ${qtyText(need)} · ${offer ? `offer ${offer.stage}` : 'no offer yet'}`,
    organizer_name: nameOf(th.organizer_id), sponsor_name: nameOf(th.sponsor_id), last_message: last?.body ?? null,
    last_at: last?.created_at ?? r.created_at, unread: msgs.filter((m) => !m.read && m.sender_id !== me.id).length,
  }
}

// ---- router ---------------------------------------------------------------

export function handleOrganizer(method: string, path: string, body: unknown, me: Me, query?: URLSearchParams): Res | null {
  const m = (re: RegExp) => path.match(re)
  const isOrg = me.role === 'organizer'
  /** The project if this organizer owns it, otherwise the error to send back. */
  const own = (id: string): { p: DProject } | { err: Res } => {
    const p = data.projects.find((x) => x.id === id)
    if (!p) return { err: fail(404, 'Project not found.', 'not_found') }
    if (p.organizer_id !== me.id && me.role !== 'admin') return { err: fail(403, 'This is not your project.', 'forbidden') }
    return { p }
  }
  const done = (r: Res) => {
    if (method !== 'GET') saveData()
    return r
  }

  // A sponsor's public profile (GET /sponsors/{id}): never contact details
  const sp = m(/^\/sponsors\/([^/]+)$/)
  if (sp && sp[1] !== 'search' && method === 'GET' && isOrg) {
    const acc = mockDb.accounts.find((a) => a.user?.id === sp[1] && a.user.role === 'sponsor' && a.user.status === 'active')
    if (!acc?.user) return fail(404, 'Sponsor not found.', 'not_found')
    const prof = acc.user.profile as { company?: string; industry?: string; location?: string | null; interests?: string[]; preferred_types?: string[]; description?: string | null } | null
    const got = data.offers.filter((o) => o.from_user_id === acc.user!.id && o.stage === 'received')
    return ok({
      id: acc.user.id, name: prof?.company || acc.user.name, industry: prof?.industry ?? null, location: prof?.location ?? null,
      interests: prof?.interests ?? [], preferred_types: prof?.preferred_types ?? [], description: prof?.description ?? null,
      member_since: '2026-09-01T00:00:00+06:00', contributions_received: got.length,
      projects_supported: new Set(got.map((o) => data.needs.find((n) => n.id === o.need_id)?.project_id)).size,
    })
  }

  // Sponsor search (GET /sponsors/search?project_id=&q=): public profile fields only
  if (path === '/sponsors/search' && method === 'GET' && isOrg) {
    const q = (query?.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
    const pid = query?.get('project_id') ?? ''
    const list = mockDb.accounts
      .filter((a) => a.user?.role === 'sponsor' && a.user.status === 'active')
      .map((a) => {
        const prof = a.user!.profile as { company?: string; industry?: string; location?: string | null; interests?: string[] } | null
        return {
          id: a.user!.id,
          name: prof?.company || a.user!.name,
          industry: prof?.industry ?? null,
          location: prof?.location ?? null,
          interests: prof?.interests ?? [],
          requested: data.requests.some((r) => r.project_id === pid && r.sponsor_id === a.user!.id),
        }
      })
      .filter((s) => q.every((w) => [s.name, s.industry ?? '', s.location ?? '', ...s.interests].join(' ').toLowerCase().includes(w)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
    return ok(list)
  }

  // Templates and projects
  if (path === '/templates' && method === 'GET') return ok(data.templates.filter((t) => t.status === 'live'))

  if (path === '/projects' && method === 'POST' && isOrg) {
    const b = body as ProjectInput
    if (!b.name?.trim()) return fail(422, 'Please give the project a name.', 'validation')
    if (!b.needs?.length) return fail(422, 'Add at least one need.', 'validation')
    for (const n of b.needs) {
      if (!(n.quantity > 0)) return fail(422, `"${n.title || 'A need'}" needs a quantity above 0.`, 'validation')
      if (n.type === 'money' && !n.budget_item) return fail(422, `"${n.title}" is money, so it needs a budget item.`, 'validation')
    }
    const p: DProject = {
      id: newId('p'), organizer_id: me.id, template_id: b.template_id, name: b.name.trim(), purpose: b.purpose,
      description: b.description, event_date: b.event_date, venue: b.venue, audience: b.audience,
      institution: b.institution, status: 'draft', created_at: nowIso(),
    }
    data.projects.push(p)
    b.needs.forEach((n) => data.needs.push({ ...n, id: newId('n'), project_id: p.id, status: 'open' }))
    return done(ok(toProject(p), 201))
  }

  if (path === '/projects/mine' && method === 'GET') {
    const list: ProjectSummary[] = data.projects
      .filter((p) => p.organizer_id === me.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => ({
        id: p.id, name: p.name, status: p.status, event_date: p.event_date,
        open_needs: projectNeeds(p.id).filter((n) => !holdingOffer(n.id)).length, total_needs: projectNeeds(p.id).length,
      }))
    return ok(list)
  }

  let g = m(/^\/projects\/([^/]+)$/)
  if (g) {
    const o = own(g[1])
    if ('err' in o) return o.err
    const proj = o.p
    if (method === 'GET') return ok(toProject(proj))
    if (method === 'PATCH') {
      Object.assign(proj, body as object)
      return done(ok(toProject(proj)))
    }
  }

  g = m(/^\/projects\/([^/]+)\/(publish|complete|gaps|readiness|needs|sponsor-matches|requests|offers|bookings|report|memberships)$/)
  if (g) {
    const o = own(g[1])
    if ('err' in o) return o.err
    const proj = o.p
    const what = g[2]
    if (what === 'publish' && method === 'POST') {
      if (proj.status !== 'draft') return fail(409, 'Only a draft can be published.', 'not_draft')
      proj.status = 'live'
      if (!data.matches.some((x) => x.project_id === proj.id)) seedMatches(proj.id)
      return done(ok(toProject(proj)))
    }
    if (what === 'complete' && method === 'POST') {
      if (!readiness(proj).can_complete)
        return fail(409, 'Every accepted offer must be marked received before you can complete the project.', 'not_ready')
      proj.status = 'complete'
      return done(ok(toProject(proj)))
    }
    if (what === 'gaps') return ok(gaps(proj.id))
    if (what === 'readiness') return ok(readiness(proj))
    if (what === 'report') return ok(report(proj.id))
    if (what === 'needs' && method === 'POST') {
      const n: DNeed = { ...(body as NeedInput), id: newId('n'), project_id: proj.id, status: 'open' }
      data.needs.push(n)
      return done(ok(n, 201))
    }
    if (what === 'sponsor-matches') {
      if (method === 'POST') seedMatches(proj.id)
      return done(
        ok({
          matches: data.matches
            .filter((x) => x.project_id === proj.id && x.status !== 'dismissed')
            .sort((a, b) => b.score - a.score)
            .map((x) => ({ ...x, sponsor_name: nameOf(x.sponsor_id) })),
          requests_left: requestsLeft(proj.id),
        }),
      )
    }
    if (what === 'requests' && method === 'GET') {
      const stateOf: Record<string, string> = {
        offered: 'offer_received', accepted: 'accepted', received: 'received', declined: 'declined', withdrawn: 'withdrawn', expired: 'expired',
      }
      const list = data.requests
        .filter((r) => r.project_id === proj.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((r) => {
          const offer = data.offers.filter((o) => o.request_id === r.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          return {
            id: r.id, need_id: r.need_id, need_title: data.needs.find((n) => n.id === r.need_id)?.title ?? '',
            sponsor_id: r.sponsor_id, sponsor_name: nameOf(r.sponsor_id), created_at: r.created_at, decide_by: r.decide_by ?? null,
            state: offer ? stateOf[offer.stage] ?? 'waiting' : 'waiting', offer_id: offer?.id ?? null,
            thread_id: data.threads.find((t) => t.request_id === r.id)?.id ?? null,
          }
        })
      return ok(list)
    }
    if (what === 'requests' && method === 'POST') {
      const b = body as RequestInput
      const need = data.needs.find((n) => n.id === b.need_id && n.project_id === proj.id)
      if (!need) return fail(404, 'Need not found.', 'not_found')
      if (data.requests.some((r) => r.need_id === b.need_id && r.sponsor_id === b.sponsor_id))
        return fail(409, 'You already sent this sponsor a request for this need.', 'duplicate_request')
      const already = data.requests.some((r) => r.project_id === proj.id && r.sponsor_id === b.sponsor_id)
      if (!already && requestsLeft(proj.id) <= 0)
        return fail(409, 'A project can send requests to at most 5 different sponsors.', 'request_limit')
      const r = { ...b, id: newId('r'), project_id: proj.id, created_at: nowIso() }
      data.requests.push(r)
      const th = { id: newId('th'), request_id: r.id, organizer_id: me.id, sponsor_id: b.sponsor_id }
      data.threads.push(th)
      data.matches.filter((x) => x.project_id === proj.id && x.sponsor_id === b.sponsor_id).forEach((x) => (x.status = 'requested'))
      notify(b.sponsor_id, 'request_received', r.id, `${me.name} sent you a request for ${need.title} (${proj.name}).`)
      return done(ok({ id: r.id, thread_id: th.id }, 201))
    }
    if (what === 'memberships' && method === 'GET') {
      return ok(data.memberships.filter((m) => m.project_id === proj.id).map((m) => {
        const offer = data.offers.find((o) => o.id === m.offer_id)
        const need = data.needs.find((n) => n.id === offer?.need_id)
        return { ...m, name: nameOf(m.user_id), offer_stage: offer?.stage ?? null,
          contribution_role: offer?.contribution_role ?? null, need_title: need?.title ?? null,
          slot_start: offer?.slot_start ?? null, slot_end: offer?.slot_end ?? null }
      }))
    }
    if (what === 'offers') {
      const offers = data.offers
        .filter((o) => projectNeeds(proj.id).some((n) => n.id === o.need_id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(toOffer)
      return ok({ offers, conflicts: conflicts(proj.id) })
    }
    if (what === 'bookings') {
      return ok(
        data.offers
          .filter((o) => projectNeeds(proj.id).some((n) => n.id === o.need_id) && (o.stage === 'accepted' || o.stage === 'received') && o.slot_start)
          .map((o) => ({ id: `bk-${o.id}`, offer_id: o.id, resource_key: o.resource ? `item:${o.from_user_id}:${o.resource}` : `user:${o.from_user_id}`, slot_start: o.slot_start, slot_end: o.slot_end })),
      )
    }
  }

  // Needs
  g = m(/^\/needs\/([^/]+)$/)
  if (g) {
    const n = data.needs.find((x) => x.id === g![1])
    if (!n) return fail(404, 'Need not found.', 'not_found')
    const owned = own(n.project_id)
    if ('err' in owned) return owned.err
    if (n.status !== 'open') return fail(409, 'You can only change a need while it is open.', 'need_not_open')
    if (method === 'PATCH') return done(ok(Object.assign(n, body as object)))
    if (method === 'DELETE') {
      data.needs = data.needs.filter((x) => x.id !== n.id)
      return done(ok(undefined, 204))
    }
  }

  // Matches
  g = m(/^\/sponsor-matches\/([^/]+)\/dismiss$/)
  if (g && method === 'POST') {
    const x = data.matches.find((y) => y.id === g![1])
    if (!x) return fail(404, 'Suggestion not found.', 'not_found')
    x.status = 'dismissed'
    return done(ok(undefined, 204))
  }

  // Offers (rules 2, 3, 9)
  g = m(/^\/offers\/([^/]+)\/(accept|decline|receive)$/)
  if (g && method === 'POST' && isOrg) {
    const o = data.offers.find((x) => x.id === g![1])
    if (!o) return fail(404, 'Offer not found.', 'not_found')
    const need = data.needs.find((n) => n.id === o.need_id)!
    const owned = own(need.project_id)
    if ('err' in owned) return owned.err
    const p = owned.p
    if (g[2] === 'accept') {
      if (o.stage !== 'offered') return fail(409, 'Only a waiting offer can be accepted.', 'bad_stage')
      if (need.status !== 'open') return fail(409, 'This need is already covered.', 'need_covered')
      o.stage = 'accepted'
      need.status = 'covered'
      notify(o.from_user_id, 'offer_accepted', o.id, `${p.name} accepted your offer for ${need.title}.`)
      const catClash = o.exclusive_category
        ? data.offers.filter((x) => x.id !== o.id && x.stage === 'offered' && x.exclusive_category === o.exclusive_category && projectNeeds(p.id).some((n) => n.id === x.need_id))
        : []
      const sameNeed = needOffers(need.id).filter((x) => x.id !== o.id && x.stage === 'offered')
      ;[...new Set([...sameNeed, ...catClash])].forEach((x) => {
        x.stage = 'declined'
        notify(x.from_user_id, 'offer_declined', x.id, `${p.name} chose another offer for ${data.needs.find((n) => n.id === x.need_id)!.title}.`)
      })
      return done(ok(undefined, 204))
    }
    if (g[2] === 'decline') {
      if (o.stage !== 'offered') return fail(409, 'Only a waiting offer can be declined.', 'bad_stage')
      o.stage = 'declined'
      notify(o.from_user_id, 'offer_declined', o.id, `${p.name} declined your offer for ${need.title}.`)
      return done(ok(undefined, 204))
    }
    if (g[2] === 'receive') {
      if (need.type === 'money') return fail(409, 'Money offers are received automatically when the payment succeeds.', 'money_offer')
      if (o.stage !== 'accepted') return fail(409, 'Only an accepted offer can be marked received.', 'bad_stage')
      o.stage = 'received'
      data.receipts.push({ offer_id: o.id, received_at: nowIso() })
      notify(o.from_user_id, 'item_received', o.id, `${p.name} received your ${need.title.toLowerCase()}. Thank you!`)
      return done(ok(undefined, 204))
    }
  }

  // Memberships (rule 14)
  g = m(/^\/memberships\/([^/]+)\/(approve|reject)$/)
  if (g && method === 'POST' && isOrg) {
    const mb = data.memberships.find((x) => x.id === g![1])
    if (!mb) return fail(404, 'Not found.', 'not_found')
    const owned = own(mb.project_id)
    if ('err' in owned) return owned.err
    const p = owned.p
    const offer = data.offers.find((x) => x.id === mb.offer_id)
    if (mb.role !== 'contributor' || !offer) return fail(409, 'Only contributor applications can be reviewed here.', 'not_contributor')
    const approving = g[2] === 'approve'
    if (mb.status === (approving ? 'approved' : 'rejected') && offer.stage === (approving ? 'accepted' : 'declined')) return ok(undefined, 204)
    if (!['offered', 'accepted'].includes(offer.stage)) return fail(409, 'This application is no longer awaiting a decision.', 'invalid_stage')
    const need = data.needs.find((n) => n.id === offer.need_id)!
    if (approving) {
      if (mb.status === 'rejected') return fail(409, 'The contributor must apply again.', 'invalid_stage')
      if (offer.stage === 'offered' && need.status !== 'open') return fail(409, 'This need is already covered.', 'need_covered')
      if (!offer.slot_end || new Date(offer.slot_end) <= new Date()) return fail(409, 'The contribution time slot has ended.', 'invalid_slot')
      offer.stage = 'accepted'
      need.status = 'covered'
      data.offers.filter((o) => o.need_id === need.id && o.id !== offer.id && o.stage === 'offered').forEach((o) => {
        o.stage = 'declined'
        const other = data.memberships.find((m) => m.offer_id === o.id)
        if (other) other.status = 'rejected'
      })
    } else {
      if (offer.stage === 'accepted') need.status = 'open'
      offer.stage = 'declined'
    }
    mb.status = approving ? 'approved' : 'rejected'
    notify(mb.user_id, g[2] === 'approve' ? 'membership_approved' : 'membership_rejected', mb.id,
      g[2] === 'approve' ? `You are in! ${p.name} approved your offer to help.` : `${p.name} could not use your help this time.`)
    return done(ok(undefined, 204))
  }

  // Benefits
  g = m(/^\/benefits\/([^/]+)$/)
  if (g && method === 'PATCH') {
    const b = data.benefits.find((x) => x.id === g![1])
    if (!b) return fail(404, 'Not found.', 'not_found')
    b.given = !!(body as { given: boolean }).given
    b.given_at = b.given ? nowIso() : null
    return done(ok(b))
  }

  // Comments (rule 15)
  g = m(/^\/events\/([^/]+)\/comments$/)
  if (g) {
    const p = data.projects.find((x) => x.id === g![1])
    if (!p) return fail(404, 'Event not found.', 'not_found')
    if (method === 'GET') {
      const list: Comment[] = data.comments
        .filter((c) => c.project_id === p.id && (c.status === 'visible' || me.role === 'admin'))
        .map((c) => ({ ...c, author_name: nameOf(c.user_id) }))
      return ok(list)
    }
    if (method === 'POST') {
      const b = body as { kind: Comment['kind']; body: string; parent_id: string | null }
      if (!b.body?.trim()) return fail(422, 'Please write something first.', 'validation')
      const parent = data.comments.find((x) => x.id === b.parent_id && x.project_id === p.id && (x.status === 'visible' || me.role === 'admin'))
      if (b.parent_id && !parent) return fail(404, 'Parent comment not found.', 'not_found')
      const c = { id: newId('c'), project_id: p.id, user_id: me.id, parent_id: b.parent_id, kind: b.kind, body: b.body.trim(), status: 'visible' as const, created_at: nowIso() }
      data.comments.push(c)
      if (parent && parent.user_id !== me.id) notify(parent.user_id, 'comment_replied', c.id, `${me.name} replied to you on ${p.name}.`)
      if (!parent && p.organizer_id !== me.id)
        notify(p.organizer_id, 'comment_posted', c.id, `${me.name} ${b.kind === 'question' ? 'asked a question' : 'commented'} on ${p.name}.`)
      return done(ok({ ...c, author_name: me.name }, 201))
    }
  }
  g = m(/^\/comments\/([^/]+)\/hide$/)
  if (g && method === 'POST') {
    const c = data.comments.find((x) => x.id === g![1])
    if (!c) return fail(404, 'Not found.', 'not_found')
    const p = data.projects.find((x) => x.id === c.project_id)!
    if (p.organizer_id !== me.id && me.role !== 'admin') return fail(403, 'Only the organizer can hide comments.', 'forbidden')
    c.status = 'hidden'
    return done(ok(undefined, 204))
  }

  // Threads (rule 6)
  if (path === '/threads' && method === 'GET') {
    return ok(
      data.threads
        .filter((t) => t.organizer_id === me.id || t.sponsor_id === me.id)
        .map((t) => threadView(t, me))
        .sort((a, b) => (b.last_at ?? '').localeCompare(a.last_at ?? '')),
    )
  }
  g = m(/^\/threads\/([^/]+)\/messages$/)
  if (g) {
    const th = data.threads.find((t) => t.id === g![1])
    if (!th) return fail(404, 'Conversation not found.', 'not_found')
    if (th.organizer_id !== me.id && th.sponsor_id !== me.id)
      return fail(403, 'You can only post in conversations opened for you.', 'forbidden')
    if (method === 'GET') {
      const msgs = data.messages.filter((x) => x.thread_id === th.id)
      msgs.forEach((x) => x.sender_id !== me.id && (x.read = true))
      saveData()
      return ok(msgs.map((x) => ({ ...x, sender_name: nameOf(x.sender_id) })))
    }
    if (method === 'POST') {
      const text = String((body as { body?: string }).body ?? '').trim()
      if (!text) return fail(422, 'Please write a message first.', 'validation')
      const msg = { id: newId('ms'), thread_id: th.id, sender_id: me.id, body: text, read: false, created_at: nowIso() }
      data.messages.push(msg)
      const other = me.id === th.organizer_id ? th.sponsor_id : th.organizer_id
      notify(other, 'message_received', th.id, `${me.name} sent you a message.`)
      return done(ok({ ...msg, sender_name: me.name }, 201))
    }
  }

  // Notifications
  if (path === '/notifications' && method === 'GET')
    return ok(data.notifications.filter((n) => n.user_id === me.id).slice(0, 30))
  if (path === '/notifications/read-all' && method === 'POST') {
    data.notifications.filter((n) => n.user_id === me.id).forEach((n) => (n.read = true))
    return done(ok(undefined, 204))
  }
  g = m(/^\/notifications\/([^/]+)\/read$/)
  if (g && method === 'POST') {
    const n = data.notifications.find((x) => x.id === g![1] && x.user_id === me.id)
    if (n) n.read = true
    return done(ok(undefined, 204))
  }

  return null
}

/** Rule-based matching fallback (build prompt section 8), used in demo mode. */
function seedMatches(pid: string) {
  const p = data.projects.find((x) => x.id === pid)!
  const openTypes = projectNeeds(pid).filter((n) => n.status === 'open').map((n) => n.type)
  const words = `${p.name} ${p.description}`.toLowerCase()
  mockDb.accounts
    .filter((a) => a.user?.role === 'sponsor' && a.user.status === 'active')
    .forEach((a) => {
      const sp = a.user!.profile as { preferred_types: string[]; interests: string[]; location: string | null; industry: string }
      const parts: string[] = []
      let score = 0
      if (sp.preferred_types.some((t) => openTypes.includes(t as DNeed['type']))) {
        score += 40
        parts.push(`gives ${sp.preferred_types.join(' and ')}`)
      }
      if (sp.interests.some((i) => words.includes(i))) {
        score += 30
        parts.push('interests match the project')
      }
      if (sp.location && words.includes(sp.location.toLowerCase())) score += 20
      score += 10
      if (score < 40) return
      const existing = data.matches.find((x) => x.project_id === pid && x.sponsor_id === a.user!.id)
      if (existing) return
      data.matches.push({
        id: newId('m'), project_id: pid, sponsor_id: a.user!.id, score: Math.min(100, score),
        reason: parts.length ? `${a.user!.name} ${parts.join('; ')}.` : `${sp.industry} company.`, status: 'suggested',
      })
    })
}
