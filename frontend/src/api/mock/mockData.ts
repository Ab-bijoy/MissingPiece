import type {
  CommentKind,
  ContributionRole,
  MatchStatus,
  MembershipStatus,
  NeedInput,
  NeedStatus,
  NeedType,
  NotificationType,
  OfferStage,
  PaymentStatus,
  ProjectStatus,
  Me,
  RegistrationDocument,
  Template,
} from '../types'

/**
 * Demo-mode tables, shaped like the real database (database architecture
 * doc, section 3). Seed rows follow build prompt section 12 and the prototype.
 */
export type DProject = {
  id: string; organizer_id: string; template_id: string | null; name: string; purpose: string; description: string
  event_date: string; venue: string; audience: number; institution: string | null; status: ProjectStatus; created_at: string
}
export type DNeed = NeedInput & { id: string; project_id: string; status: NeedStatus }
export type DRequest = {
  id: string; project_id: string; need_id: string; sponsor_id: string; benefits: string[]; conditions: string | null
  exclusive_category: string | null; decide_by: string | null; deliver_by: string | null; created_at: string
}
export type DMatch = { id: string; project_id: string; sponsor_id: string; score: number; reason: string; status: MatchStatus }
export type DOffer = {
  id: string; need_id: string; from_user_id: string; request_id: string | null; stage: OfferStage
  contribution_role: ContributionRole | null; conditions: string | null; exclusive_category: string | null
  amount: number | null; resource: string | null; slot_start: string | null; slot_end: string | null; created_at: string
}
export type DBenefit = { id: string; offer_id: string; label: string; given: boolean; given_at: string | null }
export type DPayment = {
  id: string; offer_id: string; gross_amount: number; commission_amount: number; net_amount: number; status: PaymentStatus
  paid_out_at?: string | null; created_at?: string
}
export type DMembership = {
  id: string; user_id: string; project_id: string; role: 'participant' | 'contributor'; status: MembershipStatus; offer_id: string | null
}
export type DComment = {
  id: string; project_id: string; user_id: string; parent_id: string | null; kind: CommentKind; body: string
  status: 'visible' | 'hidden'; created_at: string
}
export type DThread = { id: string; request_id: string; organizer_id: string; sponsor_id: string }
export type DMessage = { id: string; thread_id: string; sender_id: string; body: string; read: boolean; created_at: string }
export type DNotification = { id: string; user_id: string; type: NotificationType; ref_id: string | null; read: boolean; created_at: string; text: string }

export type Tables = {
  templates: Template[]; projects: DProject[]; needs: DNeed[]; requests: DRequest[]; matches: DMatch[]; offers: DOffer[]
  benefits: DBenefit[]; payments: DPayment[]; memberships: DMembership[]; comments: DComment[]; threads: DThread[]
  messages: DMessage[]; notifications: DNotification[]
  receipts: { offer_id: string; received_at: string }[]
  /** Organizer's thank-you note per finished project */
  notes: Record<string, string>
  /** General users' skills and things they can lend (app_user.skills / items) */
  userExtras: Record<string, { skills: string[]; items: string[] }>
  /** Admin-side facts per account: joined, request sent, verified, demo flag, uploaded documents */
  accountMeta: Record<string, AccountMeta>
}

export type AccountMeta = {
  created_at: string
  sent_at: string
  verified: boolean
  is_demo: boolean
  documents: RegistrationDocument[]
}

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString()
const slot = (date: string, from: number, to: number) => ({
  slot_start: `${date}T${String(from).padStart(2, '0')}:00:00+06:00`,
  slot_end: `${date}T${String(to).padStart(2, '0')}:00:00+06:00`,
})
const FEST = '2026-12-18' // a Friday

