import { Mail } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../../../api/auth'
import { ApiError } from '../../../api/client'
import { DEMO_OTP } from '../../../api/mock/mockDb'
import { useAuth } from '../../../auth/AuthProvider'
import { authService } from '../../../auth/authService'
import { pendingSignup, type PendingSignup } from '../../../auth/pendingSignup'
import { HOME_PATH, LANDING_PATH, SIGNUP_PATH } from '../../../auth/roles'
import Notice from '../../../components/ui/Notice'
import OtpInput from '../../../components/ui/OtpInput'
import { btn } from '../../../components/ui/buttons'
import AuthLayout from './AuthLayout'
import DemoHint from './DemoHint'

const RESEND_SECONDS = 45

/** Calls the register endpoint that matches the sign-up form. */
function register(p: PendingSignup) {
  if (p.role === 'general') return authApi.registerUser({ name: p.name, age: p.age })
  const form = new FormData()
  Object.entries(p.fields).forEach(([k, v]) => form.append(k, v))
  form.append(p.role === 'organizer' ? 'proof' : 'trade_license', p.file)
  return p.role === 'organizer' ? authApi.registerOrganizer(form) : authApi.registerSponsor(form)
}

/**
 * Email code screen (build prompt 3.1, 3.4, 9.2). All three roles enter the
 * 6-digit code; general users then go to the feed, organizers and sponsors
 * to "Request sent".
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const { loadMe } = useAuth()
  const pending = pendingSignup.get()
  const remembered = pending ?? pendingSignup.remembered()

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(RESEND_SECONDS)
  const submitted = useRef('')

  useEffect(() => {
    if (seconds <= 0) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds])

  /** Email is verified and we are logged in: create the profile and move on. */
  async function finish(p: PendingSignup) {
    try {
      await register(p)
    } catch (e) {
      // 409 already_registered = profile created on an earlier try; carry on.
      if (!(e instanceof ApiError && e.status === 409 && e.code === 'already_registered')) throw e
    }
    await loadMe()
    const name = p.role === 'general' ? p.name : p.displayName
    pendingSignup.clear()
    if (p.role === 'general') navigate(HOME_PATH.general, { replace: true })
    else navigate('/registration-sent', { replace: true, state: { name, email: p.email, role: p.role } })
  }

  async function verify(full: string) {
    if (!pending || busy) return
    if (full.length !== 6) {
      setError('Please type all 6 digits.')
      return
    }
    submitted.current = full
    setBusy(true)
    setError(null)
    try {
      try {
        await authService.verifyOtp(pending.email, full)
      } catch (e) {
        // A code works once. If it was already accepted (we are logged in), finish anyway.
        if (!(await authService.getAccessToken())) throw e
      }
      await finish(pending)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify the code. Please try again.')
      setBusy(false)
    }
  }

  // Already verified and logged in (for example after signing up again): no code needed.
  useEffect(() => {
    if (!pending) return
    void authService.getAccessToken().then((token) => {
      if (!token) return
      setBusy(true)
      finish(pending).catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not finish signing up. Please try again.')
        setBusy(false)
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Submit by itself once all six digits are in (once per code).
  useEffect(() => {
    if (code.length === 6 && code !== submitted.current) void verify(code)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  async function resend() {
    if (!remembered) return
    setError(null)
    try {
      await authService.resendOtp(remembered.email)
      setInfo('We sent a new code. Check your inbox and spam folder.')
      setSeconds(RESEND_SECONDS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a new code.')
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void verify(code)
  }

  if (!pending) {
    return (
      <AuthLayout centered homeTo={remembered ? LANDING_PATH[remembered.role] : '/'}>
        <div className="flex flex-col items-center gap-5">
          <h1 className="text-[30px] font-bold">Please start again</h1>
          <p className="text-ink-soft">
            {remembered
              ? `We could not keep the form for ${remembered.email} after the page reloaded. Fill it in again and we will send a new code.`
              : 'We do not know which email to check. Start from the sign-up form.'}
          </p>
          <Link to={SIGNUP_PATH[remembered?.role ?? 'general']} className={`${btn.primary} w-full`}>
            Back to sign up
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const mm = Math.floor(seconds / 60)
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <AuthLayout width="wide" centered homeTo={remembered ? LANDING_PATH[remembered.role] : '/'}>
      <form onSubmit={onSubmit} className="flex flex-col items-center gap-5" noValidate>
        <span className="flex size-16 items-center justify-center rounded-full bg-[#E6F1EE]">
          <Mail className="size-8 text-accent" aria-hidden />
        </span>
        <div>
          <h1 className="text-[30px] leading-tight font-bold">Check your email</h1>
          <p className="mt-2 text-ink-soft">
            We sent a 6-digit code to <strong className="text-ink">{pending.email}</strong>. Type it below.
          </p>
        </div>
        <OtpInput value={code} onChange={setCode} disabled={busy} invalid={!!error} />
        {error && <Notice tone="error">{error}</Notice>}
        {info && !error && <Notice tone="success">{info}</Notice>}
        <button type="submit" className={`${btn.primary} w-full`} disabled={busy}>
          {busy ? 'Checking…' : 'Verify email'}
        </button>
        <p className="text-[15px] text-ink-soft">The code works for 5 minutes.</p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {seconds > 0 ? (
            <span className="text-[#5A626B]" aria-live="polite">
              Resend code in {mm}:{ss}
            </span>
          ) : (
            <button type="button" onClick={resend} className="min-h-11 font-bold text-accent underline underline-offset-4">
              Resend code
            </button>
          )}
          <Link to={SIGNUP_PATH[pending.role]} className="inline-flex min-h-11 items-center font-bold text-accent">
            Change email
          </Link>
        </div>
        <DemoHint>
          No email is sent. The code is <code>{DEMO_OTP}</code>.
        </DemoHint>
      </form>
    </AuthLayout>
  )
}
