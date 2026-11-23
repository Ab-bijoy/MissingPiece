import { ChevronLeft, CircleCheck, Clock3, Download } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useSponsorReport } from '../../api/sponsor'
import { Card, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { formatDate } from '../../lib/format'

/**
 * Impact report (prototype "Sponsor · Impact report", rule 12): totals only,
 * never names, emails, ages or phone numbers.
 */
export default function SponsorReportPage() {
  const { projectId } = useParams()
  const { data: r, isPending, isError, error } = useSponsorReport(projectId!)

  if (isPending) return <Spinner />
  if (isError)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Notice tone="info">{error instanceof Error ? error.message : 'This report is not available.'}</Notice>
      </main>
    )

  const p = r.project
  const given = r.benefits.filter((b) => b.given).length

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 print:max-w-none">
      <Link to="/sponsor/offers" className="inline-flex min-h-11 items-center gap-1 font-bold text-accent underline underline-offset-2 print:hidden">
        <ChevronLeft className="size-4" aria-hidden /> My offers
      </Link>

      <section className="mt-2">
        <p className="text-[15px] text-ink-soft">
          Impact report · from {p.organizer_name}
          {p.institution ? `, approved by ${p.institution}` : ''}
        </p>
        <h1 className="text-[34px] leading-tight font-bold">{p.name}</h1>
        <p className="flex flex-wrap items-center gap-2 text-ink-soft">
          {formatDate(p.event_date)} · {p.venue} ·{' '}
          {p.status === 'complete' ? <Pill tone="received">Completed</Pill> : <Pill tone="covered">Still running</Pill>}
        </p>
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          {/* The browser's "Save as PDF" in the print dialog makes the PDF. */}
          <button type="button" onClick={() => window.print()} className={smallBtn.secondary}>
            <Download className="size-4" aria-hidden /> Download PDF
          </button>
          <Link to="/sponsor/events" className={smallBtn.primary}>
            Find more events
          </Link>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-6">
        <Card title="Your contribution">
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="What you gave" value={r.contribution.what} sub={`Need: ${r.contribution.need_title.toLowerCase()}, covered in full`} />
            <Stat
              label="Received by the organizer"
              value={r.contribution.received_at ? formatDate(r.contribution.received_at) : 'Received'}
              sub="Confirmed by the organizer"
            />
            <Stat label="Benefits given" value={`${given} of ${r.benefits.length}`} sub="Confirmed by the organizer" accent />
          </dl>
        </Card>

        <Card title="Event results">
          <p className="-mt-3 mb-4 text-[15px] text-ink-soft">Totals only. No personal details are shared with sponsors.</p>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="People taking part" value={String(r.results.people_taking_part)} outline />
            <Stat label="Contributors" value={String(r.results.contributors)} outline />
            <Stat label="Sessions held" value={String(r.results.sessions_held)} outline />
            <Stat label="Needs covered" value={`${r.results.needs_covered} of ${r.results.needs_total}`} outline />
          </dl>
        </Card>

        <Card title="Benefits you were promised">
          <ul className="flex flex-col gap-2">
            {r.benefits.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {b.given ? <CircleCheck className="size-5 text-accent" aria-hidden /> : <Clock3 className="size-5 text-warning" aria-hidden />}
                  {b.label}
                </span>
                <span className="text-[15px] text-ink-soft">{b.given ? `Given · confirmed ${formatDate(b.given_at)}` : 'Not given yet'}</span>
              </li>
            ))}
          </ul>
        </Card>

        {r.note && (
          <Card title="Note from the organizer">
            <blockquote className="border-l-4 border-sand pl-4 text-lg italic">{r.note}</blockquote>
            <p className="mt-2 text-[15px] text-ink-soft">{p.organizer_name}</p>
          </Card>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value, sub, accent, outline }: { label: string; value: string; sub?: string; accent?: boolean; outline?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${outline ? 'border border-[#E2DED5]' : 'bg-paper'}`}>
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className={`text-2xl font-bold ${accent ? 'text-accent' : ''}`}>{value}</dd>
      {sub && <dd className="text-sm text-ink-soft">{sub}</dd>}
    </div>
  )
}
