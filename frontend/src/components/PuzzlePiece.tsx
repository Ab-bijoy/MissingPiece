import type { SVGProps } from 'react'

/** Simple puzzle-piece shape used as a decorative brand motif. */
export default function PuzzlePiece(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden {...props}>
      <path d="M14 30h20a10 10 0 1 1 20 0h20v18a10 10 0 1 1 0 20v18H54a10 10 0 1 0-20 0H14V68a10 10 0 1 0 0-20Z" />
    </svg>
  )
}
