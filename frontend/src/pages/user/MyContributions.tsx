import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyContributions, userApi, useUserAction } from '../../api/user'
import type { MyContribution } from '../../api/types'
import Notice from '../../components/ui/Notice'
import { slotText } from '../../lib/format'
import { card, DateBadge, membershipStatus, ubtn } from './bits'

const today = () => new Date().toISOString().slice(0, 10)

/** My contributions (prototype "General user B · My contributions"), in plain words. */
export default function MyContributions() {
  const { data, isPending, error } = useMyContributions()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const withdraw = useUserAction((offerId: string) => userApi.withdraw(offerId))

  const isPast = (m: MyContribution) => m.project.status === 'complete' || m.project.event_date < today()
  const list = (data ?? []).filter((m) => (tab === 'past' ? isPast(m) : !isPast(m)))

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold">My contributions</h1>
      <div role="group" aria-label="Show" className="mt-4 grid w-full max-w-xs grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-black/10">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-12 rounded-lg font-semibold capitalize ${tab === t ? 'bg-user-accent text-white' : 'hover:bg-user-bg'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error.message}</Notice>}
      {withdraw.isError && (
        <div className="mt-4">
          <Notice tone="error">{withdraw.error instanceof Error ? withdraw.error.message : 'Could not withdraw.'}</Notice>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {isPending && <p className="text-ink-soft">Loading…</p>}
        {!isPending && !error && list.length === 0 && (
          <p className={card}>
            {tab === 'upcoming' ? (
              <>
                Nothing coming up.{' '}
                <Link to="/programs" className="font-semibold text-user-accent underline">
                  Find a program
                </Link>
              </>
            ) : (
              'No past programs yet.'
            )}
          </p>
        )}
        {list.map((m) => {
          const o = m.offer
          const canWithdraw = o && (o.stage === 'offered' || o.stage === 'accepted') && m.status !== 'rejected' && !isPast(m)
          return (
            <article key={m.membership_id} className={`${card} flex gap-4`}>
              <DateBadge date={m.project.event_date} />
              <div className="min-w-0 flex-1">
                {membershipStatus(m, o?.stage)}
                <h2 className="mt-2 text-xl font-bold">{m.project.name}</h2>
                <p className="text-ink-soft">{describe(m)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/programs/${m.project.id}`} className={ubtn.soft}>
                    Open program
                  </Link>
                  {canWithdraw && (
                    <button
                      type="button"
                      className={ubtn.ghost}
                      disabled={withdraw.isPending}
                      onClick={() => confirm('Are you sure? The organizer will be told.') && withdraw.mutate(o.id)}
                    >
                      {m.status === 'approved' ? 'I can no longer help' : 'Withdraw my offer'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}

function describe(m: MyContribution) {
  const o = m.offer
  if (m.role === 'participant') return `${m.project.organizer_name} · you joined as a participant`
  if (!o) return `${m.project.organizer_name} · you offered to help`
  const what =
    o.contribution_role === 'trainer'
      ? 'You offered to be a trainer'
      : o.need_type === 'equipment'
        ? `You are lending a ${o.need_title.toLowerCase()}`
        : `You offered to help with ${o.need_title.toLowerCase()}`
  const when = slotText(o.slot_start, o.slot_end)
  return [what, when, m.project.venue].filter(Boolean).join(' · ')
}
