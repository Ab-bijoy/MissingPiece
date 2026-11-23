import { useId } from 'react'

// The looping ribbon of every landing hero (main and the three roles), in a colour of choice.
// Render it twice: once behind the headline, once with `front` on top,
// so it weaves through the letters.
// It starts far off-screen on the left (the straight lead-in), so on any screen
// width it runs in unbroken from the left edge, with no gap or fade.
const RIBBON =
  'M -1000 250 L -60 250 C 90 250, 170 110, 290 105 C 420 100, 440 300, 330 322 C 230 342, 225 196, 372 168 C 540 136, 600 338, 770 306 C 915 278, 865 92, 990 88 C 1112 84, 1092 306, 1215 304 C 1318 302, 1360 184, 1500 160 C 1640 136, 1900 150, 2300 150'

export default function Ribbon({ color, front = false }: { color: string; front?: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 1440 420"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-x-0 overflow-visible top-1/2 h-[max(120%,clamp(15rem,30vw,26rem))] w-full -translate-y-1/2 ${front ? 'z-20' : 'z-0'}`}
      aria-hidden
    >
      <defs>
        {front && (
          <>
            <linearGradient id={`f${id}`}>
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.3" stopColor="#fff" />
              <stop offset="0.7" stopColor="#fff" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`m${id}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="420">
              <rect x="230" y="0" width="170" height="420" fill={`url(#f${id})`} />
              <rect x="680" y="0" width="160" height="420" fill={`url(#f${id})`} />
              <rect x="1130" y="0" width="170" height="420" fill={`url(#f${id})`} />
            </mask>
          </>
        )}
      </defs>
      <path
        d={RIBBON}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeOpacity={0.8}
        strokeWidth={46}
        strokeLinecap="round"
        strokeDasharray="1"
        mask={front ? `url(#m${id})` : undefined}
        className="animate-draw"
      />
    </svg>
  )
}
