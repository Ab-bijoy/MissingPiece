import { CircleCheck, CircleX, Clock3, PackageCheck, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MembershipStatus, MyMembership, OfferStage } from '../../api/types'
import PuzzlePiece from '../../components/PuzzlePiece'

// Small pieces shared by the general user screens.

const TZ = 'Asia/Dhaka'

/** "MAR / 15" date tile from the prototype */
export function DateBadge({ date, size = 'md' }: { date: string; size?: 'md' | 'lg' }) {
  const d = new Date(`${date}T12:00:00+06:00`)
  const month = d.toLocaleDateString('en-GB', { month: 'short', timeZone: TZ }).toUpperCase()
  const day = d.toLocaleDateString('en-GB', { day: 'numeric', timeZone: TZ })
  return (
    <span
      className={`flex shrink-0 flex-col items-center justify-center rounded-xl bg-white leading-none shadow-sm ring-1 ring-black/5 ${
        size === 'lg' ? 'size-20' : 'size-14'
      }`}
      aria-hidden
    >
      <span className={`font-bold text-warning ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>{month}</span>
      <span className={`font-bold ${size === 'lg' ? 'text-3xl' : 'text-xl'}`}>{day}</span>
    </span>
  )
}

/** Cover area: programs have no photo yet, so a calm brand pattern stands in. */
export function Cover({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[#DCEBE3] ${className}`} aria-hidden>
      <PuzzlePiece className="absolute -top-6 -left-6 size-32 rotate-12 fill-white/50" />
      <PuzzlePiece className="absolute right-10 -bottom-10 size-40 -rotate-12 fill-user-accent/15" />
      <PuzzlePiece className="absolute top-4 right-1/3 size-16 rotate-45 fill-sand/70" />
    </div>
  )
}

export function Avatar({ name, tone = 'green' }: { name: string; tone?: 'green' | 'sand' }) {
  const init = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        tone === 'green' ? 'bg-[#DCEBE3] text-user-accent' : 'bg-sand text-brand'
      }`}
      aria-hidden
    >
      {init}
    </span>
  )
}

/** Status in plain words with an icon (never colour alone). */
export function StatusLine({ icon, tone, children }: { icon: ReactNode; tone: 'ok' | 'wait' | 'muted'; children: ReactNode }) {
  const cls = tone === 'ok' ? 'bg-[#E3F1E8] text-user-accent' : tone === 'wait' ? 'bg-[#FBEBDD] text-warning' : 'bg-[#EEF0EF] text-ink-soft'
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${cls}`}>{icon}{children}</span>
}

export function membershipStatus(m: { role: 'participant' | 'contributor'; status: MembershipStatus }, stage?: OfferStage | null) {
  if (stage === 'withdrawn') return <StatusLine tone="muted" icon={<Undo2 className="size-4" aria-hidden />}>You withdrew</StatusLine>
  if (stage === 'received') return <StatusLine tone="ok" icon={<PackageCheck className="size-4" aria-hidden />}>Thank you, received</StatusLine>
  if (m.status === 'rejected') return <StatusLine tone="muted" icon={<CircleX className="size-4" aria-hidden />}>Not needed this time</StatusLine>
  if (m.status === 'pending') return <StatusLine tone="wait" icon={<Clock3 className="size-4" aria-hidden />}>Waiting for the organizer</StatusLine>
  return (
    <StatusLine tone="ok" icon={<CircleCheck className="size-4" aria-hidden />}>
      {m.role === 'participant' ? 'Attending' : 'Approved and booked'}
    </StatusLine>
  )
}

export function myStatusPill(m: MyMembership) {
  return m ? membershipStatus(m) : null
}

/** Big, friendly buttons (56 px tall on phones for main actions) */
export const ubtn = {
  primary:
    'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-user-accent px-5 font-semibold text-white hover:bg-[#0F5A32] max-[600px]:min-h-14 disabled:opacity-60',
  soft: 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E3F1E8] px-5 font-semibold text-user-accent hover:bg-[#D3E9DB] max-[600px]:min-h-14 disabled:opacity-60',
  ghost: 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#EEF0EF] px-5 font-semibold text-ink hover:bg-[#E3E6E4] max-[600px]:min-h-14 disabled:opacity-60',
}

export const card = 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6'
