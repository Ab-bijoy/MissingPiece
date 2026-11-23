import { useEffect, useState } from 'react'

/**
 * A number that goes up each time the visitor scrolls back to the very top after
 * having scrolled at least half a screen down. Use it as a `key` to replay an
 * entrance animation (the hero ribbon's swish). Off for people who ask for less motion.
 */
export function useReplayOnTop(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let away = window.scrollY > window.innerHeight / 2
    // Checked on every scroll event (two comparisons, so no throttling needed).
    const onScroll = () => {
      const y = window.scrollY
      if (y > window.innerHeight / 2) away = true
      else if (away && y <= 2) {
        away = false
        setCount((n) => n + 1)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return count
}
