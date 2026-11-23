import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Ribbon from '../../../components/Ribbon'
import { useReplayOnTop } from '../../../lib/useReplayOnTop'

const HEADLINE = ['WE', 'ARE', 'THE', 'MISSING', 'PIECE']

export default function Hero() {
  const replay = useReplayOnTop() // redraw the swish on each return to the top
  let letterIndex = 0

  return (
    // Fills the screen below the 4.5rem header, so the next section starts off-screen
    <section className="relative flex min-h-[calc(100svh-4.5rem)] flex-col overflow-hidden bg-paper">
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
        <Link
          to="/#how-it-works"
          className="mx-auto flex w-fit max-w-full items-center gap-2 rounded-full bg-sand-light px-5 py-2.5 text-center text-[15px] text-ink ring-1 ring-sand"
        >
          <span>One offer covers one whole need. No half promises.</span>
          <span className="inline-flex items-center gap-1 font-bold text-brand underline underline-offset-4">
            See how <ArrowRight className="size-4" aria-hidden />
          </span>
        </Link>
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
