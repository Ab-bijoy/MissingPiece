import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { UserRole } from '../../../api/types'
import { useAuth } from '../../../auth/AuthProvider'
import { authService } from '../../../auth/authService'
import { HOME_PATH, loginProblem, SIGNUP_PATH } from '../../../auth/roles'
import { TextField } from '../../../components/ui/Field'
import Notice from '../../../components/ui/Notice'
import { btn } from '../../../components/ui/buttons'
import AuthLayout, { AuthHeading } from './AuthLayout'

const COPY: Record<
  UserRole,
  { chip: string; title: string; intro: string; home: string; newTitle?: string; newCta?: string; approvalNote?: string }
> = {
  general: {
    chip: 'General user',
    title: 'Log in',
    intro: 'Welcome back. Use the email you signed up with.',
    home: '/community',
    newTitle: 'New to MissingPiece?',
    newCta: 'Create a personal account',
  },
  organizer: {
    chip: 'Organizer',
    title: 'Organizer log in',
    intro: 'Log in to manage your projects, offers and sponsors.',
    home: '/organizers',
    newTitle: 'New organization on MissingPiece?',
    newCta: 'Register your organization',
    approvalNote: 'You can log in once an admin approves your organization.',
  },
  sponsor: {
    chip: 'Sponsor',
    title: 'Sponsor log in',
    intro: 'Log in to see requests, make offers and pay.',
    home: '/sponsors',
    newTitle: 'New company on MissingPiece?',
    newCta: 'Register as a sponsor',
    approvalNote: 'You can log in once an admin approves your company.',
  },
  admin: {
    chip: 'Admin',
    title: 'Admin log in',
    intro: 'For the MissingPiece platform team only.',
    home: '/',
  },
}

/**
 * The four log-in screens (build prompt 3.4 step 3): Supabase sign-in, then
 * GET /auth/me. Wrong role or a non-active account signs out with a message.
 */
export default function LoginPage({ role }: { role: UserRole }) {
  const copy = COPY[role]
  const navigate = useNavigate()
  const location = useLocation()
  const { loadMe, signOut } = useAuth()
  const state = location.state as { notice?: string; from?: string } | null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(state?.notice ?? null)
  const [busy, setBusy] = useState(false)

  // A guard sent us here because the account cannot use this area: end that session.
  useEffect(() => {
    if (state?.notice) void signOut()
  }, [state?.notice, signOut])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setBusy(true)
    try {
      await authService.signIn(email.trim(), password, remember)
      const me = await loadMe()
      if (!me) {
        await signOut()
        setError('Your email is confirmed, but your profile is not set up yet. Fill in the sign-up form again with the same email and password to finish.')
        return
      }
      const problem = loginProblem(me, role)
      if (problem) {
        await signOut()
        setError(problem)
        return
      }
      navigate(state?.from ?? HOME_PATH[role], { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout homeTo={copy.home}>
      <form onSubmit={submit} className="flex flex-col gap-4.5" noValidate>
        <AuthHeading chip={copy.chip} title={copy.title} intro={copy.intro} />
        {error && <Notice tone="error">{error}</Notice>}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-5 accent-accent"
            />
            Keep me logged in
          </label>
          <Link to={`/forgot-password?role=${role}`} className="inline-flex min-h-11 items-center font-bold text-accent">
            Forgot password?
          </Link>
        </div>
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>

        {copy.approvalNote && <Notice tone="info">{copy.approvalNote}</Notice>}

       

        {role !== 'admin' && (
          <div className="flex flex-col gap-2.5 border-t border-[#E2DED5] pt-4">
            <p className="text-center font-bold">{copy.newTitle}</p>
            <Link to={SIGNUP_PATH[role]} className={btn.secondary}>
              {copy.newCta}
            </Link>
          </div>
        )}
      </form>
    </AuthLayout>
  )
}
