/**
 * Grey placeholder shapes shown while a page loads, in the shape of what is coming,
 * so the page does not jump when the data arrives. Screen readers hear "Loading".
 * (The pulse stops for people who ask for less motion: see index.css.)
 */

const bar = 'rounded-md bg-[#E8E4DC] animate-pulse'

function Lines({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`${bar} h-3.5`} style={{ width: `${[92, 78, 64, 85][i % 4]}%` }} />
      ))}
    </div>
  )
}

/** A feed post or program card: avatar row, picture area, text lines. */
export function SkeletonPost({ withCover = true }: { withCover?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" aria-hidden>
      <div className="flex items-center gap-3">
        <span className={`${bar} size-10 rounded-full`} />
        <div className="flex flex-1 flex-col gap-2">
          <span className={`${bar} h-3.5 w-1/3`} />
          <span className={`${bar} h-3 w-1/5`} />
        </div>
      </div>
      {withCover && <div className={`${bar} mt-4 h-32 rounded-xl`} />}
      <div className="mt-4">
        <Lines count={3} />
      </div>
    </div>
  )
}

/** A short row, like one of My contributions. */
export function SkeletonRow() {
  return (
    <div className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5" aria-hidden>
      <span className={`${bar} size-14 rounded-xl`} />
      <div className="flex-1">
        <Lines count={3} />
      </div>
    </div>
  )
}

/** Several placeholders with one "Loading" announcement for screen readers. */
export function SkeletonList({ count = 3, kind = 'post' }: { count?: number; kind?: 'post' | 'card' | 'row' }) {
  return (
    <div role="status" className="flex flex-col gap-5">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) =>
        kind === 'row' ? <SkeletonRow key={i} /> : <SkeletonPost key={i} withCover={kind === 'post' || i === 0} />,
      )}
    </div>
  )
}
