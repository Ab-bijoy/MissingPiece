import type {
  EventFacts,
  EventSummary,
  Me,
  OfferInput,
  RequestState,
  SponsorOfferRow,
  SponsorProfile,
  SponsorRequestSummary,
} from '../types'
import { data, newId, nowIso, saveData, type DNeed, type DOffer, type DProject, type DRequest } from './mockData'
import { mockDb } from './mockDb'
import { nameOf, notify, qtyText, toOffer } from './mockOrganizer'

/**
 * Demo-mode answers for the sponsor endpoints (build prompt 7.4), the shared
 * events list, offer withdrawal (rule 7) and the mock payment gateway (rule 10).
 */
type Res = { status: number; body?: unknown }
const ok = (body?: unknown, status = 200): Res => ({ status, body })
const fail = (status: number, detail: string, code: string): Res => ({ status, body: { detail, code } })

const COMMISSION = 0.05
/** commission = round(amount * 0.05, 2); never floats in the real back end */
const commissionOf = (amount: number) => Math.round(amount * COMMISSION * 100) / 100
const ACTIVE: DOffer['stage'][] = ['offered', 'accepted', 'received']

const needOf = (id: string) => data.needs.find((n) => n.id === id)!
const projectOf = (id: string) => data.projects.find((p) => p.id === id)!
const holding = (needId: string) => data.offers.find((o) => o.need_id === needId && (o.stage === 'accepted' || o.stage === 'received'))

export function eventFacts(p: DProject): EventFacts {
  const m = data.memberships.filter((x) => x.project_id === p.id && x.status === 'approved')
  return {
    id: p.id, name: p.name, project_type: data.templates.find((t) => t.id === p.template_id)?.project_type ?? null,
    organizer_name: nameOf(p.organizer_id), institution: p.institution, event_date: p.event_date, venue: p.venue,
    audience: p.audience, status: p.status,
    participants: m.filter((x) => x.role === 'participant').length, contributors: m.filter((x) => x.role === 'contributor').length,
  }
}

function offerText(o: DOffer, n: DNeed) {
  if (o.amount) return `BDT ${o.amount.toLocaleString('en-US')}`
  return qtyText(n)
}

