import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { UserRole } from '../../../api/types'
import { authApi } from '../../../api/auth'
import { LOGIN_PATH, ROLE_LABEL } from '../../../auth/roles'
import { TextField } from '../../../components/ui/Field'
import Notice from '../../../components/ui/Notice'
import { btn } from '../../../components/ui/buttons'
import AuthLayout, { AuthHeading } from './AuthLayout'

/** Password reset uses Supabase's reset flow (build prompt 3.1). */
export default function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const asked = params.get('role')
  // Only the four real roles; anything else in the address means the general user page
  const role: UserRole = asked && asked in LOGIN_PATH ? (asked as UserRole) : 'general'
  const back = LOGIN_PATH[role] ?? '/login'

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.')
      return
    }
    setBusy(true)
    try {
      // Our API checks the role: a sponsor page cannot send a reset link to an admin account.
      await authApi.requestPasswordReset(email.trim(), role)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={submit} className="flex flex-col gap-4.5" noValidate>
        <AuthHeading
          chip={ROLE_LABEL[role]}
          title="Reset your password"
          intro={`Enter the email of your ${ROLE_LABEL[role].toLowerCase()} account and we will send you a link to set a new password.`}
        />
        {sent ? (
          <Notice tone="success">
            If a {ROLE_LABEL[role].toLowerCase()} account uses <strong>{email}</strong>, a reset link is on its way. Check your inbox and
            spam folder. Have a different kind of account? Use the “Forgot password?” link on its own log-in page.
          </Notice>
        ) : (
          <>
            {error && <Notice tone="error">{error}</Notice>}
            <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" className={btn.primary} disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </>
        )}
        <Link to={back} className={btn.ghost}>
          Back to log in
        </Link>
      </form>
    </AuthLayout>
  )
}
