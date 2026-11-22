import { CircleCheck, Clock3, Download, PartyPopper } from 'lucide-react'
import { Link } from 'react-router-dom'
import { organizerApi, useOffers, useProject, useProjectAction, useReadiness, useReport } from '../../api/organizer'
import type { Need, Offer } from '../../api/types'
import { Card, EmptyNote, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { bdt, qtyText, slotText } from '../../lib/format'
import { csvCell } from '../../lib/safe'
import { useTrackProject } from './OrganizerLayout'

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

/**
 * Receive and complete (prototype "Organizer · Receive and complete", rules
 * 9 and 11): mark items received, tick off sponsor benefits, complete the
 * project once every accepted offer has arrived, preview the totals report.
 */
export default function ReceiveComplete() {
  const id = useTrackProject()
  const { data: project } = useProject(id)
  const { data: offers } = useOffers(id)
  const { data: readiness } = useReadiness(id)
  const { data: report } = useReport(id)

  const receive = useProjectAction(id, (offerId: string) => organizerApi.receiveOffer(offerId))
  const benefit = useProjectAction(id, ({ bid, given }: { bid: string; given: boolean }) => organizerApi.setBenefit(bid, given))
  const complete = useProjectAction(id, () => organizerApi.complete(id))

  if (!project || !offers) return <Spinner />

  const deliveries = offers.offers.filter((o) => o.stage === 'accepted' || o.stage === 'received')
  const benefits = deliveries.flatMap((o) => o.benefits.map((b) => ({ ...b, sponsor: o.from_name })))

  function downloadReport() {
    if (!report) return
    const rows = [
      ['Project', project!.name],
      ['People taking part', String(report.people_taking_part)],
      ['Sessions held', String(report.sessions_held)],
      ['Money received (BDT)', String(report.money_received)],
      ['Needs received', `${report.needs_received} of ${report.needs_total}`],
      ['Items received', report.items_received.join('; ')],
    ]
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${project!.name} report.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-[15px]">
        <Link to={`/organizer/projects/${id}`} className="font-bold text-accent underline underline-offset-2">
          {project.name}
        </Link>
      </nav>
      <h1 className="mt-1 text-[34px] font-bold">Receive and complete</h1>

      {project.status === 'complete' && (
        <div className="mt-4">
          <Notice tone="success">
            <strong>This project is complete.</strong> Thank you! The report below is ready to share with sponsors.
          </Notice>
        </div>
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Deliveries">
            <p className="-mt-2 mb-4 text-[15px] text-ink-soft">Mark an item received only when all of it has arrived.</p>
            {receive.isError && (
              <div className="mb-3">
                <Notice tone="error">{errText(receive.error)}</Notice>
              </div>
            )}
            {deliveries.length === 0 ? (
              <EmptyNote>Nothing accepted yet. Accept offers on the dashboard first.</EmptyNote>
            ) : (
              <ul className="flex flex-col gap-3">
                {deliveries.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2DED5] px-4 py-3.5">
                    <div>
                      <div className="font-bold">
                        {o.need_title} · {deliveryAmount(o, project.needs.find((n) => n.id === o.need_id))}
                      </div>
                      <div className="text-sm text-ink-soft">{deliverySub(o)}</div>
                    </div>
                    {deliveryAction(o, () => receive.mutate(o.id), receive.isPending)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Sponsor benefits promised">
            {benefits.length === 0 ? (
              <EmptyNote>No benefits were promised on accepted offers.</EmptyNote>
            ) : (
              <ul className="flex flex-col">
                {benefits.map((b) => (
                  <li key={b.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={b.given}
                        onChange={(e) => benefit.mutate({ bid: b.id, given: e.target.checked })}
                        className="size-5 accent-accent"
                      />
                      <span>
                        {b.label} · {b.sponsor}
                        <span className="sr-only">{b.given ? ' (given)' : ' (not given yet)'}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card title="Readiness">
            <dl className="flex flex-col gap-2">
              {readiness?.checks.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-3">
                  <dt>{c.label}</dt>
                  <dd className={`flex items-center gap-1.5 font-bold ${c.ok ? 'text-accent' : 'text-warning'}`}>
                    {c.ok ? <CircleCheck className="size-4" aria-hidden /> : <Clock3 className="size-4" aria-hidden />}
                    {c.value}
                  </dd>
                </div>
              ))}
            </dl>
            {project.status === 'live' && (
              <>
                <button
                  type="button"
                  className={`${smallBtn.primary} mt-4 min-h-12 w-full`}
                  disabled={!readiness?.can_complete || complete.isPending}
                  onClick={() => complete.mutate(undefined)}
                >
                  <PartyPopper className="size-5" aria-hidden /> {complete.isPending ? 'Completing…' : 'Mark activity complete'}
                </button>
                <p className="mt-2 text-sm text-ink-soft">Available after every accepted item is received.</p>
              </>
            )}
            {complete.isError && (
              <div className="mt-3">
                <Notice tone="error">{errText(complete.error)}</Notice>
              </div>
            )}
          </Card>

          <Card title="Report preview">
            <p className="-mt-3 mb-4 text-sm text-ink-soft">Totals only. No personal details.</p>
            {!report ? (
              <Spinner />
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-3">
                  <Stat label="People taking part" value={String(report.people_taking_part)} />
                  <Stat label="Sessions held" value={String(report.sessions_held)} />
                  <Stat label="Money received" value={bdt(report.money_received)} />
                  <Stat label="Items received" value={report.items_received.join(', ') || 'None yet'} small />
                </dl>
                <button type="button" onClick={downloadReport} className={`${smallBtn.secondary} mt-4 w-full`}>
                  <Download className="size-4" aria-hidden /> Download report
                </button>
              </>
            )}
          </Card>
        </aside>
      </div>
    </main>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-paper px-3.5 py-3">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={`font-bold ${small ? 'text-[15px]' : 'text-xl'}`}>{value}</dd>
    </div>
  )
}

function deliveryAmount(o: Offer, need?: Need) {
  if (o.amount) return bdt(o.amount)
  return need ? qtyText(need) : ''
}

function deliverySub(o: Offer) {
  const parts = [o.from_name]
  if (o.need_type === 'money') parts.push('paid through the platform')
  else if (o.slot_start) parts.push(`booked ${slotText(o.slot_start, o.slot_end)}`)
  else parts.push(o.stage === 'received' ? 'Received' : 'Accepted')
  return parts.join(' · ')
}

function deliveryAction(o: Offer, onReceive: () => void, busy: boolean) {
  if (o.stage === 'received')
    return <Pill tone="received">{o.need_type === 'money' ? 'Received automatically' : 'Received'}</Pill>
  if (o.need_type === 'money')
    return <Pill tone="open">{o.payment_status === 'failed' ? 'Payment failed · sponsor can retry' : 'Waiting for payment'}</Pill>
  return (
    <button type="button" className={smallBtn.primary} onClick={onReceive} disabled={busy}>
      Mark received<span className="sr-only">: {o.need_title}</span>
    </button>
  )
}
