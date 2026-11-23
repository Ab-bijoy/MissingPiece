import { Banknote, Building2, Clock, GraduationCap, Package, Projector } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type Item = { Icon: ComponentType<SVGProps<SVGSVGElement>>; text: string }

// Real kinds of needs, written in the units organizers actually use.
const NEEDS: Item[] = [
  { Icon: Banknote, text: 'Prize fund · BDT 20,000' },
  { Icon: Package, text: 'Snack packs · 300 packs' },
  { Icon: Projector, text: 'Projector · 1 for a day' },
  { Icon: Clock, text: 'Volunteers · 40 hours' },
  { Icon: Building2, text: 'Seminar hall · 1 evening' },
  { Icon: GraduationCap, text: 'Trainer · tailoring basics' },
  { Icon: Package, text: 'Sewing machines · 6' },
  { Icon: Banknote, text: 'Printing · BDT 4,500' },
]

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 gap-4 pr-4" aria-hidden={hidden || undefined}>
      {NEEDS.map(({ Icon, text }) => (
        <li
          key={text}
          className="flex shrink-0 items-center gap-3 rounded-full bg-white px-5 py-3 text-[17px] font-bold whitespace-nowrap text-deep shadow-sm ring-1 ring-black/5"
        >
          <Icon className="size-5 text-coral" aria-hidden />
          {text}
        </li>
      ))}
    </ul>
  )
}

export default function Intro() {
  return (
    <section className="bg-paper pt-4 pb-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="font-display text-[clamp(2.4rem,5vw,4rem)] leading-none font-extrabold text-brand">
          Every project is missing something
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          A club needs a projector. An NGO needs a hall and a trainer. A youth group needs snacks for 300 people.
          MissingPiece puts those needs in front of the companies and neighbours who have them, and tracks every
          promise until it actually arrives.
        </p>
      </div>

      <div className="mt-14 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <p className="sr-only">Examples of needs: {NEEDS.map((n) => n.text).join(', ')}.</p>
        <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
          <Row hidden />
          <Row hidden />
        </div>
      </div>
    </section>
  )
}
