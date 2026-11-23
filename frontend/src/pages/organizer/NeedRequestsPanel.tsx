import { MessageSquare, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMatches, useSentRequests, useSponsorSearch } from '../../api/organizer'
import type { Project, SentRequestState } from '../../api/types'
import { EmptyNote, Pill, smallBtn, Spinner } from '../../components/app/ui'
import { formatDate } from '../../lib/format'
import SendRequestDialog, { type RequestTarget } from './SendRequestDialog'
import { SponsorProfileLink } from './SponsorProfileModal'

const STATE: Record<SentRequestState, { label: string; tone: 'open' | 'covered' | 'received' | 'conflict' | 'neutral' }> = {
  waiting: { label: 'Waiting for a reply', tone: 'open' },
  offer_received: { label: 'Offer received', tone: 'covered' },
  accepted: { label: 'Accepted', tone: 'covered' },
  received: { label: 'Received', tone: 'received' },
  declined: { label: 'Declined', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
}

/** Wait until typing pauses before searching. */
function useDebounced(value: string, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * Opens under a need on the dashboard: the requests already sent for it (with a
 * link to each conversation) and a search over every sponsor on the platform.
 */
export default function NeedRequestsPanel({ project, needId, needTitle }: { project: Project; needId: string; needTitle: string }) {
  const { data: requests, isPending } = useSentRequests(project.id)
  const { data: matches } = useMatches(project.id)
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const term = useDebounced(q.trim())
  const results = useSponsorSearch(project.id, term, searching)
  const [asking, setAsking] = useState<RequestTarget | null>(null)

  const forNeed = (requests ?? []).filter((r) => r.need_id === needId)
  const askedForNeed = new Set(forNeed.map((r) => r.sponsor_id))
  const left = matches?.requests_left ?? 5
  const isOpen = project.needs.find((n) => n.id === needId)?.status === 'open'

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-[#F8F6F1] p-4">
      <section aria-label={`Requests sent for ${needTitle}`}>
        <h3 className="font-bold">Requests sent for {needTitle}</h3>
        {isPending ? (
          <Spinner />
        ) : forNeed.length === 0 ? (
          <p className="mt-1 text-[15px] text-ink-soft">No requests yet. Search for a sponsor below.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {forNeed.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3.5 py-3 ring-1 ring-[#E2DED5]">
                <div>
                  <SponsorProfileLink sponsorId={r.sponsor_id} name={r.sponsor_name} />
                  <div className="text-sm text-ink-soft">
                    Sent {formatDate(r.created_at.slice(0, 10))}
                    {r.decide_by ? ` · decide by ${formatDate(r.decide_by)}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone={STATE[r.state].tone}>{STATE[r.state].label}</Pill>
                  {r.thread_id && (
                    <Link to={`/organizer/messages?thread=${r.thread_id}`} className={smallBtn.secondary}>
                      <MessageSquare className="size-4" aria-hidden /> Message<span className="sr-only"> {r.sponsor_name}</span>
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOpen && (
        <section aria-label="Find a sponsor">
          {!searching ? (
            <button type="button" className={smallBtn.primary} onClick={() => setSearching(true)}>
              <Search className="size-4" aria-hidden /> Search sponsors
            </button>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">Find a sponsor</h3>
                <span className="rounded-full bg-[#EFEDE8] px-3 py-1 text-sm font-bold">{left} of 5 requests left</span>
              </div>
              <label className="relative mt-2 block">
                <span className="sr-only">Search sponsors by name, industry, place or interest</span>
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Company, industry, place or interest"
                  className="min-h-12 w-full rounded-[10px] border border-[#C9C3B6] bg-white pr-3 pl-11"
                />
              </label>
              <div className="mt-3" aria-live="polite">
                {results.isPending ? (
                  <Spinner />
                ) : results.isError ? (
                  <p className="font-bold text-warning">Could not search right now. Please try again.</p>
                ) : results.data?.length === 0 ? (
                  <EmptyNote>No active sponsors match “{term}”.</EmptyNote>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {results.data?.map((s) => {
                      const askedHere = askedForNeed.has(s.id)
                      const blocked = !askedHere && !s.requested && left <= 0 // a 6th different sponsor
                      return (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white px-3.5 py-3 ring-1 ring-[#E2DED5]">
                          <div className="min-w-0">
                            <SponsorProfileLink sponsorId={s.id} name={s.name} />
                            <div className="text-sm text-ink-soft">
                              {[s.industry, s.location].filter(Boolean).join(' · ') || 'Sponsor'}
                              {s.interests.length ? ` · interested in ${s.interests.slice(0, 3).join(', ')}` : ''}
                            </div>
                          </div>
                          {askedHere ? (
                            <span className="text-sm font-bold text-ink-soft">Already asked</span>
                          ) : (
                            <button
                              type="button"
                              className={smallBtn.primary}
                              disabled={blocked}
                              title={blocked ? 'You have asked 5 different sponsors for this project' : undefined}
                              onClick={() => setAsking({ sponsor_id: s.id, sponsor_name: s.name })}
                            >
                              Send request<span className="sr-only"> to {s.name}</span>
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      )}
      <SendRequestDialog key={asking?.sponsor_id ?? 'none'} project={project} match={asking} needId={needId} onClose={() => setAsking(null)} />
    </div>
  )
}
