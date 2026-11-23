import { Check, X } from 'lucide-react'
import { useId } from 'react'
import { checkPassword, MAX_LENGTH, type PasswordCheck } from '../../lib/passwordStrength'
import { TextField } from './Field'

const BAR = ['bg-warning', 'bg-warning', 'bg-[#C98A1B]', 'bg-accent', 'bg-brand'] as const

/** The strength bar, its label in words, and the list of rules with a tick or a cross. */
export function PasswordStrength({ check, show, hideTip = false }: { check: PasswordCheck; show: boolean; hideTip?: boolean }) {
  const id = useId()
  if (!show) return null
  return (
    <div className="mt-2" aria-live="polite" id={id}>
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={`h-2 rounded-full ${i <= check.score ? BAR[check.score] : 'bg-[#E2DED5]'}`} />
          ))}
        </div>
        <span className={`min-w-18 text-right text-[15px] font-bold ${check.ok ? 'text-accent' : 'text-warning'}`}>
          {check.label}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-[9.25pt]">
        {check.rules.map((r) => (
          <li key={r.label} className={`flex items-center gap-2 ${r.met ? 'text-accent' : 'text-ink-soft'}`}>
            {r.met ? <Check className="size-4 shrink-0" aria-hidden /> : <X className="size-4 shrink-0" aria-hidden />}
            {r.label}
            <span className="sr-only">{r.met ? ' (done)' : ' (not yet)'}</span>
          </li>
        ))}
      </ul>
      {check.tip && !hideTip && <p className="mt-1.5 text-[9.25pt] text-ink-soft">{check.tip}</p>}
    </div>
  )
}

type Props = {
  password: string
  confirm: string
  onPassword: (v: string) => void
  onConfirm: (v: string) => void
  /** Email and name, so the password cannot be built from them */
  personal?: (string | undefined)[]
  /** Errors to show after a submit attempt */
  errors?: { password?: string | null; confirm?: string | null }
  label?: string
}

/**
 * "New password" + "Confirm password", both with the eye button, and a live strength
 * meter. Use validateNewPassword on submit: a weak password is not accepted.
 */
export default function NewPasswordFields({ password, confirm, onPassword, onConfirm, personal = [], errors, label = 'Password' }: Props) {
  const check = checkPassword(password, personal)
  return (
    <>
      <div>
        <TextField
          label={label}
          type="password"
          autoComplete="new-password"
          value={password}
          maxLength={MAX_LENGTH}
          onChange={(e) => onPassword(e.target.value)}
          error={errors?.password}
        />
        {/* The tip already shows as the field's error after a submit, so not twice */}
        <PasswordStrength check={check} show={password.length > 0} hideTip={!!errors?.password} />
      </div>
      <TextField
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        maxLength={MAX_LENGTH}
        onChange={(e) => onConfirm(e.target.value)}
        error={errors?.confirm}
        hint={confirm && confirm === password ? <span className="text-[9.25pt]">Passwords match.</span> : undefined}
      />
    </>
  )
}

/** Errors for the two fields, or null when the password may be used. */
export function validateNewPassword(password: string, confirm: string, personal: (string | undefined)[] = []) {
  const check = checkPassword(password, personal)
  const errors: { password?: string; confirm?: string } = {}
  if (!check.ok) errors.password = check.tip ?? 'Choose a stronger password.'
  if (!confirm) errors.confirm = 'Type the password again.'
  else if (confirm !== password) errors.confirm = 'The two passwords do not match.'
  return Object.keys(errors).length ? errors : null
}
