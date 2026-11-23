import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { UserRole } from '../../../api/types'
import { authService } from '../../../auth/authService'
import { LOGIN_PATH } from '../../../auth/roles'
import { TextField } from '../../../components/ui/Field'
import Notice from '../../../components/ui/Notice'
import { btn } from '../../../components/ui/buttons'
import AuthLayout, { AuthHeading } from './AuthLayout'

/** Password reset uses Supabase's reset flow (build prompt 3.1). */
export default function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const role = (params.get('role') as UserRole | null) ?? 'general'
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
      await authService.resetPassword(email.trim())
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
        <AuthHeading title="Reset your password" intro="Enter your email and we will send you a link to set a new password." />
        {sent ? (
          <Notice tone="success">
            If an account uses <strong>{email}</strong>, a reset link is on its way. Check your inbox and spam folder.
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
