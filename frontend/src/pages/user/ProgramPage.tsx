import { Check, Clock3, MapPin, MessageCircleQuestion, Users } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { addComment, refreshAfter, useProgram, useProgramComments, userApi, useUserAction } from '../../api/user'
import type { Comment, ContributionRole, ProgramDetail } from '../../api/types'
import Notice from '../../components/ui/Notice'
import { formatDate, slotText, timeAgo } from '../../lib/format'
import { card, Cover, DateBadge, membershipStatus, ubtn } from './bits'
import { CommentBubble } from './UserHome'

const TZ = 'Asia/Dhaka'

/**
 * Program page (prototype "General user B · Program page"): cover, details,
 * discussion, and a contribute panel where the role dropdown (Trainer or
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

  if (isPending) return <p className="p-10 text-center text-ink-soft">Loading…</p>
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
          <Contribute p={p} />
        </aside>
      </div>
    </main>
  )
}

function Hero({ p }: { p: ProgramDetail }) {
  const join = useUserAction(() => userApi.join(p.id, { role: 'participant' }), () => refreshAfter.join(p.id))
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
          {p.my_membership ? (
            membershipStatus(p.my_membership)
          ) : (
            <button type="button" className={ubtn.primary} onClick={() => join.mutate(undefined)} disabled={join.isPending || p.seats_left <= 0}>
              <Check className="size-5" aria-hidden /> {p.seats_left <= 0 ? 'Program is full' : 'Join as participant'}
            </button>
          )}
          {!p.my_membership && p.needs.some((n) => n.state === 'open' && ['skill', 'time', 'equipment', 'space'].includes(n.type)) && (
            <a href="#contribute" className={ubtn.soft}>
              Offer to help
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
        <li>Trainer: lead a short learning session</li>
        <li>Contributor: help on the day, give your time, or lend something listed above</li>
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
  const top = (comments ?? []).filter((c) => !c.parent_id)
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parent_id === id)

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
            Post
          </button>
        </div>
        {post.isError && <Notice tone="error">{post.error instanceof Error ? post.error.message : 'Could not post.'}</Notice>}
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
                {timeAgo(c.created_at)}
                {c.status === 'hidden' && ' · hidden by the organizer (visible to you, the organizer and admins)'} ·{' '}
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
              <CommentBubble key={r.id} name={r.author_name} body={r.body} organizer={r.is_organizer === true} indent />
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

function Contribute({ p }: { p: ProgramDetail }) {
  const options = p.needs.filter((n) => n.state === 'open' && ['skill', 'time', 'equipment', 'space'].includes(n.type))
  const [role, setRole] = useState<ContributionRole>(options.some((n) => n.type === 'skill') ? 'trainer' : 'contributor')
  const [needId, setNeedId] = useState('')
  const eligible = options.filter((n) => role !== 'trainer' || n.type === 'skill')
  const selected = eligible.find((n) => n.id === needId) ?? eligible[0]
  const join = useUserAction(() =>
    userApi.join(p.id, { role: 'contributor', contribution_role: role, need_id: selected!.id }),
    () => refreshAfter.join(p.id),
  )
  const label = role === 'trainer' ? 'Apply as trainer' : 'Apply as contributor'

  return (
    <section id="contribute" className={`${card} scroll-mt-36`}>
      <h2 className="text-lg font-bold">Contribute to this program</h2>
      {p.my_membership?.role === 'contributor' ? (
        <div className="mt-3 flex flex-col gap-2">
          {membershipStatus(p.my_membership)}
          <p className="text-ink-soft">You can change or withdraw your offer on My contributions.</p>
        </div>
      ) : p.my_membership ? (
        <p className="mt-2 text-ink-soft">You joined as a participant. Thank you!</p>
      ) : options.length === 0 ? (
        <p className="mt-2 text-ink-soft">Everything this program needs is covered right now.</p>
      ) : (
        <form
          className="mt-3 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            join.mutate(undefined)
          }}
        >
          <p className="inline-flex items-center gap-1.5 font-semibold text-warning">
            <Clock3 className="size-4" aria-hidden /> {options.map((o) => o.title).join(', ')}: still needed
          </p>
          <label className="font-semibold">
            Contribution role
            <select value={role} onChange={(e) => setRole(e.target.value as ContributionRole)} className="mt-1.5 block min-h-12 w-full rounded-xl border border-black/15 bg-white px-3 font-normal">
              <option value="trainer" disabled={!options.some((n) => n.type === 'skill')}>Trainer</option>
              <option value="contributor">Contributor</option>
            </select>
          </label>
          <label className="font-semibold">
            What you can help with
            <select value={selected?.id ?? ''} onChange={(e) => setNeedId(e.target.value)} className="mt-1.5 block min-h-12 w-full rounded-xl border border-black/15 bg-white px-3 font-normal">
              {eligible.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                  {slotText(n.slot_start, n.slot_end) ? `, ${slotText(n.slot_start, n.slot_end)}` : ''}
                </option>
              ))}
            </select>
          </label>
          {join.isError && <Notice tone="error">{join.error instanceof Error ? join.error.message : 'Could not send.'}</Notice>}
          <button type="submit" className={`${ubtn.primary} min-h-14 text-lg`} disabled={join.isPending || !selected || p.status !== 'live'}>
            {join.isPending ? 'Sending…' : label}
          </button>
          <p className="text-sm text-ink-soft">The organizer checks every contributor before the program.</p>
        </form>
      )}
    </section>
  )
}
