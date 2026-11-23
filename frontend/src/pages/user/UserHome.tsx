import { CalendarDays, Heart, HelpingHand, Send, Type } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addComment, refreshAfter, useFeed, useMyContributions, useMyProfile, userApi, useUserAction } from '../../api/user'
import type { FeedItem } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import Notice from '../../components/ui/Notice'
import { formatDate, timeAgo } from '../../lib/format'
import { acceptsApplications, useDhakaToday } from '../../lib/programDates'
import { Avatar, card, Cover, DateBadge, membershipStatus, myStatusPill, ubtn } from './bits'
import { useLargeText } from './UserLayout'

/** Home feed (prototype "General user B · Home feed"), social-feed style. */
export default function UserHome() {
  const { data: feed, isPending, isError, error } = useFeed()
  const { me } = useAuth()

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
      <LeftColumn name={me?.name ?? ''} />
      <main className="flex min-w-0 flex-col gap-5">
        <h1 className="sr-only">Home</h1>
        <AskBox feed={feed ?? []} />
        {isPending && <p className="text-center text-ink-soft">Loading programs…</p>}
        {isError && <Notice tone="error">{error instanceof Error ? error.message : 'Could not load the feed.'}</Notice>}
        {feed?.length === 0 && <p className={card}>No programs right now. Check back soon.</p>}
        {feed?.map((item) => <Post key={item.id} item={item} />)}
      </main>
      <RightColumn feed={feed ?? []} />
    </div>
  )
}

function LeftColumn({ name }: { name: string }) {
  const { data: profile } = useMyProfile()
  const links = [
    { to: '/programs', label: 'Programs near me', Icon: CalendarDays },
    { to: '/my-contributions', label: 'My contributions', Icon: Heart },
  ]
  return (
    <aside aria-label="Shortcuts" className="hidden lg:block">
      <nav className="flex flex-col gap-1">
        <Link to="/profile" className="flex min-h-12 items-center gap-3 rounded-xl px-2 font-semibold hover:bg-white">
          <Avatar name={name} /> {name}
        </Link>
        {links.map(({ to, label, Icon }) => (
          <Link key={to} to={to} className="flex min-h-12 items-center gap-3 rounded-xl px-2 hover:bg-white">
            <span className="flex size-10 items-center justify-center rounded-full bg-[#DCEBE3] text-user-accent">
              <Icon className="size-5" aria-hidden />
            </span>
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 border-t border-black/10 pt-4">
        <p className="text-sm text-ink-soft">Skills on your profile</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile?.skills.length ? (
            profile.skills.map((s) => (
              <span key={s} className="rounded-full bg-white px-3 py-1 text-sm ring-1 ring-black/10">
                {s}
              </span>
            ))
          ) : (
            <Link to="/profile" className="text-sm font-semibold text-user-accent underline">
              Add your skills
            </Link>
          )}
        </div>
      </div>
    </aside>
  )
}

function AskBox({ feed }: { feed: FeedItem[] }) {
  const { me } = useAuth()
  const [text, setText] = useState('')
  const [pid, setPid] = useState('')
  const [sent, setSent] = useState(false)
  const target = pid || feed[0]?.id || ''
  const ask = useUserAction(
    () => userApi.postComment(target, { kind: 'question', body: text.trim(), parent_id: null }),
    () => refreshAfter.comment(target),
    (qc, c) => addComment(qc, target, c),
  )
  if (!feed.length) return null
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    ask.mutate(undefined, {
      onSuccess: () => {
        setText('')
        setSent(true)
      },
    })
  }
  return (
    <form onSubmit={submit} className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center gap-3">
        <Avatar name={me?.name ?? ''} />
        <label className="flex-1">
          <span className="sr-only">Ask a question</span>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setSent(false)
            }}
            placeholder="Ask a question about a program…"
            className="min-h-12 w-full rounded-full bg-user-bg px-4"
          />
        </label>
      </div>
      {text.trim() && (
        <div className="flex flex-wrap items-center gap-2 pl-13">
          <label className="text-sm font-semibold">
            About
            <select value={pid || feed[0]!.id} onChange={(e) => setPid(e.target.value)} className="ml-2 min-h-11 rounded-lg border border-black/15 bg-white px-2 font-normal">
              {feed.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={ubtn.primary} disabled={ask.isPending}>
            <Send className="size-4" aria-hidden /> Ask
          </button>
        </div>
      )}
      {sent && <Notice tone="success">Your question is posted. The organizer will reply on the program page.</Notice>}
      {ask.isError && <Notice tone="error">{ask.error instanceof Error ? ask.error.message : 'Could not post.'}</Notice>}
    </form>
  )
}

