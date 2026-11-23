import { CalendarDays, ChevronDown, Heart, House, LogOut, Search, UserRound } from 'lucide-react'
import { createContext, useContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import logo from '../../assets/brand/logo-wordmark.png'
import { useAuth } from '../../auth/AuthProvider'
import NotificationBell from '../../components/app/NotificationBell'
import { initials } from '../../lib/format'

// ---- Large text (build prompt 9.3) ----------------------------------------
// A per-person reading preference, so it lives in this browser only.
const KEY = 'mp-large-text'
const LargeText = createContext<{ large: boolean; setLarge: (v: boolean) => void }>({ large: false, setLarge: () => {} })
export const useLargeText = () => useContext(LargeText)

function readLarge() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const TABS = [
  { to: '/home', label: 'Home', short: 'Home', Icon: House },
  { to: '/programs', label: 'Programs', short: 'Programs', Icon: CalendarDays },
  { to: '/my-contributions', label: 'My contributions', short: 'My help', Icon: Heart },
]

/**
 * Frame for the general user area (prototype "General user B"): Inter, a calm
 * grey-green background, larger body text (17 px desktop, 18 px phone), and a
 * Large text setting that scales everything up.
 */
export default function UserLayout() {
  const [large, setLargeState] = useState(readLarge)
  const setLarge = (v: boolean) => {
    setLargeState(v)
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  // Every size in this area is in rem, so changing the root size scales it all.
  useEffect(() => {
    document.documentElement.style.fontSize = large ? '19px' : ''
    return () => {
      document.documentElement.style.fontSize = ''
    }
  }, [large])

  return (
    <LargeText.Provider value={{ large, setLarge }}>
      <div className="min-h-svh bg-user-bg font-user text-[1.0625rem] leading-relaxed text-ink max-[600px]:text-[1.125rem]">
        <UserHeader />
        <Outlet />
      </div>
    </LargeText.Provider>
  )
}

function UserHeader() {
  const { me, signOut } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const search = (e: FormEvent) => {
    e.preventDefault()
    navigate(`/programs${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
  }

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      <div className="bg-brand">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/home" aria-label="MissingPiece home" className="shrink-0">
            <img src={logo} alt="MissingPiece" className="h-6 w-auto sm:h-7" />
          </Link>
          <form onSubmit={search} role="search" className="ml-2 hidden max-w-sm flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">Search programs</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search programs"
                className="min-h-11 w-full rounded-full bg-white pr-4 pl-10 text-base"
              />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-expanded={menu}
                className="flex min-h-11 items-center gap-1.5 rounded-full p-1 text-sand-light hover:bg-white/10"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-sand font-bold text-brand" aria-hidden>
                  {initials(me?.name ?? '')}
                </span>
                <ChevronDown className="size-4" aria-hidden />
                <span className="sr-only">Account menu for {me?.name}</span>
              </button>
              {menu && (
                <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-[#E2DED5] bg-white py-1 text-ink shadow-xl">
                  <p className="border-b border-[#E6EAE7] px-4 py-3">
                    <span className="block font-bold">{me?.name}</span>
                    <span className="text-sm text-ink-soft">{me?.email}</span>
                  </p>
                  <Link to="/profile" onClick={() => setMenu(false)} className="flex min-h-12 items-center gap-2 px-4 font-bold hover:bg-user-bg">
                    <UserRound className="size-5" aria-hidden /> My profile
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      await signOut()
                      navigate('/login', { replace: true })
                    }}
                    className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-bold hover:bg-user-bg"
                  >
                    <LogOut className="size-5" aria-hidden /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <nav aria-label="Main" className="border-b border-[#E6EAE7] bg-white">
        <ul className="mx-auto grid max-w-xl grid-cols-3">
          {TABS.map(({ to, label, short, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 border-b-[3px] px-2 text-sm font-semibold ${
                    isActive ? 'border-user-accent text-user-accent' : 'border-transparent text-ink-soft hover:text-ink'
                  }`
                }
              >
                <Icon className="size-5" aria-hidden />
                {/* The phone prototype calls the third tab "My help" */}
                <span className="whitespace-nowrap max-[600px]:hidden">{label}</span>
                <span className="whitespace-nowrap min-[601px]:hidden">{short}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
