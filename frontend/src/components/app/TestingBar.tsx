import { FlaskConical } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { env } from '../../lib/env'

const AREAS = [
  { to: '/', label: 'Landing', end: true },
  { to: '/organizer', label: 'Organizer' },
  { to: '/sponsor', label: 'Sponsor' },
  { to: '/home', label: 'Member' },
  { to: '/admin/approvals', label: 'Admin' },
]

/** Shown only while log-in is switched off (VITE_SKIP_AUTH=true). */
export default function TestingBar() {
  if (!env.skipAuth) return null
  return (
    <nav
      aria-label="Testing: switch area"
      className="fixed bottom-3 left-3 z-[60] flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-1 rounded-2xl bg-ink/90 p-1.5 text-sm text-white shadow-xl backdrop-blur"
    >
      <span className="flex items-center gap-1.5 px-2 font-bold text-sand">
        <FlaskConical className="size-4" aria-hidden /> Log-in off
      </span>
      {AREAS.map((a) => (
        <NavLink
          key={a.to}
          to={a.to}
          end={a.end}
          className={({ isActive }) =>
            `inline-flex min-h-9 items-center rounded-xl px-3 font-bold ${isActive ? 'bg-white text-ink' : 'hover:bg-white/15'}`
          }
        >
          {a.label}
        </NavLink>
      ))}
    </nav>
  )
}
