import { Check, Clock } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider'
import { btn } from '../../../components/ui/buttons'
import AuthLayout from './AuthLayout'

type State = { name?: string; email?: string; role?: 'organizer' | 'sponsor' } | null

const STEPS = [
  { title: 'Request sent', sub: 'Just now', done: true },
  { title: 'Admin review', sub: 'An admin checks your details and documents.', done: false },
  { title: 'You can log in', sub: 'If a request is rejected, the email says why.', done: false },
]

/** "Request sent" for organizers and sponsors (prototype AuthPending). */
export default function RegistrationSentPage() {
  const state = useLocation().state as State
  const { signOut } = useAuth()
  const role = state?.role ?? 'organizer'

  // A pending account cannot use the app yet, so end the session from sign-up.
  useEffect(() => {
    void signOut()
  }, [signOut])

  return (
    <AuthLayout width="wide" centered homeTo={role === 'sponsor' ? '/sponsors' : '/organizers'}>
      <div className="flex flex-col items-center gap-5">
        <span className="flex size-16 items-center justify-center rounded-full bg-[#FBEBDD]">
          <Clock className="size-8 text-warning" aria-hidden />
        </span>
        <div>
          <h1 className="text-[30px] leading-tight font-bold">Registration request sent</h1>
          <p className="mt-2 text-ink-soft">
            Thank you{state?.name ? `, ${state.name}` : ''}. An admin will check your details and documents. We will
            email {state?.email ? <strong className="text-ink">{state.email}</strong> : 'you'} when there is a decision.
          </p>
        </div>
        <ol className="w-full space-y-0 text-left">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-3.5 pb-5 last:pb-0">
              {i < STEPS.length - 1 && <span className="absolute top-9 left-[15px] h-[calc(100%-2.25rem)] w-0.5 bg-[#E2DED5]" aria-hidden />}
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                  s.done ? 'bg-accent text-white' : 'border-2 border-[#C9C3B6] bg-white'
                }`}
              >
                {s.done && <Check className="size-4.5" strokeWidth={3} aria-hidden />}
              </span>
              <div>
                <div className="font-bold">
                  {s.title}
                  <span className="sr-only">{s.done ? ' (done)' : ' (not yet)'}</span>
                </div>
                <div className="text-[15px] text-ink-soft">{s.sub}</div>
              </div>
            </li>
          ))}
        </ol>
        <Link to={role === 'sponsor' ? '/sponsor/login' : '/organizer/login'} className={`${btn.primary} w-full`}>
          Back to log in
        </Link>
      </div>
    </AuthLayout>
  )
}
