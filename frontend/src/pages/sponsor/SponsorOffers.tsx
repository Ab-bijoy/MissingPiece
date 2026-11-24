import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { sponsorApi, usePrefetchSponsor, useSponsorAction, useSponsorOffers } from '../../api/sponsor'
import type { OfferStage, SponsorOfferRow } from '../../api/types'
import { Card, EmptyNote, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { bdt } from '../../lib/format'

const STAGE: Record<OfferStage, { label: string; tone: 'open' | 'covered' | 'received' | 'neutral' }> = {
  offered: { label: 'Offered', tone: 'open' },
  accepted: { label: 'Accepted', tone: 'covered' },
  received: { label: 'Received', tone: 'received' },
  declined: { label: 'Declined', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
}

/** My offers (prototype "Sponsor · My offers"): stage, benefits given and the next step. */
export default function SponsorOffers() {
  const { data: rows, isPending } = useSponsorOffers()
  const [params] = useSearchParams()
  const withdraw = useSponsorAction((id: string) => sponsorApi.withdraw(id))
  const paid = params.get('payment')
  const qc = useQueryClient()

  // Back from the payment page (a full page load for SSLCommerz): the saved offers
  // still say "Pay now", so load them again. Once more a moment later in case the
  // gateway's confirmation reached the server just after the browser came back.
  useEffect(() => {
    if (!paid) return
    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ['sponsor'] })
      void qc.invalidateQueries({ queryKey: ['notifications'] })
    }
    refresh()
    const again = setTimeout(refresh, 3000)
    return () => clearTimeout(again)
  }, [paid, qc])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-[34px] font-bold">My offers</h1>
      <div className="mt-4 flex flex-col gap-3">
        {paid === 'succeeded' && <Notice tone="success">Payment received. Thank you! The project gets the full amount you offered.</Notice>}
        {paid === 'failed' && <Notice tone="warning">The payment did not go through. Your offer is still accepted, so you can try again.</Notice>}
        {withdraw.isError && <Notice tone="error">{withdraw.error instanceof Error ? withdraw.error.message : 'Could not withdraw.'}</Notice>}
      </div>
      <Card className="mt-6">
        {isPending ? (
          <Spinner />
        ) : !rows?.length ? (
          <EmptyNote>
            No offers yet. Open a request in your <Link to="/sponsor" className="font-bold text-accent">inbox</Link> to make one.
          </EmptyNote>
        ) : (
          <div className="relative -mx-2 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[15px]">
              <thead>
                <tr className="text-sm text-ink-soft">
                  <th className="px-2 pb-2 font-bold">Event and need</th>
                  <th className="px-2 pb-2 font-bold">Your offer</th>
                  <th className="px-2 pb-2 font-bold">Stage</th>
                  <th className="px-2 pb-2 font-bold">Benefits given</th>
                  <th className="px-2 pb-2 font-bold">Next step</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[#F0EDE6] align-middle">
                    <td className="px-2 py-3.5">
                      <div className="font-bold">{r.project_name}</div>
                      <div className="text-ink-soft">{r.need_title}</div>
                    </td>
                    <td className="px-2 py-3.5">{r.offer_text}</td>
                    <td className="px-2 py-3.5">
                      <Pill tone={STAGE[r.stage].tone}>{STAGE[r.stage].label}</Pill>
                    </td>
                    <td className="px-2 py-3.5">{benefitsText(r)}</td>
                    <td className="px-2 py-3.5">
                      <NextStep r={r} onWithdraw={() => confirm('Withdraw this offer? The organizer will be told.') && withdraw.mutate(r.id)} busy={withdraw.isPending} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  )
}

function benefitsText(r: SponsorOfferRow) {
  if (!r.benefits_total || ['declined', 'withdrawn', 'expired'].includes(r.stage)) return 'None'
  if (r.stage === 'received' || r.project_status === 'complete') return `${r.benefits_given} of ${r.benefits_total} given`
  return r.benefits_given ? `${r.benefits_given} of ${r.benefits_total} given` : 'After the event'
}

function NextStep({ r, onWithdraw, busy }: { r: SponsorOfferRow; onWithdraw: () => void; busy: boolean }) {
  const ahead = usePrefetchSponsor()
  const ask = r.request_id ? `/sponsor?request=${r.request_id}` : '/sponsor'
  switch (r.stage) {
    case 'accepted':
      if (r.need_type === 'money' && r.amount)
        return (
          <Link {...ahead.quote(r.id)} to={`/sponsor/offers/${r.id}/pay`} className={smallBtn.primary}>
            Pay {bdt(r.amount + Math.round(r.amount * 5) / 100)}
            {r.payment_status === 'failed' && <span className="sr-only"> (last try failed)</span>}
          </Link>
        )
      return <span className="text-ink-soft">Deliver it; the organizer marks it received</span>
    case 'offered':
      return (
        <button type="button" className={smallBtn.secondary} onClick={onWithdraw} disabled={busy}>
          Withdraw<span className="sr-only"> offer for {r.need_title}</span>
        </button>
      )
    case 'received':
      return (
        <Link to={`/sponsor/reports/${r.project_id}`} className="font-bold text-accent underline underline-offset-2">
          View report
        </Link>
      )
    case 'declined':
      return <span className="text-ink-soft">Another offer was chosen</span>
    case 'expired':
      return <span className="text-ink-soft">Event date passed</span>
    default:
      return (
        <Link to={ask} className="font-bold text-accent underline underline-offset-2">
          Open request
        </Link>
      )
  }
}
