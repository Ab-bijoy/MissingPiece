import type { NeedInput, NeedType } from '../api/types'

// Plain-language formatting used across the signed-in screens. Dates show in
// Bangladesh time, money in BDT.
const TZ = 'Asia/Dhaka'

/** "Fri 18 Dec 2026" from "2026-12-18" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Date to be set'
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00+06:00` : iso)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ })
}

function hour(iso: string) {
  const d = new Date(iso)
  const s = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).toLowerCase()
  return s.replace(':00', '')
}

/** "Fri 10 am to 5 pm" */
export function slotText(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  const day = new Date(start).toLocaleDateString('en-GB', { weekday: 'short', timeZone: TZ })
  return `${day} ${hour(start)} to ${hour(end)}`
}

export const bdt = (n: number) => `BDT ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`

/** "BDT 20,000", "200 packs", "1 projector" */
export function qtyText(n: Pick<NeedInput, 'type' | 'quantity' | 'unit'>): string {
  return n.type === 'money' ? bdt(n.quantity) : `${n.quantity.toLocaleString('en-US')} ${n.unit}`
}

/** Quantity plus time slot: "10 people, Fri 9 am to 6 pm" */
export function needAmount(n: NeedInput): string {
  const s = slotText(n.slot_start, n.slot_end)
  return s ? `${qtyText(n)}, ${s}` : qtyText(n)
}

export const NEED_TYPE_LABEL: Record<NeedType, string> = {
  money: 'Money',
  product: 'Product',
  skill: 'Skill',
  time: 'Time',
  equipment: 'Equipment',
  space: 'Space',
}

/** "5 min ago", "Yesterday", "Mon", "12 Nov" */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 60_000
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${Math.round(diff)} min ago`
  if (diff < 60 * 24) return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  if (diff < 60 * 48) return 'Yesterday'
  if (diff < 60 * 24 * 6) return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', timeZone: TZ })
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ })
}

/** Initials for avatars: "CSE Society" → "CS" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
