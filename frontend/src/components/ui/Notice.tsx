import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'info' | 'error' | 'warning' | 'success'

const TONES: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'bg-[#E6F1EE] text-[#0B4F44]', Icon: Info },
  success: { box: 'bg-[#E6F1EE] text-[#0B4F44]', Icon: CircleCheck },
  warning: { box: 'bg-[#FBEBDD] text-warning', Icon: TriangleAlert },
  error: { box: 'bg-[#FBE4E0] text-[#8F2E21]', Icon: CircleAlert },
}

/** A message box that always pairs an icon with words (never colour alone). */
export default function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const t = TONES[tone]
  return (
    <div
      className={`flex gap-2.5 rounded-[10px] px-3.5 py-3 text-[15px] leading-snug ${t.box}`}
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
    >
      <t.Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
