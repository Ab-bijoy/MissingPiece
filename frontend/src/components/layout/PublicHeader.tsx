import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import logo from '../../assets/brand/logo-wordmark.png'

const MAIN_NAV = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/organizers', label: 'Organizers' },
  { to: '/sponsors', label: 'Sponsors' },
  { to: '/community', label: 'Community' },
]

/**
 * The main landing's "Join us" menu: one landing page per kind of account.
 * Each of those pages explains the role and has its own Register and Log in buttons.
 */
const JOIN_OPTIONS = [
  { to: '/organizers', label: 'Join as an organizer', hint: 'Clubs, NGOs and groups' },
  { to: '/sponsors', label: 'Join as a sponsor', hint: 'Companies and brands' },
  { to: '/community', label: 'Join the community', hint: 'Take part in programs or help out' },
]

export type SectionLink = { id: string; label: string }

type Props = {
  /**
   * Replaces Log in and the call-to-action button with one "Join us" menu that
   * leads to the organizer, sponsor and community pages (used on the main
   * landing page, which serves everyone).
   */
  joinMenu?: boolean
  /**
   * Page-only navigation. When set, the navbar lists only these sections of
   * the current page, and the logo scrolls to the top instead of leaving it.
   */
  sections?: SectionLink[]
  /**
   * Where the logo goes. Without it, the logo scrolls to the top on a page with
   * `sections` (the main landing) and goes to the main landing everywhere else.
   * The organizer, sponsor and community pages pass "/" so it leads home.
   */
  logoTo?: string
  /** Where Log in and Get started go. Defaults suit the main landing. */
  loginTo?: string
  cta?: { label: string; to: string }
}

// Links get a coral underline when hovered or current, instead of a filled pill.
const linkBase =
  'relative inline-flex min-h-11 whitespace-nowrap items-center rounded-full px-4 text-[15px] font-bold transition-colors hover:text-white ' +
  'after:absolute after:inset-x-4 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-coral after:transition-transform after:duration-200 hover:after:scale-x-100'
const linkIdle = 'text-sand-light/85 after:scale-x-0'
const linkActive = 'text-white after:scale-x-100'

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

/** True once the page has scrolled a little, so the header can lift off the page with a shadow. */
function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [offset])
  return scrolled
}

/** Coral "Join us" button that opens a small menu with the three ways to join. */
function JoinMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="join-menu"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-[15px] font-bold whitespace-nowrap text-ink shadow-sm transition-colors ${
          open ? 'bg-sand' : 'bg-coral hover:bg-sand'
        }`}
      >
        Join us <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul
          id="join-menu"
          className="absolute right-0 z-50 mt-2 w-72 origin-top-right overflow-hidden rounded-2xl bg-white p-1.5 text-ink shadow-xl ring-1 ring-black/10 motion-safe:animate-menu-in"
        >
          {JOIN_OPTIONS.map((l) => (
            <li key={l.to}>
              <Link
                to={l.to}
                onClick={() => setOpen(false)}
                className="group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-2.5 transition-colors duration-200 hover:bg-sand-light focus-visible:bg-sand-light"
              >
                {/* Coral bar that grows in from the left edge on hover */}
                <span
                  className="absolute inset-y-2 left-0 w-1 origin-center scale-y-0 rounded-full bg-coral transition-transform duration-200 group-hover:scale-y-100 group-focus-visible:scale-y-100"
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 flex-col transition-transform duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1">
                  <span className="font-bold text-deep transition-colors group-hover:text-brand">{l.label}</span>
                  <span className="text-sm text-ink-soft">{l.hint}</span>
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-coral-dark opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-safe:-translate-x-2 motion-safe:group-hover:translate-x-0 motion-safe:group-focus-visible:translate-x-0"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function PublicHeader({
  joinMenu = false,
  sections,
  logoTo,
  loginTo = '/login',
  cta = { label: 'Get started', to: '/#get-started' },
}: Props) {
  const [open, setOpen] = useState(false)
  const pageOnly = !!sections
  const scrolled = useScrolled()
  // The full navbar needs about 860px, so below 1024px it folds into the menu button.
  const bp = { show: 'hidden lg:flex', showFlex: 'hidden lg:flex', hide: 'lg:hidden' }
  const active = useActiveSection(sections?.map((s) => s.id) ?? [])

  const toTop = () => {
    setOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const logoImg = <img src={logo} alt="MissingPiece" className="h-7 w-auto sm:h-8" />

  return (
    <header
      className={`sticky top-0 z-40 bg-brand text-sand-light transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_6px_20px_rgba(0,0,0,0.18)]' : 'shadow-[0_1px_0_rgba(0,0,0,0.15)]'
      }`}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {pageOnly && !logoTo ? (
          <button type="button" onClick={toTop} className="shrink-0" aria-label="Back to top">
            {logoImg}
          </button>
        ) : (
          <Link to={logoTo ?? '/'} className="shrink-0" aria-label="MissingPiece home">
            {logoImg}
          </Link>
        )}

        {/* The links sit centred between the logo and the buttons */}
        <nav aria-label={pageOnly ? 'On this page' : 'Main'} className={`${bp.show} flex-1 justify-center`}>
          <ul className="flex items-center gap-1">
            {pageOnly
              ? sections!.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      aria-current={active === s.id ? 'location' : undefined}
                      className={`${linkBase} ${active === s.id ? linkActive : linkIdle}`}
                    >
                      {s.label}
                    </a>
                  </li>
                ))
              : MAIN_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => `${linkBase} ${isActive && !item.to.includes('#') ? linkActive : linkIdle}`}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
          </ul>
        </nav>

        <div className={`ml-auto items-center gap-2 lg:ml-0 ${bp.showFlex}`}>
          {joinMenu ? (
            <JoinMenu />
          ) : (
            <>
              <Link to={loginTo} className={`${linkBase} ${linkIdle}`}>
                Log in
              </Link>
              <Link
                to={cta.to}
                className="inline-flex min-h-11 items-center rounded-full bg-coral px-5 text-[15px] font-bold whitespace-nowrap text-ink shadow-sm transition-colors hover:bg-sand"
              >
                {cta.label}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className={`ml-auto inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10 ${bp.hide}`}
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
          {joinMenu ? (
            <div className="border-t border-white/10 pt-3">
              <p className="pb-2 text-sm font-bold tracking-wider text-sand uppercase">Join us</p>
              <ul className="grid gap-2">
                {JOIN_OPTIONS.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      onClick={() => setOpen(false)}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-2 hover:bg-white/15"
                    >
                      <span className="flex flex-col">
                        <span className="text-lg font-bold text-white">{l.label}</span>
                        <span className="text-sm text-sand-light/80">{l.hint}</span>
                      </span>
                      <ArrowRight className="size-5 shrink-0 text-coral" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link
                to={loginTo}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full border-2 border-sand/60 font-bold"
              >
                Log in
              </Link>
              <Link
                to={cta.to}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full bg-coral text-center font-bold text-ink"
              >
                {cta.label}
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  )
}
