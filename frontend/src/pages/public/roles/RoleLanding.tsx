import { ArrowRight, ChevronDown, Quote } from 'lucide-react'
import { useEffect, type ComponentType, type SVGProps } from 'react'
import { Link } from 'react-router-dom'
import PublicFooter, { type FooterColumn } from '../../../components/layout/PublicFooter'
import PublicHeader, { type SectionLink } from '../../../components/layout/PublicHeader'
import PuzzlePiece from '../../../components/PuzzlePiece'
import Ribbon from '../../../components/Ribbon'
import { useReplayOnTop } from '../../../lib/useReplayOnTop'
import { useScrollReveal } from '../../../lib/useScrollReveal'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

/**
 * Colour set for one role page. Every value is a full Tailwind class string
 * (Tailwind only sees classes written out in full).
 */
export type RoleTheme = {
  heroBg: string
  heroTitle: string
  heroText: string
  eyebrow: string
  ribbon: string
  primaryBtn: string
  secondaryBtn: string
  band: string
  bandNumber: string
  iconTile: string
  quoteMark: string
  ctaCard: string
  ctaTitle: string
  ctaText: string
  ctaBtn: string
  ctaLink: string
  piece: string
  /** Extra classes on <main>, e.g. the general user font */
  main?: string
}

export type RoleContent = {
  theme: RoleTheme
  eyebrow: string
  headline: string[]
  intro: string
  primary: { label: string; to: string }
  secondary: { label: string; to: string }
  features: { Icon: Icon; title: string; body: string }[]
  steps: { title: string; body: string }[]
  stepsTitle: string
  reviews: { quote: string; name: string; role: string }[]
  rules: { Icon: Icon; title: string; body: string }[]
  rulesIntro: string
  faqs: { q: string; a: string }[]
  cta: { title: string; body: string }
}

function Hero({ c }: { c: RoleContent }) {
  const t = c.theme
  const replay = useReplayOnTop() // redraw the swish on each return to the top
  let letterIndex = 0
  return (
    <section className={`relative overflow-hidden ${t.heroBg}`}>
      {/* Fills the screen below the 4.5rem header, so the next section starts off-screen */}
      <div className="relative mx-auto flex min-h-[calc(100svh-4.5rem)] max-w-[1440px] flex-col items-center justify-center px-4 py-14">
        <p className={`relative z-30 font-display text-xl font-bold tracking-widest uppercase ${t.eyebrow}`}>
          {c.eyebrow}
        </p>
        <div className="relative w-full py-10">
          <Ribbon key={`b${replay}`} color={t.ribbon} />
          <h1
            aria-label={c.headline.join(' ')}
            className={`relative z-10 text-center font-display leading-[0.9] font-extrabold tracking-tight text-[clamp(3.2rem,8.6vw,8.75rem)] ${t.heroTitle}`}
          >
            {c.headline.map((word, w) => (
              <span key={word + w} aria-hidden className="inline-block whitespace-nowrap">
                {word.split('').map((ch) => {
                  const i = letterIndex++
                  return (
                    <span key={i} className="inline-block animate-rise" style={{ animationDelay: `${150 + i * 40}ms` }}>
                      {ch}
                    </span>
                  )
                })}
                {w < c.headline.length - 1 && <span className="inline-block w-[0.25em]" />}
              </span>
            ))}
          </h1>
          <Ribbon key={`f${replay}`} color={t.ribbon} front />
        </div>
        <p className={`relative z-30 mt-10 max-w-2xl text-center text-lg leading-relaxed sm:text-xl ${t.heroText}`}>
          {c.intro}
        </p>
        <div className="relative z-30 mt-8 flex flex-wrap justify-center gap-3">
          <Link to={c.primary.to} className={`inline-flex min-h-14 items-center gap-2 rounded-full px-7 font-bold ${t.primaryBtn}`}>
            {c.primary.label} <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link
            to={c.secondary.to}
            className={`inline-flex min-h-14 items-center rounded-full px-7 font-bold ring-2 ring-inset ${t.secondaryBtn}`}
          >
            {c.secondary.label}
          </Link>
        </div>
      </div>
    </section>
  )
}

