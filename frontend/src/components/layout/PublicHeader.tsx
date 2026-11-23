import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import logo from '../../assets/brand/logo-wordmark.png'

const MAIN_NAV = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/organizers', label: 'Organizers' },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/community', label: 'Community' },
]

export type SectionLink = { id: string; label: string }

type Props = {
  /** Removes the Log in link (used on the main landing page). */
  hideLogin?: boolean
  /**
   * Page-only navigation. When set, the navbar lists only these sections of
   * the current page, and the logo scrolls to the top instead of leaving it.
   */
  sections?: SectionLink[]
  /** Where Log in and Get started go. Defaults suit the main landing. */
  loginTo?: string
  cta?: { label: string; to: string }
}

const linkBase =
  'inline-flex min-h-11 whitespace-nowrap items-center rounded-full px-4 text-[15px] font-bold transition-colors hover:bg-white/10 hover:text-white'

/**
 * Returns the id of the section the reader is in: the last section whose top
 * has passed just below the header. At the very bottom of the page the last
 * section wins, so short final sections (like FAQ) still get highlighted.
 */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join(',')
  useEffect(() => {
    if (!key) return
    const list = key.split(',')
    const update = () => {
      const line = 72 + window.innerHeight * 0.25 // header height + a quarter screen
      let current: string | null = null
      for (const id of list) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= line) current = id
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) current = list[list.length - 1]
      setActive(current)
    }
    // Five getBoundingClientRect calls per scroll event is cheap enough.
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [key])
  return active
}

export default function PublicHeader({
  hideLogin = false,
  sections,
  loginTo = '/login',
  cta = { label: 'Get started', to: '/#get-started' },
}: Props) {
  const [open, setOpen] = useState(false)
  const pageOnly = !!sections
  // The full navbar needs about 860px, so below 1024px it folds into the menu button.
  const bp = { show: 'hidden lg:block', showFlex: 'hidden lg:flex', hide: 'lg:hidden' }
  const active = useActiveSection(sections?.map((s) => s.id) ?? [])

  const toTop = () => {
    setOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const logoImg = <img src={logo} alt="MissingPiece" className="h-7 w-auto sm:h-8" />

  return (
    <header className="sticky top-0 z-40 bg-brand text-sand-light shadow-[0_1px_0_rgba(0,0,0,0.15)]">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        {pageOnly ? (
          <button type="button" onClick={toTop} className="shrink-0" aria-label="Back to top">
            {logoImg}
          </button>
        ) : (
          <Link to="/" className="shrink-0" aria-label="MissingPiece home">
            {logoImg}
          </Link>
        )}

        <nav aria-label={pageOnly ? 'On this page' : 'Main'} className={bp.show}>
          <ul className="flex items-center gap-1">
            {pageOnly
              ? sections!.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      aria-current={active === s.id ? 'location' : undefined}
                      className={`${linkBase} ${active === s.id ? 'bg-white/15 text-white' : 'text-sand-light/90'}`}
                    >
                      {s.label}
                    </a>
                  </li>
                ))
              : MAIN_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `${linkBase} ${isActive && !item.to.includes('#') ? 'bg-white/15 text-white' : 'text-sand-light/90'}`
                      }
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
          </ul>
        </nav>

        <div className={`items-center gap-2 ${bp.showFlex}`}>
          {!hideLogin && (
            <Link to={loginTo} className={`${linkBase} text-sand-light`}>
              Log in
            </Link>
          )}
          <Link
            to={cta.to}
            className="inline-flex min-h-11 items-center rounded-full bg-coral px-5 text-[15px] font-bold whitespace-nowrap text-ink transition-colors hover:bg-sand"
          >
            {cta.label}
          </Link>
        </div>

        <button
          type="button"
          className={`inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 ${bp.hide}`}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label={pageOnly ? 'On this page' : 'Main'}
          className={`border-t border-white/10 px-4 pb-5 ${bp.hide}`}
        >
          <ul className="flex flex-col py-2">
            {pageOnly
              ? sections!.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center text-lg font-bold text-sand-light"
                    >
                      {s.label}
                    </a>
                  </li>
                ))
              : MAIN_NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className="flex min-h-12 items-center text-lg font-bold text-sand-light"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
          </ul>
          <div className="flex gap-3">
            {!hideLogin && (
              <Link
                to={loginTo}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full border-2 border-sand/60 font-bold"
              >
                Log in
              </Link>
            )}
            <Link
              to={cta.to}
              onClick={() => setOpen(false)}
              className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full bg-coral text-center font-bold text-ink"
            >
              {cta.label}
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}
