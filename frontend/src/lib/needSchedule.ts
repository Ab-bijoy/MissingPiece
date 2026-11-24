export const CONTRIBUTOR_TYPES = ['skill', 'time', 'equipment', 'space']

export function scheduleIssue(start?: string | null, end?: string | null, now = Date.now()): 'missing' | 'invalid' | 'ended' | null {
  if (!start || !end) return 'missing'
  const a = Date.parse(start), b = Date.parse(end)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 'invalid'
  return b <= now ? 'ended' : null
}

/** datetime-local uses Bangladesh wall time, regardless of the browser timezone. */
export function toDhakaInput(iso?: string | null): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (key: string) => parts.find((p) => p.type === key)!.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export const fromDhakaInput = (value: string) => value ? `${value}:00+06:00` : null
