import { ChevronDown, LogOut, Menu, UserRound, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import logo from '../../assets/brand/logo-wordmark.png'
import { useAuth } from '../../auth/AuthProvider'
import { LOGIN_PATH, ROLE_LABEL } from '../../auth/roles'
import { initials } from '../../lib/format'
import NotificationBell from './NotificationBell'

export type AppNavItem = { to: string; label: string; badge?: number; end?: boolean; disabled?: boolean }

/** Header for every signed-in area: logo, area nav, notification bell, account menu. */
/** `profileTo` adds a profile link to the account menu. */
export default function AppHeader({ nav, profileTo }: { nav: AppNavItem[]; profileTo?: string }) {
  const { me, signOut } = useAuth()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [mobile, setMobile] = useState(false)
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

  async function logOut() {
    const role = me?.role ?? 'general'
    await signOut()
    navigate(LOGIN_PATH[role], { replace: true })
  }

  const link = (item: AppNavItem, mobileStyle = false) =>
    item.disabled ? (
      <span
        className={`inline-flex min-h-11 cursor-not-allowed items-center rounded-full px-4 text-[15px] font-bold text-sand-light/40 ${mobileStyle ? 'w-full text-lg' : ''}`}
        title="Create a project first"
      >
        {item.label}
      </span>
    ) : (
      <NavLink
        to={item.to}
        end={item.end}
        onClick={() => setMobile(false)}
        className={({ isActive }) =>
          `inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-bold transition-colors hover:bg-white/10 hover:text-white ${
            mobileStyle ? 'w-full text-lg' : 'text-[15px]'
          } ${isActive ? 'bg-white/15 text-white' : 'text-sand-light/90'}`
        }
      >
        {item.label}
        {!!item.badge && (
          <span className="min-w-5 rounded-full bg-coral px-1.5 text-center text-xs leading-5 font-bold text-ink">
            {item.badge}
            <span className="sr-only"> unread</span>
          </span>
        )}
      </NavLink>
    )

  return (
    <header className="sticky top-0 z-40 bg-brand text-sand-light shadow-[0_1px_0_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <img src={logo} alt="MissingPiece" className="h-7 w-auto shrink-0 sm:h-8" />
        <nav aria-label="Main" className="ml-4 hidden flex-1 lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((item) => (
              <li key={item.label}>{link(item)}</li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-expanded={menu}
              className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pr-2 pl-1 hover:bg-white/10"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-sand font-bold text-brand" aria-hidden>
                {initials(me?.name ?? '')}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[15px] font-bold text-white">{me?.name}</span>
                <span className="block text-sm text-sand-light/80">{me ? ROLE_LABEL[me.role] : ''}</span>
              </span>
              <ChevronDown className="size-4" aria-hidden />
              <span className="sr-only">Account menu</span>
            </button>
            {menu && (
              <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-[#E2DED5] bg-white py-1 text-ink shadow-xl">
                <p className="border-b border-[#E2DED5] px-4 py-3 text-sm text-ink-soft">{me?.email}</p>
                {profileTo && (
                  <Link to={profileTo} onClick={() => setMenu(false)} className="flex min-h-12 items-center gap-2 px-4 font-bold hover:bg-paper">
                    <UserRound className="size-5" aria-hidden /> Profile
                  </Link>
                )}
                <button
                  type="button"
                  onClick={logOut}
                  className="flex min-h-12 w-full items-center gap-2 px-4 text-left font-bold hover:bg-paper"
                >
                  <LogOut className="size-5" aria-hidden /> Log out
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 lg:hidden"
            aria-expanded={mobile}
            aria-controls="app-mobile-nav"
            aria-label={mobile ? 'Close menu' : 'Open menu'}
            onClick={() => setMobile((v) => !v)}
          >
            {mobile ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>
      </div>
      {mobile && (
        <nav id="app-mobile-nav" aria-label="Main" className="border-t border-white/10 px-4 pb-4 lg:hidden">
          <ul className="flex flex-col gap-1 py-2">
            {nav.map((item) => (
              <li key={item.label}>{link(item, true)}</li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
