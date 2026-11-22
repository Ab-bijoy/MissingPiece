import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import PuzzlePiece from '../../../components/PuzzlePiece'

type Audience = {
  n: string
  eyebrow: string
  title: string
  body: string
  points: string[]
  to: string
  cta: string
  card: string
  piece: string
  chips: string[]
}

const AUDIENCES: Audience[] = [
  {
    n: '01',
    eyebrow: 'Clubs, NGOs, community groups',
    title: 'Organizers',
    body: 'Start from a template, list what your project needs in your own units, and ask the right sponsors.',
    points: [
      'Templates for university events, NGO projects and elders-and-youth activities',
      'Sponsor suggestions with a reason for each, up to 5 requests per project',
      'Readiness checks, so you know when you are really ready',
    ],
    to: '/organizers',
    cta: 'For organizers',
    card: 'bg-coral',
    piece: 'fill-sand',
    chips: ['Prize fund · Open', 'Projector · Received', 'Hall · Covered'],
  },
  {
    n: '02',
    eyebrow: 'Companies and brands',
    title: 'Sponsors',
    body: 'Get clear requests instead of vague emails. Offer exactly what a project needs and see it land.',
    points: [
      'An inbox of requests that match what you like to give',
      'Pay money offers safely, with the 5% fee shown up front',
      'An impact report with totals after the event',
    ],
    to: '/sponsors',
    cta: 'For sponsors',
    card: 'bg-teal',
    piece: 'fill-deep',
    chips: ['Request · CSE Society', 'Offer · Snack packs', 'Pay · BDT 21,000'],
  },
  {
    n: '03',
    eyebrow: 'Students, neighbours, elders',
    title: 'Community',
    body: 'Find programs near you. Join one, or offer what you know or own, like a skill, your time or a sewing machine.',
    points: [
      'A simple feed of programs, in large, easy-to-read text',
      'Join as a participant in one tap, or offer to help as a trainer',
      'Ask questions in the open discussion under every program',
    ],
    to: '/community',
    cta: 'For the community',
    card: 'bg-sand',
    piece: 'fill-coral',
    chips: ['Join as participant', 'Offer to help · Trainer', 'Tailoring Repair Workshop'],
  },
]

function Illustration({ a }: { a: Audience }) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-3xl ${a.card}`} aria-hidden>
      <PuzzlePiece className={`absolute -top-10 -right-10 size-64 rotate-12 opacity-90 ${a.piece}`} />
      <PuzzlePiece className="absolute -bottom-16 -left-12 size-56 -rotate-12 fill-white/25" />
      <div className="absolute inset-0 flex flex-col items-start justify-center gap-3 p-8 sm:p-10">
        {a.chips.map((c, i) => (
          <span
            key={c}
            className="animate-float rounded-full bg-white px-5 py-3 text-[17px] font-bold text-deep shadow-lg"
            style={{ marginLeft: `${i * 9}%`, animationDelay: `${i * 0.8}s` }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Audiences() {
  return (
    <section id="who-its-for" className="scroll-mt-20 bg-paper py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-[clamp(2.6rem,6vw,5rem)] leading-none font-extrabold text-brand uppercase">
          Who it's for
        </h2>

        <div className="mt-20 space-y-24 lg:space-y-32">
          {AUDIENCES.map((a, i) => (
            <article key={a.n} className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
              <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                <span className="inline-flex rounded-full bg-sand px-3 py-1 text-sm font-bold text-deep">{a.n}</span>
                <p className="mt-4 font-bold text-teal">{a.eyebrow}</p>
                <h3 className="mt-1 font-display text-5xl font-extrabold text-brand">{a.title}</h3>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">{a.body}</p>
                <ul className="mt-6 space-y-3">
                  {a.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <Check className="mt-1 size-5 shrink-0 text-brand" aria-hidden />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={a.to}
                  className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 font-bold text-sand-light hover:bg-brand-dark"
                >
                  {a.cta} <ArrowRight className="size-5" aria-hidden />
                </Link>
              </div>
              <Illustration a={a} />
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
