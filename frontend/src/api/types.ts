// Types that mirror the FastAPI schemas (build prompt sections 5 and 7).

export type UserRole = 'general' | 'organizer' | 'sponsor' | 'admin'
export type AccountStatus = 'pending_approval' | 'active' | 'rejected' | 'suspended'
export type OrgType = 'ngo' | 'university' | 'community_group'
export type DocumentKind = 'registration_proof' | 'trade_license'

export type OrganizerProfile = {
  org_name: string
  org_type: OrgType
  registration_number: string
  contact_person: string
  phone: string
}

export type SponsorProfile = {
  company: string
  industry: string
  trade_license_number: string
  contact_person: string
  phone: string
  interests: string[]
  preferred_types: string[]
  location: string | null
  description: string | null
}

/** GET /api/auth/me */
export type Me = {
  id: string
  email: string
  role: UserRole
  status: AccountStatus
  name: string
  age: number | null
  rejection_note: string | null
  profile: OrganizerProfile | SponsorProfile | null
}

/** Error body from FastAPI: { detail, code } */
export type ApiErrorBody = { detail: string; code?: string }

// ---------------------------------------------------------------------------
// Projects, needs and sponsorship (build prompt 5.1, 5.2, 7.3)

export type ProjectStatus = 'draft' | 'live' | 'complete'
export type NeedType = 'money' | 'product' | 'skill' | 'time' | 'equipment' | 'space'
export type NeedStatus = 'open' | 'covered'
export type OfferStage = 'offered' | 'accepted' | 'received' | 'declined' | 'withdrawn' | 'expired'
export type ContributionRole = 'trainer' | 'contributor'
export type MembershipStatus = 'pending' | 'approved' | 'rejected'
export type MatchStatus = 'suggested' | 'requested' | 'dismissed'
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'paid_out' | 'refund_due' | 'refunded'

/** A need as sent when creating a project or adding a need */
export type NeedInput = {
  type: NeedType
  title: string
  quantity: number
  unit: string
  budget_item?: string | null
  slot_start?: string | null
  slot_end?: string | null
  deadline?: string | null
}

export type Need = NeedInput & { id: string; project_id: string; status: NeedStatus }

/** GET /templates */
export type Template = {
  id: string
  name: string
  project_type: string
  /** One line shown on the template card */
  blurb: string
  default_needs: NeedInput[]
  status: 'live' | 'draft'
}

export type ProjectInput = {
  template_id: string | null
  name: string
  purpose: string
  description: string
  event_date: string
  venue: string
  audience: number
  institution: string | null
  needs: NeedInput[]
}

/** GET /projects/{id} */
export type Project = Omit<ProjectInput, 'needs'> & {
  id: string
  organizer_id: string
  project_type: string | null
  status: ProjectStatus
  needs: Need[]
}

/** GET /projects/mine */
export type ProjectSummary = {
  id: string
  name: string
  status: ProjectStatus
  event_date: string
  open_needs: number
  total_needs: number
}

/** One row of GET /projects/{id}/gaps */
export type GapRow = {
  need_id: string
  title: string
  type: NeedType
  quantity: number
  unit: string
  /** open, covered (accepted, not yet arrived) or received */
  state: 'open' | 'covered' | 'received'
  booked: boolean
  covered_by: string | null
  /** e.g. "2 requests sent", "4 contributors pending" */
  note: string | null
}

export type Gaps = { needs: GapRow[]; summary: string }

/** GET /projects/{id}/readiness: plan works, commitments covered, items received, activity confirmed */
export type ReadinessCheck = {
  key: 'plan' | 'commitments' | 'items' | 'activity'
  label: string
  ok: boolean
  value: string
  detail: string
}
export type Readiness = { checks: ReadinessCheck[]; can_complete: boolean }

/** GET /projects/{id}/sponsor-matches. Scores are only ever shown to the organizer. */
export type SponsorMatch = {
  id: string
  sponsor_id: string
  sponsor_name: string
  score: number
  reason: string
  source?: 'ai' | 'rules'
  status: MatchStatus
}
export type SponsorMatchList = { matches: SponsorMatch[]; requests_left: number }

/** POST /projects/{id}/requests */
export type RequestInput = {
  need_id: string
  sponsor_id: string
  benefits: string[]
  conditions: string | null
  exclusive_category: string | null
  decide_by: string | null
  deliver_by: string | null
}

/** GET /projects/{id}/requests: one request already sent */
export type SentRequestState = 'waiting' | 'offer_received' | 'accepted' | 'received' | 'declined' | 'withdrawn' | 'expired'
export type SentRequest = {
  id: string
  need_id: string
  need_title: string
  sponsor_id: string
  sponsor_name: string
  created_at: string
  decide_by: string | null
  state: SentRequestState
  offer_id: string | null
  thread_id: string | null
}

