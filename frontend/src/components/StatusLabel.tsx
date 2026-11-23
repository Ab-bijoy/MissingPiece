import { CircleCheck, CircleDashed, PackageCheck, TriangleAlert } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

export type Status = 'open' | 'covered' | 'received' | 'conflict'

const STYLES: Record<Status, { label: string; className: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  open: { label: 'Open', className: 'bg-sand-light text-warning ring-warning/25', Icon: CircleDashed },
  covered: { label: 'Covered', className: 'bg-teal/12 text-deep ring-teal/30', Icon: CircleCheck },
  received: { label: 'Received', className: 'bg-brand text-white ring-brand', Icon: PackageCheck },
  conflict: { label: 'Clash', className: 'bg-coral/15 text-[#9a3326] ring-coral/40', Icon: TriangleAlert },
}

/** Status labels always use a word and an icon, never colour alone (build prompt 9.3). */
export default function StatusLabel({ status, label }: { status: Status; label?: string }) {
  const s = STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold ring-1 ring-inset ${s.className}`}
    >
      <s.Icon className="size-4" aria-hidden />
      {label ?? s.label}
    </span>
  )
}
