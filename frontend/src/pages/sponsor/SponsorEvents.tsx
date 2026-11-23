import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useEvent, useEvents } from '../../api/sponsor'
import type { EventSummary } from '../../api/types'
import { EmptyNote, Modal, Pill, smallBtn, Spinner } from '../../components/app/ui'
import { formatDate, NEED_TYPE_LABEL, needAmount } from '../../lib/format'

const TYPE_LABEL: Record<string, string> = {
  university_event: 'University event',
  ngo_project: 'NGO project',
  elders_youth: 'Elders and youth',
}
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'university_event', label: 'University events' },
  { key: 'ngo_project', label: 'NGO projects' },
  { key: 'elders_youth', label: 'Elders and youth' },
  { key: 'money', label: 'Needs money' },
]

/** Browse events (prototype "Sponsor · Browse events"). View only: sponsors cannot contact organizers first. */
export default function SponsorEvents() {
  const { data: events, isPending } = useEvents()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState<EventSummary | null>(null)

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (events ?? []).filter((e) => {
      if (filter === 'money' && !e.needs_money) return false
      if (filter !== 'all' && filter !== 'money' && e.project_type !== filter) return false
      if (!term) return true
      return [e.name, e.venue, e.organizer_name, ...e.still_needed].some((s) => s.toLowerCase().includes(term))
    })
  }, [events, q, filter])

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-[34px] font-bold">Events</h1>
      <p className="text-ink-soft">See what events need. Organizers send you requests; you reply with an offer.</p>

      <div className="mt-6 flex flex-col gap-4">
        <label className="relative block">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Event, place or need"
            className="min-h-13 w-full rounded-[10px] border border-[#C9C3B6] bg-white pr-3.5 pl-11"
          />
        </label>
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-11 rounded-full px-4 text-[15px] font-bold ${
                filter === f.key ? 'bg-accent text-white' : 'border border-[#C9C3B6] bg-white hover:border-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {isPending && <Spinner />}
        {!isPending && shown.length === 0 && <EmptyNote>No events match. Try another search or filter.</EmptyNote>}
        {shown.map((e) => (
          <article key={e.id} className="rounded-[14px] border border-[#E2DED5] bg-white p-5 sm:p-6">
            <p className="text-[15px] font-bold text-teal">{TYPE_LABEL[e.project_type ?? ''] ?? 'Event'}</p>
            <h2 className="text-2xl font-bold">{e.name}</h2>
            <p className="text-ink-soft">
              {formatDate(e.event_date)} · {e.venue} · {e.audience.toLocaleString('en-US')} expected · by {e.organizer_name}
            </p>
            <p className="mt-2 text-[15px]">
              <strong>{e.participants}</strong> participants · <strong>{e.contributors}</strong> contributors
            </p>
            <p className="mt-3 rounded-[10px] bg-[#FDF3E8] px-4 py-2.5">
              <strong>Still needed:</strong> {e.still_needed.length ? e.still_needed.join(', ') : 'nothing, every need is covered'}
            </p>
            <button type="button" className={`${smallBtn.secondary} mt-4`} onClick={() => setOpen(e)}>
              View details<span className="sr-only"> of {e.name}</span>
            </button>
          </article>
        ))}
      </div>

      <p className="mt-6 text-[15px] text-ink-soft">
        Sponsors cannot contact organizers first. Keep your company profile up to date so the AI suggests you to the right events.
      </p>

      <EventDialog event={open} onClose={() => setOpen(null)} />
    </main>
  )
}

function EventDialog({ event, onClose }: { event: EventSummary | null; onClose: () => void }) {
  const { data } = useEvent(event?.id ?? null)
  return (
    <Modal open={!!event} onClose={onClose} title={event?.name ?? ''}>
      {!data ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-ink-soft">
            {formatDate(data.event_date)} · {data.venue} · by {data.organizer_name}
          </p>
          <p>{data.description}</p>
          <ul className="flex flex-col gap-2">
            {data.needs.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-4 py-3">
                <span>
                  <strong>{n.title}</strong> · {NEED_TYPE_LABEL[n.type]} · {needAmount(n)}
                </span>
                <Pill tone={n.state === 'open' ? 'open' : n.state === 'received' ? 'received' : 'covered'}>
                  {n.state === 'open' ? 'Open' : n.state === 'received' ? 'Received' : 'Covered'}
                </Pill>
              </li>
            ))}
          </ul>
          <p className="text-[15px] text-ink-soft">If the organizer needs you, their request will show up in your inbox.</p>
        </div>
      )}
    </Modal>
  )
}