/** GET /sponsors/{id}: what organizers see about a sponsor (never contact details) */
export type SponsorPublicProfile = {
  id: string
  name: string
  industry: string | null
  location: string | null
  interests: string[]
  preferred_types: NeedType[]
  description: string | null
  member_since: string
  /** Totals only */
  contributions_received: number
  projects_supported: number
}

/** GET /sponsors/search: a sponsor's public profile (never their contact details) */
export type SponsorSearchResult = {
  id: string
  name: string
  industry: string | null
  location: string | null
  interests: string[]
  /** Already asked for something in this project */
  requested: boolean
}

export type Benefit = { id: string; offer_id: string; label: string; given: boolean; given_at: string | null }

/** GET /projects/{id}/offers (includes the conflicts list) */
export type Offer = {
  id: string
  need_id: string
  need_title: string
  need_type: NeedType
  from_user_id: string
  from_name: string
  request_id: string | null
  stage: OfferStage
  contribution_role: ContributionRole | null
  conditions: string | null
  exclusive_category: string | null
  amount: number | null
  slot_start: string | null
  slot_end: string | null
  benefits: Benefit[]
  /** For contributor offers: their event membership */
  membership_id: string | null
  membership_status: MembershipStatus | null
  /** Money offers: latest payment status */
  payment_status: PaymentStatus | null
  created_at: string
}
export type OfferConflict = { offer_ids: string[]; reason: string }
export type OfferList = { offers: Offer[]; conflicts: OfferConflict[] }

export type CommentKind = 'comment' | 'question' | 'reply'
/** GET /events/{id}/comments */
export type Comment = {
  is_organizer?: boolean
  id: string
  project_id: string
  user_id: string
  author_name: string
  parent_id: string | null
  kind: CommentKind
  body: string
  status: 'visible' | 'hidden'
  created_at: string
}

/** GET /threads */
export type Thread = {
  id: string
  request_id: string
  project_id: string
  project_name: string
  need_title: string
  /** e.g. "Prize fund, BDT 20,000 · no offer yet" */
  request_summary: string
  organizer_name: string
  sponsor_name: string
  last_message: string | null
  last_at: string | null
  unread: number
}
export type Message = {
  id: string
  thread_id: string
  sender_id: string
  sender_name: string
  body: string
  read: boolean
  created_at: string
}

export type NotificationType =
  | 'request_received' | 'offer_received' | 'offer_accepted' | 'offer_declined' | 'offer_withdrawn'
  | 'offer_expired' | 'need_covered' | 'item_received' | 'membership_pending' | 'membership_approved'
  | 'membership_rejected' | 'payment_succeeded' | 'payment_failed' | 'payment_refund_due' | 'message_received'
  | 'comment_posted' | 'comment_replied' | 'registration_approved' | 'registration_rejected'

export type AppNotification = {
  id: string
  type: NotificationType
  ref_id: string | null
  read: boolean
  created_at: string
  /** Short plain-language line, written by the back end */
  text: string
}

/** GET /projects/{id}/report: totals only, never names, emails, ages or phones */
export type ProjectReport = {
  people_taking_part: number
  sessions_held: number
  money_received: number
  items_received: string[]
  needs_total: number
  needs_received: number
}

/** List endpoints accept ?limit=&offset= */
export type Page = { limit?: number; offset?: number }

// ---------------------------------------------------------------------------
// Sponsor (build prompt 7.4) and shared events (7.5 / 7.6)

/** Where a request stands for the sponsor, in plain words for the inbox */
export type RequestState = 'new' | 'offer_sent' | 'accepted' | 'received' | 'covered_by_other' | 'withdrawn' | 'expired'

/** GET /sponsor/requests */
export type SponsorRequestSummary = {
  id: string
  project_id: string
  project_name: string
  need_title: string
  /** "Prize fund · BDT 20,000" style amount */
  need_amount: string
  state: RequestState
  decide_by: string | null
  created_at: string
}

export type EventFacts = {
  id: string
  name: string
  project_type: string | null
  organizer_name: string
  institution: string | null
  event_date: string
  venue: string
  audience: number
  status: ProjectStatus
  participants: number
  contributors: number
}

/** GET /requests/{id} */
export type SponsorRequestDetail = {
  id: string
  project: EventFacts
  need: Need
  benefits: string[]
  conditions: string | null
  exclusive_category: string | null
  decide_by: string | null
  deliver_by: string | null
  state: RequestState
  thread_id: string | null
  /** This sponsor's latest offer on the request, if any */
  my_offer: Offer | null
}

/** POST /requests/{id}/offers. One offer covers the whole need. */
export type OfferInput = {
  conditions: string | null
  exclusive_category: string | null
  /** Money offers only; must equal the need amount */
  amount: number | null
}

/** GET /sponsor/offers */
export type SponsorOfferRow = {
  id: string
  request_id: string | null
  project_id: string
  project_name: string
  need_title: string
  need_type: NeedType
  /** "BDT 20,000", "50 copies", "1, Sat 3 to 5 pm" */
  offer_text: string
  amount: number | null
  stage: OfferStage
  benefits_given: number
  benefits_total: number
  payment_status: PaymentStatus | null
  project_status: ProjectStatus
}