const TEMPLATES: Template[] = [
  {
    id: 't-uni', name: 'University event', project_type: 'university_event', status: 'live',
    blurb: 'Fills in snack packs, prize money, projector, volunteers',
    default_needs: [
      { type: 'product', title: 'Snack packs', quantity: 200, unit: 'packs' },
      { type: 'money', title: 'Prize fund', quantity: 20000, unit: 'BDT', budget_item: 'prizes' },
      { type: 'equipment', title: 'Projector', quantity: 1, unit: 'projector' },
      { type: 'time', title: 'Volunteers', quantity: 10, unit: 'people' },
    ],
  },
  {
    id: 't-ngo', name: 'NGO project', project_type: 'ngo_project', status: 'live',
    blurb: 'Fills in trainers, printed guides, venue, transport money',
    default_needs: [
      { type: 'skill', title: 'Trainers', quantity: 3, unit: 'trainers' },
      { type: 'product', title: 'Printed guides', quantity: 50, unit: 'copies' },
      { type: 'space', title: 'Venue', quantity: 1, unit: 'room for 50' },
      { type: 'money', title: 'Transport money', quantity: 5000, unit: 'BDT', budget_item: 'transport' },
    ],
  },
  {
    id: 't-elder', name: 'Elders and youth activity', project_type: 'elders_youth', status: 'live',
    blurb: 'Fills in a sewing machine and a student helper',
    default_needs: [
      { type: 'equipment', title: 'Sewing machine', quantity: 1, unit: 'machine' },
      { type: 'time', title: 'Student helper', quantity: 1, unit: 'person' },
    ],
  },
]

