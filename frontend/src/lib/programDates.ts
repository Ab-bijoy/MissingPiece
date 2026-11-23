import { useEffect, useState } from 'react'

/** Event dates are calendar dates in Bangladesh, irrespective of the viewer's timezone. */
export function dhakaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function programEnded(p: { status: string; event_date: string }, today = dhakaToday()) {
  return p.status === 'complete' || p.event_date < today
}

export function acceptsApplications(p: { status: string; event_date: string }, today = dhakaToday()) {
  return p.status === 'live' && !programEnded(p, today)
}

/** Re-evaluate at the next Dhaka midnight, and when a sleeping tab becomes visible. */
export function useDhakaToday() {
  const [today, setToday] = useState(dhakaToday)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      const now = new Date()
      const date = dhakaToday(now)
      setToday(date)
      clearTimeout(timer)
      const nextMidnight = new Date(`${date}T00:00:00+06:00`).getTime() + 86_400_000
      timer = setTimeout(update, Math.max(1, nextMidnight - now.getTime()))
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return today
}