/** GET /offers/{id}/payment-quote. Commission is 5%, added on top. */
export type PaymentQuote = {
  offer_id: string
  project_name: string
  organizer_name: string
  need_title: string
  amount: number
  commission: number
  total: number
  last_payment_status: PaymentStatus | null
  offer_stage: OfferStage
  project_id: string
  /** A payment was started in the last 15 minutes and has no answer yet */
  payment_in_progress: boolean
}

/** POST /offers/{id}/payments */
export type PaymentStart = { payment_id: string; checkout_url: string }

/** GET /sponsor/reports/{project_id}: totals only, no personal details */
export type SponsorReport = {
  project: EventFacts
  contribution: { what: string; need_title: string; received_at: string | null }
  benefits: Benefit[]
  results: { people_taking_part: number; contributors: number; sessions_held: number; needs_covered: number; needs_total: number }
  note: string | null
}

/** GET /events (view only for sponsors) */
export type EventSummary = EventFacts & { still_needed: string[]; open_needs: number; needs_money: boolean }

/** GET /events/{id}: program page data */
export type EventDetail = EventFacts & {
  description: string
  needs: (Need & { state: 'open' | 'covered' | 'received' })[]
}

// ---------------------------------------------------------------------------
// General user (build prompt 7.5)

export type MyMembership = { id: string; role: 'participant' | 'contributor'; status: MembershipStatus } | null

/** One post on GET /feed: a live program with counts and open needs */
export type FeedItem = EventFacts & {
  description: string
  posted_at: string
  still_needed: string[]
  /** Open needs people can help with (not money) */
  help_needed: { need_id: string; title: string; text: string }[]
  seats_left: number
  my_membership: MyMembership
  comment_count: number
  /** Latest two visible top-level comments, each with its first reply */
  comments_preview: (Comment & { reply: Comment | null })[]
}

/** GET /events/{id} for general users adds what they need to join or help */
export type ProgramDetail = EventDetail & {
  my_membership: MyMembership
  my_offer_id: string | null
  comment_count: number
  seats_left: number
}

/** POST /events/{id}/join */
export type JoinInput =
  | { role: 'participant' }
  | { role: 'contributor'; contribution_role: ContributionRole; need_id: string; slot_start?: string; slot_end?: string; switch_from_participant?: boolean }

/** GET /me/memberships: "My contributions" */
export type MyContribution = {
  membership_id: string
  role: 'participant' | 'contributor'
  status: MembershipStatus
  project: { id: string; name: string; event_date: string; venue: string; organizer_name: string; status: ProjectStatus }
  offer: {
    id: string
    stage: OfferStage
    need_title: string
    need_type: NeedType
    contribution_role: ContributionRole | null
    slot_start: string | null
    slot_end: string | null
  } | null
}

/** GET/PATCH /me/profile. Home addresses are never stored. */
export type MyProfile = { name: string; age: number | null; skills: string[]; items: string[] }

/** GET/PATCH /organizer/profile (not in the build prompt yet: see README note) */
export type OrganizerProfileView = OrganizerProfile & { email: string; status: AccountStatus }

// ---------------------------------------------------------------------------
// Admin (build prompt 7.2)

export type RegistrationStatus = 'pending' | 'approved' | 'rejected'

/** GET /admin/registrations?status= */
export type RegistrationSummary = {
  user_id: string
  name: string
  role: 'organizer' | 'sponsor'
  /** Organization type or industry */
  kind: string
  sent_at: string
  status: AccountStatus
  /** Which admin decided, and when (null while pending) */
  reviewed_by_name: string | null
  reviewed_at: string | null
}

export type RegistrationDocument = {
  id: string
  file_name: string
  content_type: string
  size_bytes: number
  kind: DocumentKind
}

/** GET /admin/registrations/{user_id} */
export type RegistrationDetail = {
  user_id: string
  role: 'organizer' | 'sponsor'
  status: AccountStatus
  email: string
  name: string
  sent_at: string
  rejection_note: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  profile: OrganizerProfile | SponsorProfile
  documents: RegistrationDocument[]
}

/** GET /admin/users */
export type AdminUser = {
  id: string
  name: string
  email: string
  role: UserRole
  status: AccountStatus
  verified: boolean
  is_demo: boolean
  created_at: string
}

/** GET /admin/payments */
export type AdminPayment = {
  id: string
  offer_id: string
  project_name: string
  sponsor_name: string
  gross_amount: number
  commission_amount: number
  net_amount: number
  status: PaymentStatus
  paid_out_at: string | null
  created_at: string
}

/** GET /admin/comments?status=hidden */
export type AdminComment = Comment & { project_name: string }

/** POST/PATCH /admin/templates */
export type TemplateInput = Omit<Template, 'id'>