export function seedTables(): Tables {
  const t: Tables = {
    templates: TEMPLATES, projects: [], needs: [], requests: [], matches: [], offers: [], benefits: [], payments: [],
    memberships: [], comments: [], threads: [], messages: [], notifications: [], receipts: [], notes: {}, userExtras: {}, accountMeta: {},
  }

  t.projects.push(
    {
      id: 'p-fest', organizer_id: 'u-cse', template_id: 't-uni', name: 'CSE Fest 2026', status: 'live', created_at: ago(9000),
      purpose: 'A one-day festival for computer science students.',
      description: 'A one-day fest for 200 computer science students, with a programming contest and project showcase.',
      event_date: FEST, venue: 'University hall', audience: 200, institution: 'University of Dhaka',
    },
    {
      id: 'p-tailor', organizer_id: 'u-cse', template_id: 't-elder', name: 'Tailoring Repair Workshop', status: 'live',
      created_at: ago(600), purpose: 'Older people share a skill; students help and learn.',
      description: 'A retired tailor teaches young people how to repair clothes. Older people share a skill; students help and learn.',
      event_date: '2027-01-09', venue: 'Community centre', audience: 25, institution: 'Dhanmondi youth group',
    },
  )

  t.needs.push(
    { id: 'n-snacks', project_id: 'p-fest', type: 'product', title: 'Snack packs', quantity: 200, unit: 'packs', status: 'covered' },
    { id: 'n-drinks', project_id: 'p-fest', type: 'product', title: 'Drinks', quantity: 200, unit: 'bottles', status: 'open' },
    { id: 'n-prize', project_id: 'p-fest', type: 'money', title: 'Prize fund', quantity: 20000, unit: 'BDT', budget_item: 'prizes', status: 'open' },
    { id: 'n-projector', project_id: 'p-fest', type: 'equipment', title: 'Projector', quantity: 1, unit: 'projector', status: 'covered', ...slot(FEST, 10, 17) },
    { id: 'n-volunteers', project_id: 'p-fest', type: 'time', title: 'Volunteers', quantity: 10, unit: 'people', status: 'open', ...slot(FEST, 9, 18) },
    { id: 'n-hall', project_id: 'p-fest', type: 'space', title: 'Hall', quantity: 200, unit: 'seats', status: 'covered', ...slot(FEST, 8, 20) },
    { id: 'n-machine', project_id: 'p-tailor', type: 'equipment', title: 'Sewing machine', quantity: 1, unit: 'machine', status: 'covered', ...slot('2027-01-09', 15, 17) },
    { id: 'n-helper', project_id: 'p-tailor', type: 'time', title: 'Student helper', quantity: 1, unit: 'person', status: 'open', ...slot('2027-01-09', 15, 17) },
  )

  const req = (id: string, need_id: string, sponsor_id: string, benefits: string[], exclusive: string | null, mins: number): DRequest => ({
    id, project_id: 'p-fest', need_id, sponsor_id, benefits, conditions: null, exclusive_category: exclusive,
    decide_by: '2026-12-05', deliver_by: '2026-12-17', created_at: ago(mins),
  })
  t.requests.push(
    req('r-snacks', 'n-snacks', 'u-samplefoods', ['Logo on banner'], 'food', 7000),
    req('r-drinks-foods', 'n-drinks', 'u-samplefoods', ['Logo on banner'], 'food', 5000),
    req('r-drinks-bakery', 'n-drinks', 'u-bakery', ['Stall at the fest'], 'food', 4800),
    req('r-projector', 'n-projector', 'u-examplesoft', ['Logo on main banner', 'Thank-you on stage', 'Impact report sent'], null, 6000),
    req('r-prize', 'n-prize', 'u-examplesoft', ['Logo on main banner', 'Prizes presented on stage'], null, 300),
    req('r-hall', 'n-hall', 'u-campus', ['Thank-you on stage'], null, 6500),
  )

  t.matches.push(
    { id: 'm-examplesoft', project_id: 'p-fest', sponsor_id: 'u-examplesoft', score: 92, reason: 'Funds student tech contests; prefers money.', status: 'requested' },
    { id: 'm-telecom', project_id: 'p-fest', sponsor_id: 'u-telecom', score: 78, reason: 'Sponsors youth events in Dhaka.', status: 'suggested' },
    { id: 'm-print', project_id: 'p-fest', sponsor_id: 'u-print', score: 61, reason: 'Gives printing and small cash grants to education events.', status: 'suggested' },
    { id: 'm-samplefoods', project_id: 'p-fest', sponsor_id: 'u-samplefoods', score: 70, reason: 'Gives food products to community events.', status: 'requested' },
    { id: 'm-bakery', project_id: 'p-fest', sponsor_id: 'u-bakery', score: 64, reason: 'Gives baked goods to community events.', status: 'requested' },
    { id: 'm-campus', project_id: 'p-fest', sponsor_id: 'u-campus', score: 88, reason: 'Lends halls and equipment for campus events.', status: 'requested' },
  )

  const offer = (o: Partial<DOffer> & Pick<DOffer, 'id' | 'need_id' | 'from_user_id' | 'stage'>): DOffer => ({
    request_id: null, contribution_role: null, conditions: null, exclusive_category: null, amount: null, resource: null,
    slot_start: null, slot_end: null, created_at: ago(1000), ...o,
  })
  t.offers.push(
    offer({ id: 'o-snacks', need_id: 'n-snacks', from_user_id: 'u-samplefoods', request_id: 'r-snacks', stage: 'accepted', exclusive_category: 'food', conditions: 'Delivered to the hall by 9 am.' }),
    offer({ id: 'o-drinks-foods', need_id: 'n-drinks', from_user_id: 'u-samplefoods', request_id: 'r-drinks-foods', stage: 'offered', exclusive_category: 'food', conditions: 'Drinks for 200 · logo on banner', created_at: ago(900) }),
    offer({ id: 'o-drinks-bakery', need_id: 'n-drinks', from_user_id: 'u-bakery', request_id: 'r-drinks-bakery', stage: 'offered', exclusive_category: 'food', conditions: 'Drinks for 200 · stall', created_at: ago(700) }),
    offer({ id: 'o-projector', need_id: 'n-projector', from_user_id: 'u-examplesoft', request_id: 'r-projector', stage: 'received', resource: 'projector', ...slot(FEST, 10, 17) }),
    offer({ id: 'o-hall', need_id: 'n-hall', from_user_id: 'u-campus', request_id: 'r-hall', stage: 'accepted', resource: 'hall', ...slot(FEST, 8, 20) }),
    offer({ id: 'o-rahim', need_id: 'n-volunteers', from_user_id: 'u-rahim', stage: 'offered', contribution_role: 'contributor', ...slot(FEST, 9, 18), created_at: ago(200) }),
    offer({ id: 'o-nusrat', need_id: 'n-volunteers', from_user_id: 'u-nusratj', stage: 'offered', contribution_role: 'contributor', ...slot(FEST, 14, 18), created_at: ago(150) }),
  )

  t.benefits.push(
    { id: 'b-1', offer_id: 'o-projector', label: 'Logo on main banner', given: true, given_at: ago(500) },
    { id: 'b-2', offer_id: 'o-projector', label: 'Thank-you on stage', given: true, given_at: ago(500) },
    { id: 'b-3', offer_id: 'o-projector', label: 'Impact report sent', given: false, given_at: null },
    { id: 'b-4', offer_id: 'o-snacks', label: 'Logo on banner', given: true, given_at: ago(400) },
    { id: 'b-5', offer_id: 'o-hall', label: 'Thank-you on stage', given: false, given_at: null },
  )

  t.memberships.push(
    { id: 'mb-rahim', user_id: 'u-rahim', project_id: 'p-fest', role: 'contributor', status: 'pending', offer_id: 'o-rahim' },
    { id: 'mb-nusrat', user_id: 'u-nusratj', project_id: 'p-fest', role: 'contributor', status: 'pending', offer_id: 'o-nusrat' },
    { id: 'mb-aisha', user_id: 'u-aisha', project_id: 'p-fest', role: 'participant', status: 'approved', offer_id: null },
    { id: 'mb-karim', user_id: 'u-karim', project_id: 'p-fest', role: 'participant', status: 'approved', offer_id: null },
  )

  t.comments.push(
    { id: 'c-1', project_id: 'p-fest', user_id: 'u-aisha', parent_id: null, kind: 'question', body: 'Can parents come to watch the contest?', status: 'visible', created_at: ago(3000) },
    { id: 'c-2', project_id: 'p-fest', user_id: 'u-cse', parent_id: 'c-1', kind: 'reply', body: 'Yes! The showcase is open to everyone from 3 pm.', status: 'visible', created_at: ago(2900) },
    { id: 'c-3', project_id: 'p-fest', user_id: 'u-karim', parent_id: null, kind: 'question', body: 'Is the hall on the ground floor? I use a walking stick.', status: 'visible', created_at: ago(90) },
  )

  t.threads.push(
    { id: 'th-prize', request_id: 'r-prize', organizer_id: 'u-cse', sponsor_id: 'u-examplesoft' },
    { id: 'th-snacks', request_id: 'r-snacks', organizer_id: 'u-cse', sponsor_id: 'u-samplefoods' },
    { id: 'th-bakery', request_id: 'r-drinks-bakery', organizer_id: 'u-cse', sponsor_id: 'u-bakery' },
    { id: 'th-projector', request_id: 'r-projector', organizer_id: 'u-cse', sponsor_id: 'u-examplesoft' },
    { id: 'th-hall', request_id: 'r-hall', organizer_id: 'u-cse', sponsor_id: 'u-campus' },
    { id: 'th-drinks-foods', request_id: 'r-drinks-foods', organizer_id: 'u-cse', sponsor_id: 'u-samplefoods' },
  )
  t.messages.push(
    { id: 'ms-1', thread_id: 'th-prize', sender_id: 'u-cse', body: 'Happy to answer any questions before you offer.', read: true, created_at: ago(280) },
    { id: 'ms-2', thread_id: 'th-prize', sender_id: 'u-examplesoft', body: 'Can we present the prizes on stage?', read: false, created_at: ago(40) },
    { id: 'ms-3', thread_id: 'th-snacks', sender_id: 'u-samplefoods', body: 'Delivery will reach the hall by 9 am.', read: true, created_at: ago(4000) },
    { id: 'ms-4', thread_id: 'th-bakery', sender_id: 'u-bakery', body: 'We can also bring a small stall if that helps.', read: false, created_at: ago(650) },
  )

  t.notifications.push(
    { id: 'nt-1', user_id: 'u-cse', type: 'message_received', ref_id: 'th-prize', read: false, created_at: ago(40), text: 'Example Software Co. sent you a message about the prize fund.' },
    { id: 'nt-2', user_id: 'u-cse', type: 'membership_pending', ref_id: 'mb-nusrat', read: false, created_at: ago(150), text: 'Nusrat Jahan offered to help as a volunteer at CSE Fest 2026.' },
    { id: 'nt-3', user_id: 'u-cse', type: 'comment_posted', ref_id: 'c-3', read: false, created_at: ago(90), text: 'Karim Ahmed asked a question on CSE Fest 2026.' },
    { id: 'nt-4', user_id: 'u-cse', type: 'offer_received', ref_id: 'o-drinks-bakery', read: true, created_at: ago(700), text: 'Example Bakery made an offer for Drinks.' },
  )
  addSponsorSeed(t)
  addUserSeed(t)
  addAdminSeed(t)
  return t
}

