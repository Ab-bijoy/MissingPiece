import { Building2, HandHeart, Users } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'

type Card = {
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  title: string
  body: string
  cta: string
  to: string
  login: string
  note?: string
}

const CARDS: Card[] = [
  {
    Icon: Building2,
    title: 'Run a project',
    body: 'Register your club, NGO or community group and start listing what you need.',
    cta: 'Register your organization',
    to: '/organizer/register',
    login: '/organizer/login',
    note: 'An admin checks every new organization before it goes live.',
  },
  {
    Icon: HandHeart,
    title: 'Sponsor a project',
    body: 'Set up your company profile and get requests that match what you like to give.',
    cta: 'Become a sponsor',
    to: '/sponsor/register',
    login: '/sponsor/login',
    note: 'An admin checks your trade licence before you can send offers.',
  },
  {
    Icon: Users,
    title: 'Join an event',
    body: 'Make a free account to join programs near you or offer your skills and time.',
    cta: 'Create an account',
    to: '/signup',
    login: '/login',
  },
]

export default function GetStarted() {
  return (
    <section id="get-started" className="scroll-mt-20 bg-paper py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-[clamp(2.6rem,6vw,5rem)] leading-none font-extrabold text-brand uppercase">
          Find your place
        </h2>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {CARDS.map(({ Icon, ...c }) => (
            <article key={c.title} className="flex flex-col rounded-3xl bg-brand p-8 text-sand-light sm:p-10">
              <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-sand text-brand">
                <Icon className="size-7" aria-hidden />
              </span>
              <h3 className="mt-6 font-display text-4xl font-extrabold text-white">{c.title}</h3>
              <p className="mt-3 text-lg leading-relaxed text-sand-light/85">{c.body}</p>
              {c.note && <p className="mt-3 text-[15px] text-sand">{c.note}</p>}
              <div className="mt-auto flex flex-col items-stretch gap-2 pt-8">
                <Link
                  to={c.to}
                  className="inline-flex min-h-14 items-center justify-center rounded-full bg-coral px-6 text-center font-bold text-ink hover:bg-sand"
                >
                  {c.cta}
                </Link>
                <p className="text-center text-[15px] text-sand-light/85">
                  Already have an account?{' '}
                  <Link
                    to={c.login}
                    className="inline-flex min-h-11 items-center font-bold text-sand-light underline underline-offset-4 hover:text-white"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
