import { FlaskConical } from 'lucide-react'
import type { ReactNode } from 'react'
import { env } from '../../../lib/env'

/** Shown only in demo mode, so the team can click through without a backend. */
export default function DemoHint({ children }: { children: ReactNode }) {
  if (!env.useMocks) return null
  return (
    <div className="flex gap-2.5 rounded-[10px] border border-dashed border-teal/60 bg-[#F2F8F7] px-3.5 py-3 text-left text-[15px] text-deep">
      <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <strong>Demo mode.</strong> {children}
      </div>
    </div>
  )
}