/** Rows for the admin screens: documents, payments in every state, a hidden comment, a demo account. */
function addAdminSeed(t: Tables) {
  const doc = (id: string, file_name: string, kind: RegistrationDocument['kind'], type = 'application/pdf'): RegistrationDocument => ({
    id, file_name, content_type: type, size_bytes: 412_000, kind,
  })
  t.accountMeta['u-greenhands'] = { created_at: ago(120), sent_at: ago(120), verified: false, is_demo: false, documents: [doc('d-gh', 'registration-certificate.pdf', 'registration_proof')] }
  t.accountMeta['u-freshfoods'] = { created_at: ago(1500), sent_at: ago(1500), verified: false, is_demo: false, documents: [doc('d-ff', 'trade-license.jpg', 'trade_license', 'image/jpeg')] }
  t.accountMeta['u-youth'] = { created_at: ago(5000), sent_at: ago(5000), verified: false, is_demo: false, documents: [doc('d-yc', 'approval-letter.png', 'registration_proof', 'image/png')] }
  t.accountMeta['u-demosponsor'] = { created_at: ago(20000), sent_at: ago(20000), verified: false, is_demo: true, documents: [] }
  t.accountMeta['u-mahir'] = { created_at: ago(30000), sent_at: ago(30000), verified: false, is_demo: true, documents: [] }

  // Money needs that were paid, so the payments page has every state
  t.needs.push(
    { id: 'n-sprize', project_id: 'p-science', type: 'money', title: 'Prize money', quantity: 10000, unit: 'BDT', budget_item: 'prizes', status: 'covered' },
    { id: 'n-rprize', project_id: 'p-robotics', type: 'money', title: 'Prize money', quantity: 5000, unit: 'BDT', budget_item: 'prizes', status: 'covered' },
    { id: 'n-tmat', project_id: 'p-tailor', type: 'money', title: 'Materials', quantity: 3000, unit: 'BDT', budget_item: 'materials', status: 'covered' },
  )
  const money = (id: string, need_id: string, from: string, stage: DOffer['stage'], amount: number) =>
    t.offers.push({ id, need_id, from_user_id: from, request_id: null, stage, contribution_role: null, conditions: null, exclusive_category: null, amount, resource: null, slot_start: null, slot_end: null, created_at: ago(9000) })
  money('o-sprize', 'n-sprize', 'u-samplefoods', 'received', 10000)
  money('o-rprize', 'n-rprize', 'u-telecom', 'received', 5000)
  money('o-tmat', 'n-tmat', 'u-bakery', 'accepted', 3000)
  t.payments.push(
    { id: 'pay-sfair', offer_id: 'o-sprize', gross_amount: 10500, commission_amount: 500, net_amount: 10000, status: 'paid_out', paid_out_at: ago(50000), created_at: ago(70000) },
    { id: 'pay-robot', offer_id: 'o-rprize', gross_amount: 5250, commission_amount: 250, net_amount: 5000, status: 'succeeded', paid_out_at: null, created_at: ago(3000) },
    { id: 'pay-tmat', offer_id: 'o-tmat', gross_amount: 3150, commission_amount: 150, net_amount: 3000, status: 'failed', paid_out_at: null, created_at: ago(800) },
  )
  t.comments.push({ id: 'c-hidden', project_id: 'p-fest', user_id: 'u-mahir', parent_id: null, kind: 'comment', body: 'Anyone need a ride? Call me on 01700-000000.', status: 'hidden', created_at: ago(600) })
}

