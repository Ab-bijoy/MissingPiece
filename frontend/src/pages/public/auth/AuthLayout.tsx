import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import logo from '../../../assets/brand/logo-wordmark.png'

/**
 * Frame for every log-in and sign-up screen (prototype "Sign in" row):
 * brand bar, then one white card on the paper background.
 */
export default function AuthLayout({
  children,
  homeTo = '/',
  width = 'narrow',
  centered = false,
}: {
  children: ReactNode
  /** Where the logo goes: the matching role landing page */
  homeTo?: string
  width?: 'narrow' | 'wide'
  centered?: boolean
}) {
  return (
    <div className="flex min-h-svh flex-col bg-paper text-[17px] leading-normal text-ink">
      <header className="bg-brand">
        <div className="mx-auto flex h-18 max-w-7xl items-center px-4 sm:px-8">
          <Link to={homeTo} aria-label="MissingPiece home">
            <img src={logo} alt="MissingPiece" className="h-7 w-auto sm:h-8" />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 py-10 sm:px-8 sm:py-14">
        <section
          className={`h-fit w-full rounded-2xl border border-[#E2DED5] bg-white p-6 sm:p-8 ${
            width === 'wide' ? 'max-w-[560px]' : 'max-w-[460px]'
          } ${centered ? 'text-center' : ''}`}
        >
          {children}
        </section>
      </main>
    </div>
  )
}

export function RoleChip({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2.5 inline-block rounded-full bg-[#E6F1EE] px-3 py-1 text-sm font-bold text-[#0B4F44]">
      {children}
    </span>
  )
}

export function AuthHeading({ chip, title, intro }: { chip?: ReactNode; title: string; intro?: ReactNode }) {
  return (
    <div>
      {chip && <RoleChip>{chip}</RoleChip>}
      <h1 className="text-[30px] leading-tight font-bold">{title}</h1>
      {intro && <p className="mt-1.5 text-ink-soft">{intro}</p>}
    </div>
  )
}
