import { ArrowUpRight, CircleCheck, Clock3, Sparkles, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import StatusLabel, { type Status } from '../../../components/StatusLabel'

const NEEDS: { title: string; amount: string; status: Status }[] = [
  { title: 'Snack packs', amount: '300 packs', status: 'covered' },
  { title: 'Prize fund', amount: 'BDT 20,000', status: 'open' },
  { title: 'Projector', amount: '1, full day', status: 'received' },
  { title: 'Volunteers', amount: '40 hours', status: 'open' },
  { title: 'Seminar hall', amount: '1 evening', status: 'covered' },
]

const CHECKS = [
  { label: 'Plan works', done: true },
  { label: 'Commitments covered', done: false },
  { label: 'Items received', done: false },
  { label: 'Activity confirmed', done: false },
]

function DashboardMock() {
  return (
    <div className="relative mx-auto w-full max-w-xl sm:pt-20 sm:pb-24" aria-hidden>
      {/* Main card */}
      <div className="rounded-2xl bg-paper p-5 text-ink shadow-2xl ring-1 ring-black/10 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-ink-soft">CSE Society · 14 Dec 2026</p>
            <p className="font-display text-3xl font-extrabold text-brand">CSE Fest 2026</p>
          </div>
          <span className="rounded-full bg-brand px-3 py-1 text-sm font-bold text-white">Live</span>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-2">
          {CHECKS.map((c) => (
            <li
              key={c.label}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold ring-1 ring-black/5"
            >
              {c.done ? (
                <CircleCheck className="size-4 shrink-0 text-brand" />
              ) : (
                <Clock3 className="size-4 shrink-0 text-warning" />
              )}
              {c.label}
            </li>
          ))}
        </ul>

        <table className="mt-5 w-full text-left text-[15px]">
          <thead>
            <tr className="text-sm text-ink-soft">
              <th className="pb-2 font-bold">Need</th>
              <th className="pb-2 font-bold">Amount</th>
              <th className="pb-2 text-right font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {NEEDS.map((n) => (
              <tr key={n.title} className="border-t border-black/5">
                <td className="py-2.5 font-bold">{n.title}</td>
                <td className="py-2.5 text-ink-soft">{n.amount}</td>
                <td className="py-2.5 text-right">
                  <StatusLabel status={n.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 rounded-lg bg-sand-light px-4 py-3 text-[15px]">
          <strong>Still needed:</strong> BDT 20,000 for prizes and 40 volunteer hours.
        </p>
      </div>

      {/* Floating: conflict */}
      <div className="absolute top-0 -left-4 hidden w-72 animate-float rounded-xl bg-white p-4 text-ink shadow-xl ring-1 ring-black/10 sm:block lg:-left-12">
        <div className="flex items-center gap-2 text-sm font-bold text-[#9a3326]">
          <TriangleAlert className="size-4" /> 2 food offers clash
        </div>
        <p className="mt-1 text-sm text-ink-soft">Both want to be the only food sponsor. Accepting one declines the other.</p>
      </div>

      {/* Floating: AI suggestion */}
      <div
        className="absolute -right-4 bottom-0 hidden w-64 animate-float rounded-xl bg-deep p-4 text-sand-light shadow-xl ring-1 ring-white/10 sm:block lg:-right-12"
        style={{ animationDelay: '1.5s' }}
      >
        <div className="flex items-center gap-2 text-sm font-bold text-sand">
          <Sparkles className="size-4" /> Suggested sponsor
        </div>
        <p className="mt-1 text-[15px] font-bold text-white">Example Software Co.</p>
        <p className="text-sm text-sand-light/80">Gives money and equipment · Dhaka</p>
        <p className="mt-2 text-sm text-sand">3 of 5 requests left</p>
      </div>
    </div>
  )
}

export default function Showcase() {
  return (
    <section className="relative overflow-hidden bg-brand text-sand-light">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_75%_45%,rgba(80,139,139,0.55),transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-7xl items-center gap-20 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-32">
        <div>
          <p className="font-display text-xl font-bold tracking-widest text-sand uppercase">For organizers</p>
          <h2 className="mt-3 font-display text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-extrabold text-white">
            See what's still missing, at a glance
          </h2>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-sand-light/85">
            List your needs once. MissingPiece shows what is open, what a sponsor has covered and what has actually
            arrived, and warns you when two offers clash.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              to="/organizers"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-coral px-6 font-bold text-ink hover:bg-sand"
            >
              <ArrowUpRight className="size-5" aria-hidden /> Explore for organizers
            </Link>
            <Link
              to="/organizer/register"
              className="inline-flex min-h-12 items-center rounded-full px-6 font-bold text-white ring-2 ring-sand/60 ring-inset hover:bg-white/10"
            >
              Register your organization
            </Link>
          </div>
        </div>
        <DashboardMock />
      </div>
    </section>
  )
}