/** Admin facts for an account, with sensible defaults for accounts that have none. */
export function accountMeta(u: Me): AccountMeta {
  return (data.accountMeta[u.id] ??= {
    created_at: '2026-09-01T10:00:00+06:00',
    sent_at: '2026-09-01T10:00:00+06:00',
    verified: (u.role === 'organizer' || u.role === 'sponsor') && u.status === 'active',
    is_demo: false,
    documents: [],
  })
}

/** Rows for the general user screens: Aisha's trainer offer and the prototype discussion. */
function addUserSeed(t: Tables) {
  t.userExtras['u-aisha'] = { skills: ['Teaching', 'Smartphone help'], items: [] }
  t.userExtras['u-rahima'] = { skills: ['Tailoring'], items: ['Sewing machine'] }
  t.offers.push({
    id: 'o-aisha-trainer', need_id: 'n-trainers', from_user_id: 'u-aisha', request_id: null, stage: 'offered', contribution_role: 'trainer',
    conditions: null, exclusive_category: null, amount: null, resource: null, ...slot('2027-01-16', 14, 16), created_at: ago(400),
  })
  t.memberships.push({ id: 'mb-aisha-dig', user_id: 'u-aisha', project_id: 'p-digital', role: 'contributor', status: 'pending', offer_id: 'o-aisha-trainer' })
  for (let i = 0; i < 17; i++)
    t.memberships.push({ id: `mb-dig-p${i}`, user_id: `u-dig-${i}`, project_id: 'p-digital', role: 'participant', status: 'approved', offer_id: null })
  t.comments.push(
    { id: 'c-d1', project_id: 'p-digital', user_id: 'u-mahir', parent_id: null, kind: 'question', body: 'Do I need prior teaching experience to join?', status: 'visible', created_at: ago(2900) },
    { id: 'c-d2', project_id: 'p-digital', user_id: 'u-brightfuture', parent_id: 'c-d1', kind: 'reply', body: "Not at all! The program is beginner-friendly. We'll provide a short orientation and simple guides before the session.", status: 'visible', created_at: ago(2850) },
    { id: 'c-d3', project_id: 'p-digital', user_id: 'u-sara', parent_id: null, kind: 'comment', body: "Great! I've just joined and will be there. Looking forward to it!", status: 'visible', created_at: ago(1400) },
    { id: 'c-t1', project_id: 'p-tailor', user_id: 'u-rahima', parent_id: null, kind: 'question', body: 'Can I bring my own thread and needles?', status: 'visible', created_at: ago(500) },
  )
  t.notifications.push(
    { id: 'nt-u1', user_id: 'u-aisha', type: 'comment_replied', ref_id: 'c-1', read: false, created_at: ago(2900), text: 'CSE Society replied to your question on CSE Fest 2026.' },
    { id: 'nt-u2', user_id: 'u-aisha', type: 'membership_pending', ref_id: 'mb-aisha-dig', read: false, created_at: ago(400), text: 'Your offer to be a trainer at Digital Learning Session is waiting for the organizer.' },
  )
}