function myLatestOffer(r: DRequest, me: Me) {
  return data.offers
    .filter((o) => o.request_id === r.id && o.from_user_id === me.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
}

function requestState(r: DRequest, me: Me): RequestState {
  const mine = myLatestOffer(r, me)
  if (mine?.stage === 'offered') return 'offer_sent'
  if (mine?.stage === 'accepted') return 'accepted'
  if (mine?.stage === 'received') return 'received'
  if (mine?.stage === 'expired') return 'expired'
  const hold = holding(r.need_id)
  if (hold && hold.from_user_id !== me.id) return 'covered_by_other'
  if (mine?.stage === 'declined') return 'covered_by_other'
  if (mine?.stage === 'withdrawn') return 'withdrawn'
  if (projectOf(r.project_id).event_date < nowIso().slice(0, 10)) return 'expired'
  return 'new'
}

function stillNeeded(p: DProject) {
  return data.needs.filter((n) => n.project_id === p.id && !holding(n.id)).map((n) => `${qtyText(n)} for ${n.title.toLowerCase()}`)
}

export function handleSponsor(method: string, path: string, body: unknown, me: Me): Res | null {
  const m = (re: RegExp) => path.match(re)
  const done = (r: Res) => {
    if (method !== 'GET') saveData()
    return r
  }
  const isSponsor = me.role === 'sponsor'

  // Events (view only; also the general feed later)
  if (path === '/events' && method === 'GET') {
    const list: EventSummary[] = data.projects
      .filter((p) => p.status === 'live')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((p) => {
        const open = data.needs.filter((n) => n.project_id === p.id && !holding(n.id))
        return { ...eventFacts(p), still_needed: stillNeeded(p), open_needs: open.length, needs_money: open.some((n) => n.type === 'money') }
      })
    return ok(list)
  }
  let g = m(/^\/events\/([^/]+)$/)
  if (g && method === 'GET') {
    const p = data.projects.find((x) => x.id === g![1] && x.status !== 'draft')
    if (!p) return fail(404, 'Event not found.', 'not_found')
    return ok({
      ...eventFacts(p),
      description: p.description,
      needs: data.needs
        .filter((n) => n.project_id === p.id)
        .map((n) => {
          const h = holding(n.id)
          return { ...n, state: !h ? 'open' : h.stage === 'received' ? 'received' : 'covered' }
        }),
    })
  }

  // Inbox
  if (path === '/sponsor/requests' && method === 'GET' && isSponsor) {
    const list: SponsorRequestSummary[] = data.requests
      .filter((r) => r.sponsor_id === me.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => {
        const n = needOf(r.need_id)
        return {
          id: r.id, project_id: r.project_id, project_name: projectOf(r.project_id).name, need_title: n.title,
          need_amount: qtyText(n), state: requestState(r, me), decide_by: r.decide_by, created_at: r.created_at,
        }
      })
    return ok(list)
  }

  g = m(/^\/requests\/([^/]+)$/)
  if (g && method === 'GET') {
    const r = data.requests.find((x) => x.id === g![1])
    if (!r) return fail(404, 'Request not found.', 'not_found')
    if (r.sponsor_id !== me.id) return fail(403, 'This request was not sent to you.', 'forbidden')
    const mine = myLatestOffer(r, me)
    return ok({
      id: r.id, project: eventFacts(projectOf(r.project_id)), need: needOf(r.need_id), benefits: r.benefits,
      conditions: r.conditions, exclusive_category: r.exclusive_category, decide_by: r.decide_by, deliver_by: r.deliver_by,
      state: requestState(r, me), thread_id: data.threads.find((t) => t.request_id === r.id)?.id ?? null,
      my_offer: mine ? toOffer(mine) : null,
    })
  }

  g = m(/^\/requests\/([^/]+)\/offers$/)
  if (g && method === 'POST' && isSponsor) {
    const r = data.requests.find((x) => x.id === g![1])
    if (!r) return fail(404, 'Request not found.', 'not_found')
    if (r.sponsor_id !== me.id) return fail(403, 'This request was not sent to you.', 'forbidden')
    const n = needOf(r.need_id)
    const b = body as OfferInput
    if (holding(n.id)) return fail(409, 'This need is already covered by another offer.', 'need_covered')
    if (data.offers.some((o) => o.request_id === r.id && o.from_user_id === me.id && ACTIVE.includes(o.stage)))
      return fail(409, 'You already have an offer on this request.', 'duplicate_offer')
    if (projectOf(r.project_id).event_date < nowIso().slice(0, 10)) return fail(409, 'This event has already happened.', 'expired')
    if (n.type === 'money' && b.amount !== n.quantity)
      return fail(422, `One offer covers the whole need: BDT ${n.quantity.toLocaleString('en-US')}.`, 'partial_offer')
    const o: DOffer = {
      id: newId('o'), need_id: n.id, from_user_id: me.id, request_id: r.id, stage: 'offered', contribution_role: null,
      conditions: b.conditions, exclusive_category: b.exclusive_category ?? r.exclusive_category, amount: n.type === 'money' ? n.quantity : null,
      resource: ['equipment', 'space'].includes(n.type) ? n.title.toLowerCase() : null, slot_start: n.slot_start ?? null,
      slot_end: n.slot_end ?? null, created_at: nowIso(),
    }
    data.offers.push(o)
    r.benefits.forEach((label) => data.benefits.push({ id: newId('b'), offer_id: o.id, label, given: false, given_at: null }))
    const p = projectOf(r.project_id)
    notify(p.organizer_id, 'offer_received', o.id, `${me.name} made an offer for ${n.title} (${p.name}).`)
    return done(ok(toOffer(o), 201))
  }

  // My offers
  if (path === '/sponsor/offers' && method === 'GET' && isSponsor) {
    const rows: SponsorOfferRow[] = data.offers
      .filter((o) => o.from_user_id === me.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((o) => {
        const n = needOf(o.need_id)
        const p = projectOf(n.project_id)
        const bs = data.benefits.filter((b) => b.offer_id === o.id)
        const pay = data.payments.filter((x) => x.offer_id === o.id).at(-1)
        return {
          id: o.id, request_id: o.request_id, project_id: p.id, project_name: p.name, need_title: n.title, need_type: n.type,
          offer_text: offerText(o, n), amount: o.amount, stage: o.stage, benefits_given: bs.filter((b) => b.given).length,
          benefits_total: bs.length, payment_status: pay?.status ?? null, project_status: p.status,
        }
      })
    return ok(rows)
  }

  // Withdraw (rule 7): sponsors and contributors, own offers only
  g = m(/^\/offers\/([^/]+)\/withdraw$/)
  if (g && method === 'POST') {
    const o = data.offers.find((x) => x.id === g![1])
    if (!o) return fail(404, 'Offer not found.', 'not_found')
    if (o.from_user_id !== me.id) return fail(403, 'You can only withdraw your own offers.', 'forbidden')
    if (o.stage === 'received') return fail(409, 'This offer was already received, so it cannot be withdrawn.', 'already_received')
    if (o.stage !== 'offered' && o.stage !== 'accepted') return fail(409, 'This offer is no longer open.', 'bad_stage')
    if (data.payments.some((x) => x.offer_id === o.id && x.status === 'pending'))
      return fail(409, 'Your payment for this offer is still in progress, so it cannot be withdrawn now.', 'payment_in_progress')
    const n = needOf(o.need_id)
    if (o.stage === 'accepted') n.status = 'open' // booking goes with it
    o.stage = 'withdrawn'
    const mb = data.memberships.find((x) => x.offer_id === o.id)
    if (mb) data.memberships = data.memberships.filter((x) => x !== mb)
    notify(projectOf(n.project_id).organizer_id, 'offer_withdrawn', o.id, `${me.name} withdrew their offer for ${n.title}.`)
    return done(ok(undefined, 204))
  }

  // Payments (rule 10)
  g = m(/^\/offers\/([^/]+)\/(payment-quote|payments)$/)
  if (g && isSponsor) {
    const o = data.offers.find((x) => x.id === g![1])
    if (!o || o.from_user_id !== me.id) return fail(404, 'Offer not found.', 'not_found')
    const n = needOf(o.need_id)
    const p = projectOf(n.project_id)
    if (n.type !== 'money' || !o.amount) return fail(409, 'Only money offers are paid.', 'not_money')
    const commission = commissionOf(o.amount)
    if (g[2] === 'payment-quote' && method === 'GET')
      return ok({
        offer_id: o.id, project_name: p.name, organizer_name: nameOf(p.organizer_id), need_title: n.title, amount: o.amount,
        commission, total: o.amount + commission, last_payment_status: data.payments.filter((x) => x.offer_id === o.id).at(-1)?.status ?? null,
        offer_stage: o.stage, project_id: p.id,
        payment_in_progress: data.payments.some((x) => x.offer_id === o.id && x.status === 'pending'),
      })
    if (g[2] === 'payments' && method === 'POST') {
      if (data.payments.some((x) => x.offer_id === o.id && (x.status === 'succeeded' || x.status === 'paid_out')))
        return fail(409, 'This offer is already paid. Thank you!', 'already_paid')
      if (o.stage !== 'accepted') return fail(409, 'You can pay only after the organizer accepts your offer.', 'bad_stage')
      // One payment at a time: carry on with the one already started
      const started = data.payments.find((x) => x.offer_id === o.id && x.status === 'pending')
      if (started) return ok({ payment_id: started.id, checkout_url: `/sponsor/checkout/${started.id}` }, 201)
      const pay = { id: newId('pay'), offer_id: o.id, gross_amount: o.amount + commission, commission_amount: commission, net_amount: o.amount, status: 'pending' as const }
      data.payments.push(pay)
      // Demo gateway: a page in this app that lets you choose success or failure.
      return done(ok({ payment_id: pay.id, checkout_url: `/sponsor/checkout/${pay.id}` }, 201))
    }
  }

  // Mock gateway webhook. The real one is called by the gateway, verified by signature and amount.
  if (path === '/payments/webhook' && method === 'POST') {
    const b = body as { payment_id: string; status: 'succeeded' | 'failed' }
    const pay = data.payments.find((x) => x.id === b.payment_id)
    if (!pay) return fail(404, 'Payment not found.', 'not_found')
    if (pay.status !== 'pending') return ok({ status: pay.status }) // repeated webhook: ignore
    const o = data.offers.find((x) => x.id === pay.offer_id)!
    const n = needOf(o.need_id)
    const p = projectOf(n.project_id)
    pay.status = b.status
    if (b.status === 'succeeded') {
      o.stage = 'received'
      data.receipts.push({ offer_id: o.id, received_at: nowIso() })
      notify(o.from_user_id, 'payment_succeeded', pay.id, `Your payment of BDT ${pay.gross_amount.toLocaleString('en-US')} went through. Thank you!`)
      notify(p.organizer_id, 'item_received', o.id, `${nameOf(o.from_user_id)} paid BDT ${pay.net_amount.toLocaleString('en-US')} for ${n.title}.`)
    } else {
      notify(o.from_user_id, 'payment_failed', pay.id, 'Your payment did not go through. Your offer is still accepted, so you can try again.')
    }
    return done(ok({ status: pay.status }))
  }
  g = m(/^\/payments\/([^/]+)$/)
  if (g && method === 'GET') {
    const pay = data.payments.find((x) => x.id === g![1])
    if (!pay) return fail(404, 'Payment not found.', 'not_found')
    const o = data.offers.find((x) => x.id === pay.offer_id)!
    return ok({ ...pay, project_name: projectOf(needOf(o.need_id).project_id).name, need_title: needOf(o.need_id).title })
  }

  // Impact report: only after a received offer in that project
  g = m(/^\/sponsor\/reports\/([^/]+)$/)
  if (g && method === 'GET' && isSponsor) {
    const p = data.projects.find((x) => x.id === g![1])
    if (!p) return fail(404, 'Event not found.', 'not_found')
    const mine = data.offers.find((o) => o.from_user_id === me.id && o.stage === 'received' && needOf(o.need_id).project_id === p.id)
    if (!mine) return fail(403, 'A report is available once something you gave has been received.', 'no_received_offer')
    const n = needOf(mine.need_id)
    const needs = data.needs.filter((x) => x.project_id === p.id)
    const facts = eventFacts(p)
    return ok({
      project: facts,
      contribution: { what: offerText(mine, n), need_title: n.title, received_at: data.receipts.find((r) => r.offer_id === mine.id)?.received_at ?? null },
      benefits: data.benefits.filter((b) => b.offer_id === mine.id),
      results: {
        people_taking_part: facts.participants + facts.contributors, contributors: facts.contributors,
        sessions_held: p.status === 'complete' ? 1 : 0, needs_covered: needs.filter((x) => holding(x.id)).length, needs_total: needs.length,
      },
      note: data.notes[p.id] ?? null,
    })
  }

  // Company profile (read by matching)
  if (path === '/sponsor/profile' && isSponsor) {
    const acc = mockDb.accounts.find((a) => a.user?.id === me.id)!
    const prof = acc.user!.profile as SponsorProfile
    if (method === 'GET') return ok(prof)
    if (method === 'PATCH') {
      Object.assign(prof, body as Partial<SponsorProfile>)
      acc.user!.name = prof.company
      mockDb.save()
      return ok(prof)
    }
  }

  return null
}
