const STEPS = [
  {
    title: 'List what you need',
    body: 'Write down what your project is missing, like money, items, skills, volunteer time or a place, in amounts like packs or hours.',
  },
  {
    title: 'Ask the right sponsors',
    body: 'We suggest companies that are a good match for your project and tell you why. Then send a request to up to five of them.',
  },
  {
    title: 'Track every offer',
    body: 'Watch each offer go from offered, to accepted, to received. A sponsor always gives the full amount for a need, never just part of it.',
  },
  {
    title: 'Close it out',
    body: 'When everything has arrived, mark the project as done. Sponsors get a short report with the totals. Nobody’s personal details are shared.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-sand-light py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-display text-xl font-bold tracking-widest text-teal uppercase">How it works</p>
          <h2 className="mt-2 font-display text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-extrabold text-brand">
            From "we need" to "it's here" in four steps
          </h2>
        </div>

        <ol className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5">
              <span className="font-display text-7xl leading-none font-extrabold text-coral" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mt-4 text-xl font-bold text-deep">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid items-center gap-10 rounded-3xl bg-deep p-8 text-sand-light sm:p-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h3 className="font-display text-4xl font-extrabold text-white">Money you can follow</h3>
            <p className="mt-4 text-lg leading-relaxed text-sand-light/85">
              Sponsors pay through MissingPiece, and your project gets every taka they offered. We add a small 5% fee on
              top, and the sponsor sees it before paying.
            </p>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 rounded-2xl bg-white/8 p-6 text-lg ring-1 ring-white/10 sm:p-8">
            <dt>Offer to the project</dt>
            <dd className="text-right font-bold text-white tabular-nums">BDT 20,000</dd>
            <dt>MissingPiece fee (5%)</dt>
            <dd className="text-right font-bold text-white tabular-nums">BDT 1,000</dd>
            <dt className="border-t border-white/15 pt-3 font-bold text-sand">Sponsor pays</dt>
            <dd className="border-t border-white/15 pt-3 text-right font-display text-3xl font-extrabold text-sand tabular-nums">
              BDT 21,000
            </dd>
          </dl>
        </div>
      </div>
    </section>
  )
}
