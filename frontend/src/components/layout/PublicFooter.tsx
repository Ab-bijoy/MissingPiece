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

/** `columns` replaces the default links; links starting with # stay on the page. */
export default function PublicFooter({ columns = COLUMNS }: { columns?: FooterColumn[] }) {
  return (
    <footer className="bg-deep text-sand-light">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <img src={logo} alt="MissingPiece" className="h-8 w-auto" />
          <p className="mt-5 max-w-xs text-sand-light/80">
            The part your project is missing, found by the people and companies around you.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="font-display text-xl font-bold tracking-wide text-sand uppercase">{col.title}</h2>
            <ul className="mt-4 space-y-1">
              {col.links.map((l) => (
                <li key={l.to}>
                  {l.to.startsWith('#') ? (
                    <a href={l.to} className="inline-flex min-h-11 items-center text-sand-light/85 hover:text-white">
                      {l.label}
                    </a>
                  ) : (
                    <Link to={l.to} className="inline-flex min-h-11 items-center text-sand-light/85 hover:text-white">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-6 text-sm text-sand-light/70 sm:px-6 lg:px-8">
          © 2026 MissingPiece. Made in Bangladesh.
        </p>
      </div>
    </footer>
  )
}
