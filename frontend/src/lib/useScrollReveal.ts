import { useEffect, useRef } from 'react'

/**
 * Scroll animations for the landing pages. Put the returned ref on <main>: every
 * section after the hero fades and rises in when it scrolls into view, and resets
 * once it is fully off screen, so it plays again next time. The styles are the
 * `.reveal-ready` rules in index.css. Nothing is hidden for people who ask for
 * less motion, or if this script does not run.
 */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root || !('IntersectionObserver' in window)) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const sections = Array.from(root.querySelectorAll<HTMLElement>(':scope > section:not(:first-child)'))
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= 0.12) e.target.setAttribute('data-shown', '')
          else if (!e.isIntersecting) e.target.removeAttribute('data-shown') // fully off screen
        }
      },
      { threshold: [0, 0.12] },
    )
    sections.forEach((s) => observer.observe(s))
    root.classList.add('reveal-ready')
    return () => {
      observer.disconnect()
      root.classList.remove('reveal-ready')
      sections.forEach((s) => s.removeAttribute('data-shown'))
    }
  }, [])

  return ref
}
