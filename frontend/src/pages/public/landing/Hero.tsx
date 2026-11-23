import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReplayOnTop } from '../../../lib/useReplayOnTop'

const HEADLINE = ['WE', 'ARE', 'THE', 'MISSING', 'PIECE']

// One ribbon that loops through the headline. Drawn twice: once behind the
// letters and once in front (shown only in a few windows) so it weaves through.
const RIBBON =
  'M -60 250 C 90 250, 170 110, 290 105 C 420 100, 440 300, 330 322 C 230 342, 225 196, 372 168 C 540 136, 600 338, 770 306 C 915 278, 865 92, 990 88 C 1112 84, 1092 306, 1215 304 C 1318 302, 1360 184, 1500 160 C 1640 136, 1900 150, 2300 150'

function Ribbon({ front = false }: { front?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 420"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 overflow-visible top-1/2 h-[120%] w-full -translate-y-1/2 ${front ? 'z-20' : 'z-0'}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={front ? 'rib-f' : 'rib-b'} x1="0" x2="360" y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#E07365" stopOpacity="0" />
          <stop offset="1" stopColor="#E07365" />
        </linearGradient>
        {front && (
          <>
            {/* Feathered windows, so the ribbon fades in and out over the letters */}
            <linearGradient id="rib-fade">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.3" stopColor="#fff" />
              <stop offset="0.7" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id="rib-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="420">
              <rect x="230" y="0" width="170" height="420" fill="url(#rib-fade)" />
              <rect x="680" y="0" width="160" height="420" fill="url(#rib-fade)" />
              <rect x="1130" y="0" width="170" height="420" fill="url(#rib-fade)" />
            </mask>
          </>
        )}
      </defs>
      <path
        d={RIBBON}
        pathLength={1}
        fill="none"
        stroke={`url(#${front ? 'rib-f' : 'rib-b'})`}
        strokeWidth={46}
        strokeLinecap="round"
        strokeDasharray="1"
        mask={front ? 'url(#rib-mask)' : undefined}
        className="animate-draw"
      />
    </svg>
  )
}

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
        <Ribbon key={`b${replay}`} />
        <h1
          aria-label="We are the missing piece"
          className="relative z-10 px-4 text-center font-display leading-[0.9] font-extrabold tracking-tight text-brand text-[clamp(3.4rem,9.4vw,9.5rem)]"
        >
          {HEADLINE.map((word, w) => (
            <span key={word} aria-hidden className="inline-block whitespace-nowrap">
              {word.split('').map((ch) => {
                const i = letterIndex++
                return (
                  <span
                    key={i}
                    className="inline-block animate-rise"
                    style={{ animationDelay: `${200 + i * 45}ms` }}
                  >
                    {ch}
                  </span>
                )
              })}
              {w < HEADLINE.length - 1 && <span className="inline-block w-[0.25em]" />}
            </span>
          ))}
        </h1>
        <Ribbon key={`f${replay}`} front />
      </div>
    </section>
  )
}
