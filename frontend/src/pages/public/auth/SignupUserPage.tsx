import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../../../auth/authService'
import { pendingSignup } from '../../../auth/pendingSignup'
import { TextField } from '../../../components/ui/Field'
import Notice from '../../../components/ui/Notice'
import { btn } from '../../../components/ui/buttons'
import AuthLayout, { AuthHeading } from './AuthLayout'

/** Personal account (build prompt 3.4 step 1): form → Supabase sign-up → email code. */
export default function SignupUserPage() {
  const navigate = useNavigate()
  const prev = pendingSignup.get()
  const start = prev?.role === 'general' ? prev : null

  const [name, setName] = useState(start?.name ?? '')
  const [email, setEmail] = useState(start?.email ?? '')
  const [age, setAge] = useState(start?.age != null ? String(start.age) : '')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Please enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Please enter a valid email address.'
    if (age && !(/^\d+$/.test(age) && Number(age) <= 130)) e.age = 'Please enter your age as a number.'
    if (password.length < 8) e.password = 'Use at least 8 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!validate()) return
    setBusy(true)
    try {
      await authService.signUp(email.trim(), password)
      pendingSignup.set({ role: 'general', email: email.trim(), name: name.trim(), age: age ? Number(age) : null })
      navigate('/verify-email')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout homeTo="/community">
      <form onSubmit={submit} className="flex flex-col gap-4.5" noValidate>
        <AuthHeading
          chip="General user · email code only"
          title="Create your account"
          intro="Join events near you, or offer your time and skills."
        />
        {formError && <Notice tone="error">{formError}</Notice>}
        <TextField label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Age"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          error={errors.age}
          hint="Only you and organizers of events you join can see it."
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
        />
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-[15px] text-ink-soft">Next, we will email you a 6-digit code to confirm your address.</p>
        <div className="border-t border-[#E2DED5] pt-4 text-center">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-accent">
            Log in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
