import { ChevronDown, CircleCheck, Clock3, Plus, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import { Fragment, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  organizerApi,
  useComments,
  useGaps,
  useMatches,
  useMyProjects,
  useOffers,
  useProject,
  useProjectAction,
  useReadiness,
} from '../../api/organizer'
import type { GapRow, Need, Offer, OfferConflict, Project, SponsorMatch } from '../../api/types'
import { Card, EmptyNote, Modal, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { formatDate, NEED_TYPE_LABEL, needAmount, qtyText, slotText } from '../../lib/format'
import NeedFields, { emptyDraft, needErrors, needFromDraft } from './NeedFields'
import NeedRequestsPanel from './NeedRequestsPanel'
import SendRequestDialog from './SendRequestDialog'
import { SponsorProfileLink } from './SponsorProfileModal'
import { useTrackProject } from './OrganizerLayout'

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
const TYPE_LABEL: Record<string, string> = {
  university_event: 'University event',
  ngo_project: 'NGO project',
  elders_youth: 'Elders and youth activity',
}
const STATUS_LABEL = { draft: 'Draft', live: 'Live', complete: 'Complete' }

/** Organizer dashboard for one project (prototype "1 · Organizer dashboard"). */
export default function ProjectDashboard() {
  const id = useTrackProject()
  const project = useProject(id)

  if (project.isPending) return <Spinner />
  if (project.isError)
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Notice tone="error">{errText(project.error)}</Notice>
      </main>
    )
  const p = project.data

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Header project={p} />
      {p.status === 'draft' && <DraftBanner project={p} />}
      <ReadinessRow projectId={p.id} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <NeedsCard projectId={p.id} />
          <OffersCard projectId={p.id} />
        </div>
        <aside className="flex flex-col gap-6">
          {p.status === 'live' && <Suggestions project={p} />}
          <Contributors projectId={p.id} />
          <Questions projectId={p.id} />
        </aside>
      </div>
    </main>
  )
}

function Header({ project: p }: { project: Project }) {
  const { data: projects } = useMyProjects()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[15px] text-ink-soft">
          {TYPE_LABEL[p.project_type ?? ''] ?? 'Project'} · {STATUS_LABEL[p.status]}
        </p>
        <h1 className="text-[34px] leading-tight font-bold">{p.name}</h1>
        <p className="text-ink-soft">
          {formatDate(p.event_date)} · {p.venue} · {p.audience.toLocaleString('en-US')} expected
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {projects && projects.length > 1 && (
          <label className="flex items-center gap-2 text-[15px] font-bold">
            <span className="sr-only sm:not-sr-only">Project</span>
            <select
              value={p.id}
              onChange={(e) => navigate(`/organizer/projects/${e.target.value}`)}
              className="min-h-11 rounded-lg border border-[#C9C3B6] bg-white px-3 font-normal"
            >
              {projects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({STATUS_LABEL[x.status]})
                </option>
              ))}
            </select>
          </label>
        )}
        {p.status !== 'complete' && (
          <button type="button" className={`${smallBtn.primary} min-h-12 px-5`} onClick={() => setAdding(true)}>
            <Plus className="size-5" aria-hidden /> Add a need
          </button>
        )}
      </div>
      <AddNeedDialog projectId={p.id} open={adding} onClose={() => setAdding(false)} />
    </section>
  )
}

function DraftBanner({ project }: { project: Project }) {
  const publish = useProjectAction(project.id, () => organizerApi.publish(project.id))
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#E9C9A8] bg-[#FDF3E8] px-5 py-4">
      <div>
        <p className="font-bold">This project is a draft.</p>
        <p className="text-[15px] text-ink-soft">
          Publish it so people can join and you get sponsor suggestions. You can still change needs while they are open.
        </p>
        {publish.isError && <p className="mt-1 font-bold text-warning">{errText(publish.error)}</p>}
      </div>
      <button type="button" className={smallBtn.primary} disabled={publish.isPending} onClick={() => publish.mutate(undefined)}>
        {publish.isPending ? 'Publishing…' : 'Publish project'}
      </button>
    </div>
  )
}