/** Extra rows so the sponsor screens match the prototype (inbox, my offers, report). */
function addSponsorSeed(t: Tables) {
  const DIG = '2027-01-16'
  t.projects.push(
    {
      id: 'p-digital', organizer_id: 'u-brightfuture', template_id: 't-ngo', name: 'Digital Learning Session', status: 'live', created_at: ago(8000),
      purpose: 'Help community members get online.',
      description: 'A hands-on session to help 50 community members learn basic smartphone, email and online service skills.',
      event_date: DIG, venue: 'Mirpur community hall', audience: 50, institution: 'Bright Future NGO (NGO-1187)',
    },
    {
      id: 'p-science', organizer_id: 'u-scienceclub', template_id: 't-uni', name: 'Spring Science Fair', status: 'complete', created_at: ago(90000),
      purpose: 'Students show science projects to the public.', description: 'A one-day fair where 120 students show science projects to families.',
      event_date: '2026-10-10', venue: 'Science faculty lawn', audience: 300, institution: 'University of Dhaka',
    },
    {
      id: 'p-robotics', organizer_id: 'u-scienceclub', template_id: 't-uni', name: 'Robotics Club Demo Day', status: 'live', created_at: ago(40000),
      purpose: 'Show school students what robotics clubs build.', description: 'Robotics club members demo their robots to 80 school students.',
      event_date: '2026-11-15', venue: 'Engineering building', audience: 80, institution: 'University of Dhaka',
    },
  )
  t.needs.push(
    { id: 'n-trainers', project_id: 'p-digital', type: 'skill', title: 'Trainers', quantity: 3, unit: 'trainers', status: 'open', ...slot(DIG, 14, 16) },
    { id: 'n-guides', project_id: 'p-digital', type: 'product', title: 'Printed guides', quantity: 50, unit: 'copies', status: 'open' },
    { id: 'n-dvenue', project_id: 'p-digital', type: 'space', title: 'Venue', quantity: 1, unit: 'room for 50', status: 'covered', ...slot(DIG, 14, 16) },
    { id: 'n-transport', project_id: 'p-digital', type: 'money', title: 'Transport money', quantity: 5000, unit: 'BDT', budget_item: 'transport', status: 'covered' },
    { id: 'n-ssnacks', project_id: 'p-science', type: 'product', title: 'Snack packs', quantity: 150, unit: 'packs', status: 'covered' },
    { id: 'n-stables', project_id: 'p-science', type: 'equipment', title: 'Display tables', quantity: 30, unit: 'tables', status: 'covered' },
    { id: 'n-rhall', project_id: 'p-robotics', type: 'space', title: 'Venue', quantity: 1, unit: 'hall', status: 'open', ...slot('2026-11-15', 10, 15) },
  )
  const req = (id: string, project_id: string, need_id: string, sponsor_id: string, benefits: string[], mins: number, decide_by: string | null = null) =>
    t.requests.push({ id, project_id, need_id, sponsor_id, benefits, conditions: null, exclusive_category: null, decide_by, deliver_by: null, created_at: ago(mins) })
  req('r-guides', 'p-digital', 'n-guides', 'u-examplesoft', ['Logo on printed guides'], 3000, '2026-12-20')
  req('r-transport', 'p-digital', 'n-transport', 'u-examplesoft', ['Thank-you on stage', 'Impact report after the event'], 2500, '2026-12-10')
  req('r-dvenue', 'p-digital', 'n-dvenue', 'u-campus', ['Thank-you on stage'], 2600)
  req('r-machine', 'p-tailor', 'n-machine', 'u-examplesoft', ['Thank-you at the workshop'], 1800)
  req('r-machine-campus', 'p-tailor', 'n-machine', 'u-campus', ['Thank-you at the workshop'], 1900)
  req('r-ssnacks', 'p-science', 'n-ssnacks', 'u-examplesoft', ['Logo on the main banner', 'Thank-you on stage'], 80000)
  req('r-stables', 'p-science', 'n-stables', 'u-campus', ['Thank-you on stage'], 80000)
  req('r-rhall', 'p-robotics', 'n-rhall', 'u-examplesoft', ['Logo on the main banner'], 30000)
  const prize = t.requests.find((r) => r.id === 'r-prize')
  if (prize) prize.benefits = ['Logo on the main banner', 'Thank-you on stage', 'Impact report after the event']

  const offer = (o: Partial<DOffer> & Pick<DOffer, 'id' | 'need_id' | 'from_user_id' | 'stage'>) =>
    t.offers.push({ request_id: null, contribution_role: null, conditions: null, exclusive_category: null, amount: null, resource: null, slot_start: null, slot_end: null, created_at: ago(1000), ...o })
  offer({ id: 'o-guides', need_id: 'n-guides', from_user_id: 'u-examplesoft', request_id: 'r-guides', stage: 'offered', conditions: 'Printed in Bangla and English.', created_at: ago(2000) })
  offer({ id: 'o-transport', need_id: 'n-transport', from_user_id: 'u-examplesoft', request_id: 'r-transport', stage: 'accepted', amount: 5000, created_at: ago(2200) })
  offer({ id: 'o-dvenue', need_id: 'n-dvenue', from_user_id: 'u-campus', request_id: 'r-dvenue', stage: 'accepted', resource: 'hall', ...slot(DIG, 14, 16) })
  offer({ id: 'o-machine-es', need_id: 'n-machine', from_user_id: 'u-examplesoft', request_id: 'r-machine', stage: 'declined', resource: 'sewing machine', ...slot('2027-01-09', 15, 17), created_at: ago(1500) })
  offer({ id: 'o-machine-campus', need_id: 'n-machine', from_user_id: 'u-campus', request_id: 'r-machine-campus', stage: 'accepted', resource: 'sewing machine', ...slot('2027-01-09', 15, 17), created_at: ago(1600) })
  offer({ id: 'o-ssnacks', need_id: 'n-ssnacks', from_user_id: 'u-examplesoft', request_id: 'r-ssnacks', stage: 'received', created_at: ago(70000) })
  offer({ id: 'o-stables', need_id: 'n-stables', from_user_id: 'u-campus', request_id: 'r-stables', stage: 'received', created_at: ago(70000) })
  offer({ id: 'o-rhall', need_id: 'n-rhall', from_user_id: 'u-examplesoft', request_id: 'r-rhall', stage: 'expired', resource: 'hall', ...slot('2026-11-15', 10, 15), created_at: ago(29000) })
  t.benefits.push(
    { id: 'b-g1', offer_id: 'o-guides', label: 'Logo on printed guides', given: false, given_at: null },
    { id: 'b-t1', offer_id: 'o-transport', label: 'Thank-you on stage', given: false, given_at: null },
    { id: 'b-t2', offer_id: 'o-transport', label: 'Impact report after the event', given: false, given_at: null },
    { id: 'b-s1', offer_id: 'o-ssnacks', label: 'Logo on the main banner', given: true, given_at: ago(60000) },
    { id: 'b-s2', offer_id: 'o-ssnacks', label: 'Thank-you on stage', given: true, given_at: ago(60000) },
  )
  t.receipts.push({ offer_id: 'o-ssnacks', received_at: ago(64000) }, { offer_id: 'o-stables', received_at: ago(64000) })
  for (let i = 0; i < 6; i++)
    t.memberships.push({ id: `mb-sci-${i}`, user_id: `u-sci-${i}`, project_id: 'p-science', role: i < 4 ? 'participant' : 'contributor', status: 'approved', offer_id: null })
  t.memberships.push({ id: 'mb-dig-1', user_id: 'u-rahima', project_id: 'p-digital', role: 'participant', status: 'approved', offer_id: null })
  t.threads.push(
    { id: 'th-guides', request_id: 'r-guides', organizer_id: 'u-brightfuture', sponsor_id: 'u-examplesoft' },
    { id: 'th-transport', request_id: 'r-transport', organizer_id: 'u-brightfuture', sponsor_id: 'u-examplesoft' },
    { id: 'th-machine', request_id: 'r-machine', organizer_id: 'u-cse', sponsor_id: 'u-examplesoft' },
    { id: 'th-ssnacks', request_id: 'r-ssnacks', organizer_id: 'u-scienceclub', sponsor_id: 'u-examplesoft' },
    { id: 'th-rhall', request_id: 'r-rhall', organizer_id: 'u-scienceclub', sponsor_id: 'u-examplesoft' },
  )
  t.messages.push({ id: 'ms-t1', thread_id: 'th-transport', sender_id: 'u-brightfuture', body: 'Thank you! We accepted your offer. Please pay when you can.', read: false, created_at: ago(1200) })
  t.notes['p-science'] = 'Thank you for the snack packs! 300 visitors came and every student got lunch.'
  t.notifications.push(
    { id: 'nt-s1', user_id: 'u-examplesoft', type: 'request_received', ref_id: 'r-prize', read: false, created_at: ago(300), text: 'CSE Society sent you a request for the prize fund (CSE Fest 2026).' },
    { id: 'nt-s2', user_id: 'u-examplesoft', type: 'offer_accepted', ref_id: 'o-transport', read: false, created_at: ago(1200), text: 'Bright Future NGO accepted your BDT 5,000 offer. You can pay now.' },
    { id: 'nt-s3', user_id: 'u-examplesoft', type: 'offer_declined', ref_id: 'o-machine-es', read: true, created_at: ago(1400), text: 'Tailoring Repair Workshop chose another offer for the sewing machine.' },
  )
}

const KEY = 'mp-demo-data-v4'

function load(): Tables {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Tables
  } catch {
    /* fall back to seed */
  }
  return seedTables()
}

export const data = load()

export function saveData() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`
export const nowIso = () => new Date().toISOString()
export type { NeedType }
