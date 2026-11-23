import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { authService } from '../../../auth/authService'
import { LOGIN_PATH } from '../../../auth/roles'
import NewPasswordFields, { validateNewPassword } from '../../../components/ui/NewPasswordFields'
import Notice from '../../../components/ui/Notice'
import { btn } from '../../../components/ui/buttons'
import AuthLayout, { AuthHeading } from './AuthLayout'

/** Supabase puts a problem with the link (expired, already used) in the address. */
function linkProblem(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
  const code = params.get('error_code') ?? params.get('error')
  if (!code) return null
  if (code === 'otp_expired' || code === 'access_denied') return 'This reset link has expired or was already used.'
  return params.get('error_description')?.replace(/\+/g, ' ') ?? 'This reset link does not work.'
}

/**
 * "Set a new password" (all roles). The link in the reset email opens this page and
 * signs the person in just for this. They choose a new password (a weak one is not
 * accepted), then we sign them out and send them to their own log-in page.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { me, loadMe, signOut } = useAuth()
  const [problem] = useState(linkProblem) // read before anything changes the address
  const [phase, setPhase] = useState<'checking' | 'form' | 'invalid'>(problem ? 'invalid' : 'checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Supabase reads the link from the address when the page loads; then we have a session.
  useEffect(() => {
    if (problem) return
    let cancelled = false
    authService.getAccessToken().then((token) => {
      if (!cancelled) setPhase(token ? 'form' : 'invalid')
    })
    return () => {
      cancelled = true
    }
  }, [problem])

  const personal = [me?.email, me?.name]

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const found = validateNewPassword(password, confirm, personal)
    setErrors(found)
    if (found) return
    setBusy(true)
    try {
      await authService.updatePassword(password)
      const account = await loadMe().catch(() => null)
      await signOut()
      navigate(LOGIN_PATH[account?.role ?? 'general'], {
        replace: true,
        state: { success: 'Your password is changed. Log in with your new password.' },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the new password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      {phase === 'checking' && (
        <div role="status" className="py-10 text-center text-ink-soft">
          Checking your reset link…
        </div>
      )}

      {phase === 'invalid' && (
        <div className="flex flex-col gap-4.5">
          <AuthHeading title="Link not valid" />
          <Notice tone="error">
            {problem ?? 'This reset link has expired or was already used.'} Reset links work once, for one hour.
          </Notice>
          <Link to="/forgot-password" className={btn.primary}>
            Send a new link
          </Link>
          <Link to="/login" className={btn.ghost}>
            Back to log in
          </Link>
        </div>
      )}

      {phase === 'form' && (
        <form onSubmit={submit} className="flex flex-col gap-4.5" noValidate>
          <AuthHeading
            title="Set a new password"
            intro={me?.email ? <>For <strong>{me.email}</strong>. Choose a strong password you have not used here before.</> : 'Choose a strong password you have not used here before.'}
          />
          {error && <Notice tone="error">{error}</Notice>}
          <NewPasswordFields
            label="New password"
            password={password}
            confirm={confirm}
            onPassword={(v) => {
              setPassword(v)
              if (errors) setErrors(validateNewPassword(v, confirm, personal))
            }}
            onConfirm={(v) => {
              setConfirm(v)
              if (errors) setErrors(validateNewPassword(password, v, personal))
            }}
            personal={personal}
            errors={errors ?? undefined}
          />
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
