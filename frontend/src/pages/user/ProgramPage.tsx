import { Check, Clock3, MapPin, MessageCircleQuestion, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { addComment, joinAtOnce, refreshAfter, useProgram, useProgramComments, userApi, useUserAction } from '../../api/user'
import type { Comment, ProgramDetail } from '../../api/types'
import Notice from '../../components/ui/Notice'
import { SkeletonList } from '../../components/ui/Skeleton'
import { formatDate, slotText, timeAgo } from '../../lib/format'
import { acceptsApplications, programEnded, useDhakaToday } from '../../lib/programDates'
import { scheduleIssue } from '../../lib/needSchedule'
import LeaveProgramButton from './LeaveProgramButton'
import { card, Cover, DateBadge, membershipStatus, ubtn } from './bits'
import { CommentBubble } from './UserHome'

const TZ = 'Asia/Dhaka'

/**
 * Program page (prototype "General user B · Program page"): cover, details,
 * discussion, and a take-part panel where the choice (Participant or
 * Contributor) changes the button text.
 */
export default function ProgramPage() {
  const { id } = useParams()
  const { hash } = useLocation()
  const { data: p, isPending, isError, error } = useProgram(id!)

  // Links like "/programs/x#contribute" should land on that section.
  useEffect(() => {
    if (!p || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [p, hash])

  if (isPending)
    return (
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <SkeletonList count={2} />
      </main>
    )
  if (isError)
    return (
      <main className="mx-auto max-w-3xl p-6">
        <Notice tone="error">{error instanceof Error ? error.message : 'Could not load this program.'}</Notice>
      </main>
    )

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Hero p={p} />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <About p={p} />
          <Discussion p={p} />
        </div>
        <aside className="flex flex-col gap-6">
          <Details p={p} />
          <People p={p} />
          {/* Start fresh when the membership changes (e.g. after cancelling a seat) */}
          <Contribute key={p.my_membership?.role ?? "none"} p={p} />
        </aside>
      </div>
    </main>
  )
}

function Hero({ p }: { p: ProgramDetail }) {
  const today = useDhakaToday()
  const canApply = acceptsApplications(p, today)
  const join = useUserAction(
    () => userApi.join(p.id, { role: 'participant' }),
    () => refreshAfter.join(p.id),
    undefined,
    (qc) => joinAtOnce(qc, p.id), // shows "Attending" at once; corrected if the server says no
  )
  const day = new Date(`${p.event_date}T12:00:00+06:00`)
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ })
    .toUpperCase()
  const firstSlot = p.needs.find((n) => n.slot_start)
  const time = firstSlot ? slotText(firstSlot.slot_start, firstSlot.slot_end)?.split(' ').slice(1).join(' ') : null

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <Cover className="h-44 sm:h-56" />
      <div className="relative px-5 pb-2 sm:px-8">
        <div className="-mt-10 mb-3">
          <DateBadge date={p.event_date} size="lg" />
        </div>
        <p className="text-sm font-bold tracking-wide text-warning">
          {day}
          {time ? ` · ${time.toUpperCase()}` : ''}
        </p>
        <h1 className="text-3xl leading-tight font-bold sm:text-4xl">{p.name}</h1>
        <p className="mt-1 text-ink-soft">
          {p.venue} · Organized by <strong className="text-ink">{p.organizer_name}</strong>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!canApply ? (
            <p className="font-semibold">{programEnded(p, today) ? 'This program has ended' : 'This program is not accepting applications'}</p>
          ) : p.my_membership ? (
            membershipStatus(p.my_membership)
          ) : (
            <button type="button" className={ubtn.primary} onClick={() => join.mutate(undefined)} disabled={join.isPending || p.seats_left <= 0}>
              <Check className="size-5" aria-hidden /> {p.seats_left <= 0 ? 'Program is full' : 'Join as participant'}
            </button>
          )}
          {canApply && p.my_membership?.role === 'participant' && <LeaveProgramButton programId={p.id} programName={p.name} />}
          {canApply && p.my_membership?.role !== 'contributor' && p.needs.some((n) => n.state === 'open' && ['skill', 'time', 'equipment', 'space'].includes(n.type)) && (
            <a href="#contribute" className={ubtn.soft}>
              {p.my_membership?.role === 'participant' ? 'Switch to helping' : 'Offer to help'}
            </a>
          )}
          <a href="#discussion" className={ubtn.ghost}>
            <MessageCircleQuestion className="size-5" aria-hidden /> Ask a question
          </a>
        </div>
        {join.isError && (
          <div className="mt-3">
            <Notice tone="error">{join.error instanceof Error ? join.error.message : 'Could not join.'}</Notice>
          </div>
        )}
        <nav aria-label="Program sections" className="mt-5 flex gap-1 border-t border-black/5">
          {[
            ['about', 'About'],
            ['discussion', `Discussion (${p.comment_count})`],
            ['people', 'People'],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-12 items-center px-3 font-semibold text-ink-soft hover:text-user-accent">
              {label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  )
}

function About({ p }: { p: ProgramDetail }) {
  const helping = p.needs.filter((n) => n.type !== 'money')
  return (
    <section id="about" className={`${card} scroll-mt-36`}>
      <h2 className="text-xl font-bold">About the program</h2>
      <p className="mt-2">{p.description}</p>
      {helping.length > 0 && (
        <>
          <h3 className="mt-5 font-bold">What this program needs</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {helping.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-user-bg px-4 py-3">
                <span>
                  <strong>{n.title}</strong>
                  {slotText(n.slot_start, n.slot_end) ? `, ${slotText(n.slot_start, n.slot_end)}` : ''}
                </span>
                {n.state === 'open' ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-warning">
                    <Clock3 className="size-4" aria-hidden /> Still needed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-user-accent">
                    <Check className="size-4" aria-hidden /> Covered
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3 className="mt-5 font-bold">Ways to help</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Participant: come along and take part</li>
        <li>Contributor: teach a session, help on the day, give your time, or lend something listed above</li>
      </ul>
    </section>
  )
}

function Discussion({ p }: { p: ProgramDetail }) {
  const { data: comments, isPending: commentsLoading, error: commentsError } = useProgramComments(p.id)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const post = useUserAction(() =>
    userApi.postComment(p.id, {
      kind: replyTo ? 'reply' : text.trim().endsWith('?') ? 'question' : 'comment',
      body: text.trim(),
      parent_id: replyTo?.id ?? null,
    }),
    () => refreshAfter.comment(p.id),
    (qc, c) => addComment(qc, p.id, c),
  )
  const top = (comments ?? []).filter((c) => c.status === 'visible' && !c.parent_id)
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.status === 'visible' && c.parent_id === id)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    post.mutate(undefined, {
      onSuccess: () => {
        setText('')
        setReplyTo(null)
      },
    })
  }

  return (
    <section id="discussion" className={`${card} scroll-mt-36`}>
      <h2 className="text-xl font-bold">Discussion</h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
        {replyTo && (
          <p className="text-sm">
            Replying to <strong>{replyTo.author_name}</strong>{' '}
            <button type="button" className="min-h-11 font-semibold text-user-accent underline" onClick={() => setReplyTo(null)}>
              Cancel
            </button>
          </p>
        )}
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="sr-only">Write a comment</span>
            <input
              id="comment-box"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask a question or write a comment…"
              className="min-h-12 w-full rounded-full bg-user-bg px-4"
            />
          </label>
          <button type="submit" className={ubtn.primary} disabled={!text.trim() || post.isPending}>
            {post.isPending ? 'Checking…' : 'Post'}
          </button>
        </div>
        {post.isError && <Notice tone="error">{post.error instanceof Error ? post.error.message : 'Could not post.'}</Notice>}
        {post.isSuccess && post.data.status === 'hidden' && <Notice>Your comment was not published. Only admins can view it for review.</Notice>}
        <p className="text-sm text-ink-soft">Comments are checked before appearing publicly. Do not share phone numbers, email addresses or home addresses.</p>
      </form>
      {commentsLoading && <p className="mt-4">Loading comments…</p>}
      {commentsError && <Notice tone="error">{commentsError.message}</Notice>}
      <ul className="mt-5 flex flex-col gap-5">
        {!commentsLoading && !commentsError && top.length === 0 && <li className="text-ink-soft">No comments yet. Be the first to ask.</li>}
        {top.map((c) => (
          <li key={c.id} className="flex flex-col gap-3">
            <div>
              <CommentBubble name={c.author_name} body={c.body} />
              <p className="mt-1 pl-13 text-sm text-ink-soft">
                {timeAgo(c.created_at)} ·{' '}
                <button
                  type="button"
                  className="min-h-11 font-semibold text-user-accent"
                  onClick={() => {
                    setReplyTo(c)
                    document.getElementById('comment-box')?.focus()
                  }}
                >
                  Reply<span className="sr-only"> to {c.author_name}</span>
                </button>
              </p>
            </div>
            {repliesOf(c.id).map((r) => (
              <div key={r.id}>
                <CommentBubble name={r.author_name} body={r.body} organizer={r.is_organizer === true} indent />
              </div>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Details({ p }: { p: ProgramDetail }) {
  const firstSlot = p.needs.find((n) => n.slot_start)
  return (
    <section className={card}>
      <h2 className="text-lg font-bold">Details</h2>
      <ul className="mt-3 flex flex-col gap-2.5">
        <li className="flex gap-2.5">
          <Clock3 className="mt-1 size-5 shrink-0 text-user-accent" aria-hidden />
          <span>
            {formatDate(p.event_date)}
            {firstSlot ? `, ${slotText(firstSlot.slot_start, firstSlot.slot_end)?.split(' ').slice(1).join(' ')}` : ''}
          </span>
        </li>
        <li className="flex gap-2.5">
          <MapPin className="mt-1 size-5 shrink-0 text-user-accent" aria-hidden />
          {p.venue}
        </li>
        <li className="flex gap-2.5">
          <Users className="mt-1 size-5 shrink-0 text-user-accent" aria-hidden />
          {p.audience} seats, {p.seats_left} available
        </li>
      </ul>
    </section>
  )
}

function People({ p }: { p: ProgramDetail }) {
  return (
    <section id="people" className={`${card} scroll-mt-36`}>
      <h2 className="text-lg font-bold">People</h2>
      <p className="mt-2">
        <strong>{p.participants}</strong> of {p.audience} participants
      </p>
      <p>
        <strong>{p.contributors}</strong> contributors helping
      </p>
      <p className="mt-2 text-sm text-ink-soft">Names are only shown to the organizer.</p>
    </section>
  )
}

type Way = 'participant' | 'contributor'

/**
 * Take part: choose Participant or Contributor. The button follows the choice:
 * "Join as participant" (no need to pick) or "Apply as contributor" (pick what you
 * can help with). A participant can switch to contributing, which frees their seat.
 */
function Contribute({ p }: { p: ProgramDetail }) {
  const today = useDhakaToday()
  const canApply = acceptsApplications(p, today)
  const switching = p.my_membership?.role === 'participant'
  const options = p.needs.filter((n) => n.state === 'open' && ['skill', 'time', 'equipment', 'space'].includes(n.type))
  const seatFree = p.seats_left > 0
  const [way, setWay] = useState<Way>(switching || !seatFree ? 'contributor' : 'participant')
  const [needId, setNeedId] = useState('')
  const selected = options.find((n) => n.id === needId) ?? options.find((n) => !scheduleIssue(n.slot_start, n.slot_end)) ?? options[0]
  const scheduleProblem = selected ? scheduleIssue(selected.slot_start, selected.slot_end) : null

  const joinAsParticipant = useUserAction(
    () => userApi.join(p.id, { role: 'participant' }),
    () => refreshAfter.join(p.id),
    undefined,
    (qc) => joinAtOnce(qc, p.id),
  )
  const applyAsContributor = useUserAction(
    () =>
      userApi.join(p.id, {
        role: 'contributor',
        contribution_role: 'contributor',
        need_id: selected!.id,
        switch_from_participant: switching,
      }),
    () => refreshAfter.join(p.id),
  )
  const action = way === 'participant' ? joinAsParticipant : applyAsContributor
  const blocked = way === 'participant' ? switching || !seatFree : !selected || !!scheduleProblem
  const label =
    way === 'participant'
      ? switching
        ? 'You are already attending'
        : seatFree
          ? 'Join as participant'
          : 'Program is full'
      : scheduleProblem
        ? scheduleProblem === 'ended' ? 'Contribution time has ended' : 'Waiting for organizer schedule'
      : switching
        ? 'Switch to contributing and release my seat'
        : 'Apply as contributor'

  return (
    <section id="contribute" className={`${card} scroll-mt-36`}>
      <h2 className="text-lg font-bold">Take part in this program</h2>
      {!canApply ? (
        <p className="mt-2 text-ink-soft">{programEnded(p, today) ? 'This program has ended.' : 'This program is not accepting applications.'}</p>
      ) : p.my_membership?.role === 'contributor' ? (
        <div className="mt-3 flex flex-col gap-2">
          {membershipStatus(p.my_membership)}
          <p className="text-ink-soft">You can change or withdraw your offer on My contributions.</p>
        </div>
      ) : (
        <form
          className="mt-3 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!blocked) action.mutate(undefined)
          }}
        >
          <label className="font-semibold">
            Take part as
            <select
              value={way}
              onChange={(e) => {
                setWay(e.target.value as Way)
                joinAsParticipant.reset()
                applyAsContributor.reset()
              }}
              className="mt-1.5 block min-h-12 w-full rounded-xl border border-black/15 bg-white px-3 font-normal"
            >
              <option value="participant" disabled={switching || !seatFree}>
                Participant{switching ? ' (you are attending)' : seatFree ? '' : ' (full)'}
              </option>
              <option value="contributor" disabled={options.length === 0}>
                Contributor{options.length === 0 ? ' (nothing needed right now)' : ''}
              </option>
            </select>
          </label>

          {way === 'participant' ? (
            <p className="text-ink-soft">
              Come along and take part. {p.seats_left} of {p.audience} seats left.
            </p>
          ) : (
            <>
              {switching && (
                <Notice tone="info">
                  Switching releases your participant seat. You will be waiting for organizer approval as a contributor. If the
                  application cannot be sent, you keep your seat.
                </Notice>
              )}
              <p className="inline-flex items-center gap-1.5 font-semibold text-warning">
                <Clock3 className="size-4" aria-hidden /> {options.map((o) => o.title).join(', ')}: still needed
              </p>
              <label className="font-semibold">
                What you can help with
                <select
                  value={selected?.id ?? ''}
                  onChange={(e) => { setNeedId(e.target.value); applyAsContributor.reset() }}
                  className="mt-1.5 block min-h-12 w-full rounded-xl border border-black/15 bg-white px-3 font-normal"
                >
                  {options.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.title}
                      {scheduleIssue(n.slot_start, n.slot_end) ? ' — schedule unavailable' : ''}
                      {slotText(n.slot_start, n.slot_end) ? `, ${slotText(n.slot_start, n.slot_end)}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              {selected && scheduleProblem && <Notice>
                {scheduleProblem === 'ended'
                  ? `The scheduled time for ${selected.title} has ended. The organizer must update it before you can apply.`
                  : `The organizer has not set a valid start and end time for ${selected.title}. Applications are paused until they add a schedule.`}
              </Notice>}
            </>
          )}

          {action.isError && <Notice tone="error">{action.error instanceof Error ? action.error.message : 'Could not send.'}</Notice>}
          <button type="submit" className={`${ubtn.primary} min-h-14 text-lg`} disabled={action.isPending || blocked}>
            {action.isPending ? 'Sending…' : label}
          </button>
          {way === 'contributor' && <p className="text-sm text-ink-soft">The organizer checks every contributor before the program.</p>}
        </form>
      )}
    </section>
  )
}