function Features({ c }: { c: RoleContent }) {
  return (
    <section id="what-you-get" className="scroll-mt-20 bg-paper py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-[clamp(2.6rem,6vw,5rem)] leading-none font-extrabold text-brand uppercase">
          What you get
        </h2>
        <ul className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {c.features.map(({ Icon, title, body }) => (
            <li key={title} className="rounded-2xl bg-white p-7 shadow-sm ring-1 ring-black/5">
              <span className={`inline-flex size-14 items-center justify-center rounded-2xl ${c.theme.iconTile}`}>
                <Icon className="size-7" aria-hidden />
              </span>
              <h3 className="mt-5 text-xl font-bold text-deep">{title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Steps({ c }: { c: RoleContent }) {
  return (
    <section id="how-it-works" className={`relative scroll-mt-20 overflow-hidden ${c.theme.band}`}>
      <PuzzlePiece className="pointer-events-none absolute -top-20 -right-16 size-80 rotate-12 fill-white/5" />
      <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
        <p className="font-display text-xl font-bold tracking-widest text-sand uppercase">How it works</p>
        <h2 className="mt-2 max-w-3xl font-display text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-extrabold text-white">
          {c.stepsTitle}
        </h2>
        <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {c.steps.map((s, i) => (
            <li key={s.title} className="border-t-2 border-white/20 pt-6">
              <span className={`font-display text-7xl leading-none font-extrabold ${c.theme.bandNumber}`} aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-4 text-xl font-bold text-white">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-3 leading-relaxed text-sand-light/85">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Reviews({ c }: { c: RoleContent }) {
  return (
    <section id="reviews" className="scroll-mt-20 bg-paper py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-[clamp(2.6rem,6vw,5rem)] leading-none font-extrabold text-brand uppercase">
          What people say
        </h2>
        <ul className="mt-16 grid gap-6 lg:grid-cols-3">
          {c.reviews.map((r) => (
            <li key={r.name} className="flex flex-col rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
              <Quote className={`size-10 ${c.theme.quoteMark}`} aria-hidden />
              <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-ink">“{r.quote}”</blockquote>
              {/* Keep each role short enough for one line, so the names line up across the row */}
              <div className="mt-8 flex items-start gap-4">
                <span
                  className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-sand font-display text-xl font-extrabold text-brand"
                  aria-hidden
                >
                  {r.name.charAt(0)}
                </span>
                <div className="pt-0.5">
                  <p className="font-bold text-deep">{r.name}</p>
                  <p className="text-[15px] text-ink-soft">{r.role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Rules({ c }: { c: RoleContent }) {
  return (
    <section id="rules" className="scroll-mt-20 bg-sand-light py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="font-display text-xl font-bold tracking-widest text-teal uppercase">Onboarding rules</p>
          <h2 className="mt-2 font-display text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-extrabold text-brand">
            Before you start
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">{c.rulesIntro}</p>
        </div>
        <ol className="mt-14 grid gap-5 md:grid-cols-2">
          {c.rules.map(({ Icon, title, body }, i) => (
            <li key={title} className="flex gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-7">
              <span className="flex shrink-0 flex-col items-center gap-2">
                <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand text-sand-light">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="text-sm font-bold text-ink-soft">
                  <span className="sr-only">Rule </span>
                  {i + 1}
                </span>
              </span>
              <div>
                <h3 className="text-xl font-bold text-deep">{title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Faq({ c }: { c: RoleContent }) {
  return (
    <section id="faq" className="scroll-mt-20 bg-paper py-24 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <h2 className="font-display text-[clamp(2.6rem,6vw,5rem)] leading-none font-extrabold text-brand uppercase">
            Questions
          </h2>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-ink-soft">
            The things people ask most before they sign up.
          </p>
        </div>
        <div className="divide-y divide-black/10 border-y border-black/10">
          {c.faqs.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-bold text-deep [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  className="size-6 shrink-0 text-brand transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="pb-6 text-lg leading-relaxed text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Cta({ c }: { c: RoleContent }) {
  const t = c.theme
  return (
    <section className="bg-paper pb-24 lg:pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16 ${t.ctaCard}`}>
          <PuzzlePiece className={`pointer-events-none absolute -bottom-16 -left-10 size-64 -rotate-12 ${t.piece}`} />
          <PuzzlePiece className={`pointer-events-none absolute -top-12 -right-10 size-52 rotate-12 ${t.piece}`} />
          <h2 className={`relative font-display text-[clamp(2.6rem,5vw,4.25rem)] leading-[0.95] font-extrabold ${t.ctaTitle}`}>
            {c.cta.title}
          </h2>
          <p className={`relative mx-auto mt-5 max-w-xl text-lg leading-relaxed ${t.ctaText}`}>{c.cta.body}</p>
          <div className="relative mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <Link to={c.primary.to} className={`inline-flex min-h-14 items-center gap-2 rounded-full px-7 font-bold ${t.ctaBtn}`}>
              {c.primary.label} <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link to={c.secondary.to} className={`inline-flex min-h-11 items-center font-bold underline underline-offset-4 ${t.ctaLink}`}>
              {c.secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// Each role page is self-contained: its navbar and footer link only to its
// own sections and to that role's register and log-in screens.
const SECTIONS: SectionLink[] = [
  { id: 'what-you-get', label: 'What you get' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'rules', label: 'Rules' },
  { id: 'faq', label: 'FAQ' },
]

function footerColumns(c: RoleContent): FooterColumn[] {
  return [
    { title: 'On this page', links: SECTIONS.map((s) => ({ to: `#${s.id}`, label: s.label })) },
    { title: 'Get started', links: [c.primary, c.secondary].map((l) => ({ to: l.to, label: l.label })) },
  ]
}

/** Shared layout for the organizer, sponsor and community landing pages. */
export default function RoleLanding({ content }: { content: RoleContent }) {
  const main = useScrollReveal<HTMLElement>()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [content])

  return (
    <>
      <PublicHeader sections={SECTIONS} logoTo="/" loginTo={content.secondary.to} cta={content.primary} />
      <main ref={main} className={`landing-sections ${content.theme.main}`}>
        <Hero c={content} />
        <Features c={content} />
        <Steps c={content} />
        <Reviews c={content} />
        <Rules c={content} />
        <Faq c={content} />
        <Cta c={content} />
      </main>
      <PublicFooter columns={footerColumns(content)} />
    </>
  )
}
