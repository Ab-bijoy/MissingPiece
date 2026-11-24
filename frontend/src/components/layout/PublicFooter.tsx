import { ArrowUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../../assets/brand/logo-wordmark.png'

export type FooterColumn = { title: string; links: { to: string; label: string }[] }

const COLUMNS: FooterColumn[] = [
  {
    title: 'Join',
    links: [
      { to: '/organizer/register', label: 'Register an organization' },
      { to: '/sponsor/register', label: 'Become a sponsor' },
      { to: '/signup', label: 'Join as a person' },
    ],
  },
  {
    title: 'Log in',
    links: [
      { to: '/organizer/login', label: 'Organizer log in' },
      { to: '/sponsor/login', label: 'Sponsor log in' },
      { to: '/login', label: 'Member log in' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { to: '/#how-it-works', label: 'How it works' },
      { to: '/organizers', label: 'For organizers' },
      { to: '/sponsors', label: 'For sponsors' },
      { to: '/community', label: 'For the community' },
    ],
  },
]

const linkCls =
  'inline-flex min-h-11 items-center text-sand-light/80 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:text-white'

function toTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

/**
 * Site footer for the public pages. The brand sits on the left and the link
 * columns share the rest of the width evenly, however many columns a page
 * passes (`columns` replaces the default links; links starting with # stay on
 * the page).
 */
export default function PublicFooter({ columns = COLUMNS }: { columns?: FooterColumn[] }) {
  return (
    <footer className="bg-deep text-sand-light">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 pt-16 pb-12 sm:px-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-16 lg:px-8">
        <div className="flex flex-col items-start gap-5">
          <img src={logo} alt="MissingPiece" className="h-9 w-auto" />
          <p className="max-w-sm text-lg leading-relaxed text-sand-light/85">
            The part your project is missing, found by the people and companies around you.
          </p>
          <p className="inline-flex items-center gap-2 rounded-full border border-sand/25 px-3.5 py-1.5 text-sm text-sand-light/80">
            <span className="size-2 rounded-full bg-coral" aria-hidden />
            For clubs, NGOs and community groups in Bangladesh
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
          {columns.map((col) => (
            <div key={col.title} className="min-w-0">
              <h2 className="font-display text-lg font-bold tracking-[0.12em] text-sand uppercase">{col.title}</h2>
              <span className="mt-2 block h-0.5 w-8 rounded-full bg-coral" aria-hidden />
              <ul className="mt-3">
                {col.links.map((l) => (
                  <li key={l.to}>
                    {l.to.startsWith('#') ? (
                      <a href={l.to} className={linkCls}>
                        {l.label}
                      </a>
                    ) : (
                      <Link to={l.to} className={linkCls}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:px-8">
          <p className="text-sm text-sand-light/70">© 2026 MissingPiece. Made in Bangladesh.</p>
          <button
            type="button"
            onClick={toTop}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-sand-light/85 hover:bg-white/10 hover:text-white"
          >
            <ArrowUp className="size-4" aria-hidden /> Back to top
          </button>
        </div>
      </div>
    </footer>
  )
}