function Post({ item }: { item: FeedItem }) {
  const { me } = useAuth()
  const [text, setText] = useState('')
  const join = useUserAction(() => userApi.join(item.id, { role: 'participant' }), () => refreshAfter.join(item.id))
  const comment = useUserAction(
    () => userApi.postComment(item.id, { kind: 'comment', body: text.trim(), parent_id: null }),
    () => refreshAfter.comment(item.id),
    (qc, c) => addComment(qc, item.id, c),
  )
  const preview = item.comments_preview[0]
  const help = item.help_needed

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-start gap-3 px-5 pt-5">
        <Avatar name={item.organizer_name} />
        <div>
          <p>
            <strong>{item.organizer_name}</strong> {help.length ? 'needs help' : 'posted a program'}
          </p>
          <p className="text-sm text-ink-soft">{timeAgo(item.posted_at)}</p>
        </div>
      </div>
      <p className="px-5 pt-3">{item.description}</p>

      <Link to={`/programs/${item.id}`} className="mt-4 block hover:opacity-95">
        <Cover className="h-40" />
        <div className="flex items-center gap-4 bg-[#F6F8F7] px-5 py-4">
          <DateBadge date={item.event_date} />
          <div>
            <p className="text-lg font-bold">{item.name}</p>
            <p className="text-ink-soft">
              {formatDate(item.event_date)} · {item.venue}
            </p>
            <p className="text-sm text-ink-soft">
              {item.participants} joined
              {help.length ? ` · ${help.map((h) => h.title.toLowerCase()).join(', ')} needed` : ''}
            </p>
          </div>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        {item.my_membership ? (
          <>
            {myStatusPill(item.my_membership)}
            <Link to={`/programs/${item.id}`} className="text-sm font-semibold text-user-accent underline">
              Open program
            </Link>
          </>
        ) : (
          <>
            <button type="button" className={ubtn.primary} onClick={() => join.mutate(undefined)} disabled={join.isPending || item.seats_left <= 0}>
              {item.seats_left <= 0 ? 'Program is full' : join.isPending ? 'Joining…' : 'Join as participant'}
            </button>
            {help.length > 0 && (
              <Link to={`/programs/${item.id}#contribute`} className={ubtn.soft}>
                <HelpingHand className="size-5" aria-hidden /> Offer to help
              </Link>
            )}
          </>
        )}
      </div>
      {join.isError && (
        <div className="px-5 pt-3">
          <Notice tone="error">{join.error instanceof Error ? join.error.message : 'Could not join.'}</Notice>
        </div>
      )}

      <div className="mt-4 border-t border-black/5 px-5 py-4">
        {preview && (
          <div className="flex flex-col gap-3">
            <CommentBubble name={preview.author_name} body={preview.body} />
            {preview.reply && <CommentBubble name={preview.reply.author_name} body={preview.reply.body} organizer={preview.reply.is_organizer === true} indent />}
          </div>
        )}
        {item.comment_count > 1 && (
          <Link to={`/programs/${item.id}#discussion`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-user-accent">
            See all {item.comment_count} comments
          </Link>
        )}
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) comment.mutate(undefined, { onSuccess: () => setText('') })
          }}
        >
          <Avatar name={me?.name ?? ''} />
          <label className="flex-1">
            <span className="sr-only">Write a comment on {item.name}</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" className="min-h-11 w-full rounded-full bg-user-bg px-4" />
          </label>
          <button type="submit" className="inline-flex size-11 items-center justify-center rounded-full text-user-accent hover:bg-user-bg disabled:opacity-40" disabled={!text.trim() || comment.isPending} aria-label="Post comment">
            <Send className="size-5" aria-hidden />
          </button>
        </form>
      </div>
    </article>
  )
}

export function CommentBubble({ name, body, organizer, indent }: { name: string; body: string; organizer?: boolean; indent?: boolean }) {
  return (
    <div className={`flex gap-3 ${indent ? 'pl-10' : ''}`}>
      <Avatar name={name} tone={organizer ? 'sand' : 'green'} />
      <div className="rounded-2xl bg-user-bg px-4 py-2.5">
        <p className="text-sm">
          <strong>{name}</strong>
          {organizer && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-brand">Organizer</span>}
        </p>
        <p>{body}</p>
      </div>
    </div>
  )
}

function RightColumn({ feed }: { feed: FeedItem[] }) {
  const today = useDhakaToday()
  const { data: mine } = useMyContributions()
  const { large, setLarge } = useLargeText()
  const upcoming = (mine ?? []).filter((m) => acceptsApplications(m.project, today) && m.status !== 'rejected' && m.offer?.stage !== 'withdrawn').slice(0, 3)
  const help = feed.flatMap((f) => f.help_needed.map((h) => ({ ...h, project: f.name, id: f.id }))).slice(0, 4)

  return (
    <aside className="flex flex-col gap-5 max-lg:order-first">
      <section className={`${card} max-lg:hidden`}>
        <h2 className="text-lg font-bold">Your upcoming programs</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-ink-soft">Nothing yet. Join a program below.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {upcoming.map((m) => (
              <li key={m.membership_id}>
                <Link to={`/programs/${m.project.id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-user-bg">
                  <DateBadge date={m.project.event_date} />
                  <span>
                    <span className="block font-semibold">{m.project.name}</span>
                    <span className="text-sm">{membershipStatus(m, m.offer?.stage)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {help.length > 0 && (
        <section className={`${card} max-lg:hidden`}>
          <h2 className="text-lg font-bold">Help needed near you</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {help.map((h) => (
              <li key={h.need_id}>
                <Link to={`/programs/${h.id}#contribute`} className="block rounded-xl p-2 hover:bg-user-bg">
                  <span className="block font-semibold">{h.title}</span>
                  <span className="text-sm text-ink-soft">
                    {h.text} · {h.project}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={card}>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Type className="size-5" aria-hidden /> Text size
        </h2>
        <div role="group" aria-label="Text size" className="mt-3 grid grid-cols-2 gap-2">
          {[
            { v: false, label: 'Normal' },
            { v: true, label: 'Large' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={large === o.v}
              onClick={() => setLarge(o.v)}
              className={`min-h-12 rounded-xl font-semibold ${large === o.v ? 'bg-user-accent text-white' : 'bg-user-bg hover:bg-[#E3E6E4]'} ${o.v ? 'text-lg' : ''}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  )
}