function ReadinessRow({ projectId }: { projectId: string }) {
  const { data } = useReadiness(projectId)
  return (
    <section aria-label="Readiness checks" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {(data?.checks ?? []).map((c) => (
        <div key={c.key} className="rounded-xl border border-[#E2DED5] bg-white px-4 py-3.5">
          <div className="text-[15px] text-ink-soft">{c.label}</div>
          <div className={`mt-0.5 flex items-center gap-1.5 text-xl font-bold ${c.ok ? 'text-accent' : 'text-warning'}`}>
            {c.ok ? <CircleCheck className="size-5" aria-hidden /> : <Clock3 className="size-5" aria-hidden />}
            {c.value}
          </div>
          <div className="text-sm text-ink-soft">{c.detail}</div>
        </div>
      ))}
    </section>
  )
}

function gapPill(r: GapRow) {
  if (r.state === 'received') return <Pill tone="received">Received</Pill>
  if (r.state === 'covered') return <Pill tone="covered">{r.booked ? 'Covered · booked' : 'Covered · awaiting delivery'}</Pill>
  return <Pill tone="open">Open</Pill>
}

function NeedsCard({ projectId }: { projectId: string }) {
  const { data: gaps } = useGaps(projectId)
  const { data: project } = useProject(projectId)
  const needById = new Map<string, Need>(project?.needs.map((n) => [n.id, n]) ?? [])
  const remove = useProjectAction(projectId, (needId: string) => organizerApi.deleteNeed(needId))
  // The need whose requests panel is open (one at a time)
  const [openNeed, setOpenNeed] = useState<string | null>(null)

  return (
    <Card title="Needs" aside={<span className="text-[15px] text-ink-soft">Each need keeps its own unit</span>}>
      {!gaps ? (
        <Spinner />
      ) : gaps.needs.length === 0 ? (
        <EmptyNote>No needs yet. Use “Add a need” to list what this project needs.</EmptyNote>
      ) : (
        <>
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[15px]">
              <thead>
                <tr className="text-sm text-ink-soft">
                  <th className="px-2 pb-2 font-bold">Need</th>
                  <th className="px-2 pb-2 font-bold">Type</th>
                  <th className="px-2 pb-2 font-bold">Amount</th>
                  <th className="px-2 pb-2 font-bold">Status</th>
                  <th className="px-2 pb-2 font-bold">Covered by</th>
                  <th className="px-2 pb-2">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gaps.needs.map((r) => {
                  const n = needById.get(r.need_id)
                  const expanded = openNeed === r.need_id
                  return (
                    <Fragment key={r.need_id}>
                    <tr className="border-t border-[#F0EDE6]">
                      <td className="px-2 py-3 font-bold">{r.title}</td>
                      <td className="px-2 py-3">{NEED_TYPE_LABEL[r.type]}</td>
                      <td className="px-2 py-3">{n ? needAmount(n) : qtyText(r)}</td>
                      <td className="px-2 py-3">{gapPill(r)}</td>
                      <td className="px-2 py-3">
                        {/* Opens the requests sent for this need, and a sponsor search */}
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`requests-${r.need_id}`}
                          onClick={() => setOpenNeed(expanded ? null : r.need_id)}
                          className={`inline-flex min-h-11 items-center gap-1 text-left underline underline-offset-2 ${
                            r.covered_by ? 'font-semibold' : 'text-accent font-semibold'
                          }`}
                        >
                          {r.covered_by ?? (r.note === 'No requests yet' ? 'No requests yet · find a sponsor' : r.note)}
                          <ChevronDown className={`size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                        </button>
                      </td>
                      <td className="px-2 py-3 text-right">
                        {r.state === 'open' && r.note === 'No requests yet' && (
                          <button
                            type="button"
                            className="min-h-11 px-2 text-[15px] font-bold text-warning underline underline-offset-2"
                            onClick={() => confirm(`Remove “${r.title}”?`) && remove.mutate(r.need_id)}
                          >
                            Remove<span className="sr-only"> {r.title}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && project && (
                      <tr id={`requests-${r.need_id}`}>
                        <td colSpan={6} className="px-2 pb-4">
                          <NeedRequestsPanel project={project} needId={r.need_id} needTitle={r.title} />
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {remove.isError && <p className="mt-2 font-bold text-warning">{errText(remove.error)}</p>}
          <p className="mt-4 rounded-[10px] bg-[#FDF3E8] px-4 py-3">
            <strong>{gaps.summary.startsWith('Still needed') ? 'Still needed:' : ''}</strong>{' '}
            {gaps.summary.replace(/^Still needed: /, '')}
          </p>
        </>
      )}
    </Card>
  )
}

function OfferCard({ o, onAccept, onDecline, busy }: { o: Offer; onAccept: () => void; onDecline: () => void; busy: boolean }) {
  const details = [
    o.amount ? qtyText({ type: 'money', quantity: o.amount, unit: 'BDT' }) : null,
    o.conditions,
    o.exclusive_category ? `exclusive: ${o.exclusive_category}` : null,
    o.benefits.length ? o.benefits.map((b) => b.label.toLowerCase()).join(', ') : null,
    slotText(o.slot_start, o.slot_end),
  ].filter(Boolean)
  return (
    <div className="rounded-xl border border-[#E2DED5] bg-white p-4">
      {/* Sponsor offers link to the sponsor's profile; contributor offers come from general users */}
      {o.contribution_role ? (
        <div className="font-bold">{o.from_name}</div>
      ) : (
        <SponsorProfileLink sponsorId={o.from_user_id} name={o.from_name} />
      )}
      <div className="text-sm text-ink-soft">For: {o.need_title}</div>
      {details.length > 0 && <div className="mt-1 text-[15px] text-ink-soft">{details.join(' · ')}</div>}
      <div className="mt-3 flex gap-2">
        <button type="button" className={smallBtn.primary} onClick={onAccept} disabled={busy}>
          Accept<span className="sr-only"> offer from {o.from_name}</span>
        </button>
        <button type="button" className={smallBtn.secondary} onClick={onDecline} disabled={busy}>
          Decline<span className="sr-only"> offer from {o.from_name}</span>
        </button>
      </div>
    </div>
  )
}

function OffersCard({ projectId }: { projectId: string }) {
  const { data } = useOffers(projectId)
  const act = useProjectAction(projectId, ({ id, accept }: { id: string; accept: boolean }) =>
    accept ? organizerApi.acceptOffer(id) : organizerApi.declineOffer(id),
  )
  const waiting = data?.offers.filter((o) => o.stage === 'offered' && !o.contribution_role) ?? []
  const groups: { conflict: OfferConflict | null; offers: Offer[] }[] = []
  const used = new Set<string>()
  for (const c of data?.conflicts ?? []) {
    const list = waiting.filter((o) => c.offer_ids.includes(o.id) && !used.has(o.id))
    if (list.length > 1) {
      list.forEach((o) => used.add(o.id))
      groups.push({ conflict: c, offers: list })
    }
  }
  waiting.filter((o) => !used.has(o.id)).forEach((o) => groups.push({ conflict: null, offers: [o] }))

  const run = (id: string, accept: boolean) => act.mutate({ id, accept })

  return (
    <Card title="Offers to review">
      {act.isError && (
        <div className="mb-3">
          <Notice tone="error">{errText(act.error)}</Notice>
        </div>
      )}
      {!data ? (
        <Spinner />
      ) : groups.length === 0 ? (
        <EmptyNote>No offers are waiting. New offers from sponsors show up here.</EmptyNote>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g, i) =>
            g.conflict ? (
              <div key={i} className="rounded-xl border-2 border-[#C4622D] bg-[#FFF8F2] p-4">
                <p className="mb-3 flex items-center gap-2 font-bold text-[#8F2E21]">
                  <TriangleAlert className="size-5" aria-hidden /> Conflict: {g.conflict.reason.toLowerCase()}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.offers.map((o) => (
                    <OfferCard key={o.id} o={o} busy={act.isPending} onAccept={() => run(o.id, true)} onDecline={() => run(o.id, false)} />
                  ))}
                </div>
                <p className="mt-3 text-[15px] text-ink-soft">Accepting one declines the other and notifies them.</p>
              </div>
            ) : (
              <OfferCard key={g.offers[0].id} o={g.offers[0]} busy={act.isPending} onAccept={() => run(g.offers[0].id, true)} onDecline={() => run(g.offers[0].id, false)} />
            ),
          )}
        </div>
      )}
    </Card>
  )
}

function Suggestions({ project }: { project: Project }) {
  const { data, error } = useMatches(project.id)
  const [requesting, setRequesting] = useState<SponsorMatch | null>(null)
  const dismiss = useProjectAction(project.id, (id: string) => organizerApi.dismissMatch(id))
  const refresh = useProjectAction(project.id, () => organizerApi.generateMatches(project.id))
  const suggested = data?.matches.filter((m) => m.status === 'suggested') ?? []
  const openNeeds = project.needs.filter((n) => n.status === 'open')

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-5 text-accent" aria-hidden /> AI sponsor suggestions
        </span>
      }
      aside={
        data && (
          <span className="rounded-full bg-[#EFEDE8] px-3 py-1 text-sm font-bold">
            {data.requests_left} of 5 requests left
          </span>
        )
      }
    >
      {error && <Notice tone="error">{error.message}</Notice>}
      {refresh.isError && <Notice tone="error">{refresh.error instanceof Error ? refresh.error.message : 'Could not generate suggestions.'}</Notice>}
      {!data && !error ? (
        <Spinner />
      ) : data ? (
        <div className="flex flex-col gap-3">
          {suggested.length === 0 && <EmptyNote>No new suggestions right now.</EmptyNote>}
          {suggested.map((m) => (
            <div key={m.id} className="rounded-xl border border-[#E2DED5] p-4">
              <div className="flex items-start justify-between gap-3">
                <SponsorProfileLink sponsorId={m.sponsor_id} name={m.sponsor_name} />
                <div className="text-lg font-bold text-accent" aria-label={`Match score ${m.score} out of 100`}>
                  {m.score}
                </div>
              </div>
              <p className="mt-1 text-[15px] text-ink-soft">{m.reason}</p>
              <p className="mt-1 text-xs text-ink-soft">{m.source === 'ai' ? 'AI suggestion — review the sponsor profile before sending a request.' : 'Earlier rule-based suggestion. Refresh for an AI assessment.'}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className={smallBtn.primary}
                  onClick={() => setRequesting(m)}
                  disabled={data.requests_left <= 0 || openNeeds.length === 0}
                >
                  Send request
                </button>
                <button type="button" className={smallBtn.secondary} onClick={() => dismiss.mutate(m.id)} disabled={dismiss.isPending}>
                  Dismiss<span className="sr-only"> {m.sponsor_name}</span>
                </button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-soft">
            <span>Scores are visible only to you.</span>
            <button
              type="button"
              onClick={() => refresh.mutate(undefined)}
              disabled={refresh.isPending || openNeeds.length === 0}
              className="inline-flex min-h-11 items-center gap-1.5 font-bold text-accent"
            >
              <RefreshCw className={`size-4 ${refresh.isPending ? 'animate-spin' : ''}`} aria-hidden /> {refresh.isPending ? 'Finding sponsors…' : 'Find sponsors with AI'}
            </button>
          </div>
        </div>
      ) : null}
      <SendRequestDialog project={project} match={requesting} onClose={() => setRequesting(null)} />
    </Card>
  )
}

function AddNeedDialog({ projectId, open, onClose }: { projectId: string; open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState(emptyDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const add = useProjectAction(projectId, () => organizerApi.addNeed(projectId, needFromDraft(draft)))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs = needErrors(draft)
    setErrors(errs)
    if (Object.keys(errs).length) return
    add.mutate(undefined, {
      onSuccess: () => {
        setDraft(emptyDraft())
        onClose()
      },
    })
  }
  return (
    <Modal open={open} onClose={onClose} title="Add a need">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {add.isError && <Notice tone="error">{errText(add.error)}</Notice>}
        <NeedFields value={draft} onChange={setDraft} errors={errors} />
        <div className="flex justify-end gap-2">
          <button type="button" className={smallBtn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={smallBtn.primary} disabled={add.isPending}>
            {add.isPending ? 'Adding…' : 'Add need'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Contributors({ projectId }: { projectId: string }) {
  const { data } = useOffers(projectId)
  const act = useProjectAction(projectId, ({ id, ok }: { id: string; ok: boolean }) =>
    ok ? organizerApi.approveMembership(id) : organizerApi.rejectMembership(id),
  )
  const waiting = data?.offers.filter((o) => o.contribution_role && o.membership_status === 'pending') ?? []
  return (
    <Card title="Contributors waiting">
      {waiting.length === 0 ? (
        <EmptyNote>No one is waiting for approval.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-3">
          {waiting.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">{o.from_name}</div>
                <div className="text-[15px] text-ink-soft">
                  {o.contribution_role === 'trainer' ? 'Trainer' : o.need_title}
                  {slotText(o.slot_start, o.slot_end) ? `, ${slotText(o.slot_start, o.slot_end)}` : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" className={smallBtn.primary} disabled={act.isPending} onClick={() => act.mutate({ id: o.membership_id!, ok: true })}>
                  Approve<span className="sr-only"> {o.from_name}</span>
                </button>
                <button type="button" className={smallBtn.secondary} disabled={act.isPending} onClick={() => act.mutate({ id: o.membership_id!, ok: false })}>
                  Reject<span className="sr-only"> {o.from_name}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Questions({ projectId }: { projectId: string }) {
  const { data: comments } = useComments(projectId)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [held, setHeld] = useState(false)
  const reply = useProjectAction(projectId, (parent: string) =>
    organizerApi.postComment(projectId, { kind: 'reply', body: text, parent_id: parent }).then((result) => {
      setHeld(result.status === 'hidden')
      return result
    }),
  )
  const hide = useProjectAction(projectId, (id: string) => organizerApi.hideComment(id))

  const open = (comments ?? []).filter(
    (c) => c.kind === 'question' && c.status === 'visible' && !comments!.some((r) => r.parent_id === c.id),
  )

  return (
    <Card title="New questions">
      {held && <Notice>Your reply was not published. Only admins can view it for review.</Notice>}
      {reply.isError && <Notice tone="error">{reply.error instanceof Error ? reply.error.message : 'Could not post reply.'}</Notice>}
      {open.length === 0 ? (
        <EmptyNote>No unanswered questions.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-3">
          {open.map((c) => (
            <li key={c.id} className="rounded-xl bg-paper p-4">
              <div className="text-sm text-ink-soft">Question · {c.author_name}</div>
              <p className="mt-1">{c.body}</p>
              {replyTo === c.id ? (
                <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!text.trim()) return
                    reply.mutate(c.id, {
                      onSuccess: () => {
                        setText('')
                        setReplyTo(null)
                      },
                    })
                  }}
                >
                  <label className="sr-only" htmlFor={`reply-${c.id}`}>
                    Your reply to {c.author_name}
                  </label>
                  <textarea
                    id={`reply-${c.id}`}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    className="w-full rounded-[10px] border border-[#C9C3B6] bg-white px-3 py-2"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button type="submit" className={smallBtn.primary} disabled={reply.isPending}>
                      Post reply
                    </button>
                    <button type="button" className={smallBtn.secondary} onClick={() => setReplyTo(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button type="button" className={smallBtn.primary} onClick={() => setReplyTo(c.id)}>
                    Reply
                  </button>
                  <button type="button" className={smallBtn.secondary} onClick={() => hide.mutate(c.id)} disabled={hide.isPending}>
                    Hide
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-ink-soft">Replies are checked before publication. Only admins can view hidden comments.</p>
    </Card>
  )
}
