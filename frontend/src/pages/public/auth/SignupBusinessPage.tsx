import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountExistsError, authService } from '../../../auth/authService'
import { useAuth } from '../../../auth/AuthProvider'
import { resumeSignup } from '../../../auth/resumeSignup'
import { pendingSignup } from '../../../auth/pendingSignup'
import { FileField, fileProblem, SelectField, TextField } from '../../../components/ui/Field'
import Notice from '../../../components/ui/Notice'
import { btn } from '../../../components/ui/buttons'
import AuthLayout, { AuthHeading } from './AuthLayout'

type Role = 'organizer' | 'sponsor'
type FieldDef = { name: string; label: string; type?: 'select'; options?: [string, string][] }

const CONFIG: Record<
  Role,
  {
    chip: string
    title: string
    intro: string
    home: string
    login: string
    fields: FieldDef[]
    nameField: string
    fileLabel: string
    note: string
  }
> = {
  organizer: {
    chip: 'Organizer · needs admin approval',
    title: 'Register your organization',
    intro: 'For university clubs and offices, NGOs and community groups that run projects.',
    home: '/organizers',
    login: '/organizer/login',
    nameField: 'org_name',
    fields: [
      { name: 'org_name', label: 'Organization name' },
      {
        name: 'org_type',
        label: 'Organization type',
        type: 'select',
        options: [
          ['ngo', 'NGO'],
          ['university', 'University club or office'],
          ['community_group', 'Community group'],
        ],
      },
      { name: 'registration_number', label: 'Registration or approval number' },
      { name: 'contact_person', label: 'Contact person' },
      { name: 'phone', label: 'Phone' },
    ],
    fileLabel: 'Proof of registration or approval letter',
    note: 'An admin checks every organizer. You can log in after your request is approved.',
  },
  sponsor: {
    chip: 'Sponsor · needs admin approval',
    title: 'Register as a sponsor',
    intro: 'For companies that want to support projects with money, goods or skills.',
    home: '/sponsors',
    login: '/sponsor/login',
    nameField: 'company',
    fields: [
      { name: 'company', label: 'Company name' },
      { name: 'industry', label: 'Industry' },
      { name: 'trade_license_number', label: 'Trade licence number' },
      { name: 'contact_person', label: 'Contact person' },
      { name: 'phone', label: 'Phone' },
    ],
    fileLabel: 'Trade licence copy',
    note: 'An admin checks every sponsor. You can log in after your request is approved.',
  },
}

/**
 * Organizer and sponsor registration (build prompt 3.4 step 2): form →
 * Supabase sign-up → email code → multipart register call → Request sent.
 */
export default function SignupBusinessPage({ role }: { role: Role }) {
  const c = CONFIG[role]
  const navigate = useNavigate()
  const { loadMe } = useAuth()
  const prev = pendingSignup.get()
  const start = prev && prev.role === role ? prev : null

  const [values, setValues] = useState<Record<string, string>>(
    () => start?.fields ?? Object.fromEntries(c.fields.map((f) => [f.name, f.options?.[0][0] ?? ''])),
  )
  const [email, setEmail] = useState(start?.email ?? '')
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File | null>(start?.file ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }))

  function validate() {
    const e: Record<string, string> = {}
    for (const f of c.fields) if (!values[f.name]?.trim()) e[f.name] = `Please fill in ${f.label.toLowerCase()}.`
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Please enter a valid work email.'
    if (password.length < 8) e.password = 'Use at least 8 characters.'
    const fp = fileProblem(file)
    if (fp) e.file = fp
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    setFormError(null)
    if (!validate()) return
    setBusy(true)
    try {
      try {
        await authService.signUp(email.trim(), password)
      } catch (err) {
        // Email confirmed earlier but no profile yet: log in and finish instead.
        if (!(err instanceof AccountExistsError)) throw err
        await resumeSignup(email.trim(), password, loadMe)
      }
      pendingSignup.set({
        role,
        email: email.trim(),
        displayName: values[c.nameField].trim(),
        fields: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])),
        file: file!,
      })
      navigate('/verify-email')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send your request. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout homeTo={c.home} width="wide">
      <form onSubmit={submit} className="flex flex-col gap-4.5" noValidate>
        <AuthHeading chip={c.chip} title={c.title} intro={c.intro} />
        {formError && <Notice tone="error">{formError}</Notice>}
        {c.fields.map((f) =>
          f.type === 'select' ? (
            <SelectField
              key={f.name}
              label={f.label}
              value={values[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              error={errors[f.name]}
            >
              {f.options!.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </SelectField>
          ) : (
            <TextField
              key={f.name}
              label={f.label}
              type={f.name === 'phone' ? 'tel' : 'text'}
              autoComplete={f.name === 'phone' ? 'tel' : undefined}
              value={values[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              error={errors[f.name]}
            />
          ),
        )}
        <TextField
          label="Work email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
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
        <FileField label={c.fileLabel} hint="PDF or photo, up to 5 MB" file={file} onFile={setFile} error={errors.file} />
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy ? 'Sending…' : 'Send registration request'}
        </button>
        <p className="text-[15px] text-ink-soft">
          We will email you a 6-digit code first. {c.note}
        </p>
        <div className="border-t border-[#E2DED5] pt-4 text-center">
          Already have an account?{' '}
          <Link to={c.login} className="font-bold text-accent">
            Log in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}
