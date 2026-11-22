import { CircleCheck, CircleDashed, LoaderCircle, PackageCheck, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

// Small building blocks for the organizer, sponsor and admin screens
// (prototype: white cards, #E2DED5 borders, 14px radius).

export function Card({ title, aside, children, className = '' }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-[#E2DED5] bg-white p-5 sm:p-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          {title && <h2 className="text-xl font-bold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10" role="status">
      <LoaderCircle className="size-8 animate-spin text-accent" aria-hidden />
      <span className="sr-only">{label}…</span>
    </div>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-[10px] bg-paper px-4 py-4 text-ink-soft">{children}</p>
}

type PillTone = 'open' | 'covered' | 'received' | 'conflict' | 'neutral'
const PILL: Record<PillTone, { cls: string; Icon: typeof CircleCheck | null }> = {
  open: { cls: 'bg-[#FBEBDD] text-warning', Icon: CircleDashed },
  covered: { cls: 'bg-[#E3EEF7] text-[#1F4E79]', Icon: CircleCheck },
  received: { cls: 'bg-[#E6F1EE] text-[#0B4F44]', Icon: PackageCheck },
  conflict: { cls: 'bg-[#FBE4E0] text-[#8F2E21]', Icon: TriangleAlert },
  neutral: { cls: 'bg-[#EFEDE8] text-ink-soft', Icon: null },
}

/** Status label: always a word plus an icon, never colour alone. */
export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  const p = PILL[tone]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold whitespace-nowrap ${p.cls}`}>
      {p.Icon && <p.Icon className="size-4" aria-hidden />}
      {children}
    </span>
  )
}

/** Accessible modal built on <dialog> (focus is trapped by the browser). */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(94vw,560px)] rounded-2xl border border-[#E2DED5] bg-white p-0 text-ink backdrop:bg-ink/50"
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-paper"
              aria-label="Close"
            >
              <X aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}

/** Small action buttons used inside cards and tables */
export const smallBtn = {
  primary:
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-[15px] font-bold text-white hover:bg-[#09443B] disabled:opacity-60',
  secondary:
    'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[#C9C3B6] bg-white px-4 text-[15px] font-bold text-ink hover:border-accent disabled:opacity-60',
}
