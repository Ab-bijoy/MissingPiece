import { ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Ribbon from '../../../components/Ribbon'
import { useReplayOnTop } from '../../../lib/useReplayOnTop'

const HEADLINE = ['WE', 'ARE', 'THE', 'MISSING', 'PIECE']
const NOTICE_KEY = 'mp.heroNotice.hidden'

/** Whether this browser hid the hero message before (storage can be blocked, so never throw). */
function noticeHidden() {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1'
  } catch {
    return false
  }
}

export default function Hero() {
  const replay = useReplayOnTop() // redraw the swish on each return to the top
  const [showNotice, setShowNotice] = useState(() => !noticeHidden())
  let letterIndex = 0

  const dismissNotice = () => {
    setShowNotice(false)
    try {
      localStorage.setItem(NOTICE_KEY, '1') // stays hidden on the next visit, in this browser only
    } catch {
      /* private window or blocked storage: hidden for this visit only */
    }
  }

  return (
    // Fills the screen below the 4.5rem header, so the next section starts off-screen
    <section className="relative flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden bg-paper">
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        {showNotice && (
          <div className="mx-auto flex w-fit max-w-full items-center gap-1 rounded-full bg-sand-light py-1 pr-1 pl-5 text-[15px] text-ink ring-1 ring-sand">
            <Link to="/#how-it-works" className="flex items-center gap-2 py-1.5 text-center">
              <span>One offer covers one whole need. No half promises.</span>
              <span className="inline-flex shrink-0 items-center gap-1 font-bold text-brand underline underline-offset-4">
                See how <ArrowRight className="size-4" aria-hidden />
              </span>
            </Link>
            <button
              type="button"
              onClick={dismissNotice}
              aria-label="Hide this message"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-sand hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>

      <div className="relative mx-auto flex w-full max-w-[1440px] flex-1 items-center justify-center py-16">
        <div className="relative w-full py-10">
          <Ribbon key={`b${replay}`} color="#E07365" />
          <h1
            aria-label="We are the missing piece"
            className="relative z-10 px-4 text-center font-display leading-[0.9] font-extrabold tracking-tight text-brand text-[clamp(3.4rem,9.4vw,9.5rem)]"
          >
            {HEADLINE.map((word, w) => (
              <span key={word} aria-hidden className="inline-block whitespace-nowrap">
                {word.split('').map((ch) => {
                  const i = letterIndex++
                  return (
                    <span key={i} className="inline-block animate-rise" style={{ animationDelay: `${200 + i * 45}ms` }}>
                      {ch}
                    </span>
                  )
                })}
                {w < HEADLINE.length - 1 && <span className="inline-block w-[0.25em]" />}
              </span>
            ))}
          </h1>
          <Ribbon key={`f${replay}`} color="#E07365" front />
        </div>
      </div>
    </section>
  )
}
