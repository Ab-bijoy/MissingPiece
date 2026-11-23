import { Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useFeed, usePrefetchProgram } from '../../api/user'
import { formatDate } from '../../lib/format'
import { SkeletonList } from '../../components/ui/Skeleton'
import { card, Cover, DateBadge, myStatusPill } from './bits'

/** Programs near me: every live program as a card, with search. */
export default function ProgramsList() {
  const { data: feed, isPending } = useFeed()
  const ahead = usePrefetchProgram()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const term = q.trim().toLowerCase()
  const shown = (feed ?? []).filter(
    (f) => !term || [f.name, f.venue, f.organizer_name, f.description, ...f.help_needed.map((h) => h.title)].some((s) => s.toLowerCase().includes(term)),
  )

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold">Programs</h1>
      <label className="relative mt-4 block">
        <span className="sr-only">Search programs</span>
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          placeholder="Search by name, place or what is needed"
          className="min-h-14 w-full rounded-2xl bg-white pr-4 pl-12 shadow-sm ring-1 ring-black/10"
        />
      </label>
      {isPending && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <SkeletonList count={2} kind="card" />
          <SkeletonList count={2} kind="card" />
        </div>
      )}
      {!isPending && shown.length === 0 && <p className={`${card} mt-6`}>No programs match “{q}”.</p>}
      <ul className="mt-6 grid gap-5 sm:grid-cols-2">
        {shown.map((f) => (
          <li key={f.id}>
            <Link {...ahead(f.id)} to={`/programs/${f.id}`} className="block overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 hover:ring-user-accent">
              <Cover className="h-28" />
              <div className="flex gap-4 p-5">
                <DateBadge date={f.event_date} />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">{f.name}</h2>
                  <p className="text-ink-soft">
                    {formatDate(f.event_date)} · {f.venue}
                  </p>
                  <p className="text-sm text-ink-soft">by {f.organizer_name}</p>
                  <p className="mt-2 text-sm">
                    {f.participants} joined · {f.seats_left} seats left
                    {f.help_needed.length ? ` · help needed: ${f.help_needed.map((h) => h.title.toLowerCase()).join(', ')}` : ''}
                  </p>
                  {f.my_membership && <div className="mt-2">{myStatusPill(f.my_membership)}</div>}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
