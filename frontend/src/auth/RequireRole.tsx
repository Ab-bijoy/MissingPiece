import { useQueryClient } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { devSignInAs } from '../api/mock/mockAuth'
import type { UserRole } from '../api/types'
import FullPageSpinner from '../components/ui/FullPageSpinner'
import { env } from '../lib/env'
import { useAuth } from './AuthProvider'
import { LOGIN_PATH, loginProblem } from './roles'

/**
 * Route guard for one area (build prompt 9.1): checks the session and the role
 * and status from GET /auth/me, and sends everyone else to the right log-in.
 * With VITE_SKIP_AUTH=true it signs in as that role's demo account instead.
 */
export default function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { signedIn, me, meLoading, loadMe } = useAuth()
  const location = useLocation()
  const qc = useQueryClient()
  const problem = me ? loginProblem(me, role) : null
  const needsDevLogin = env.skipAuth && signedIn !== null && !meLoading && (!signedIn || !me || !!problem)

  useEffect(() => {
    if (!needsDevLogin) return
    // Drop the previous demo account's data (but keep the 'me' query alive).
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    devSignInAs(role)
    void loadMe()
  }, [needsDevLogin, role, loadMe, qc])

  if (signedIn === null || meLoading || needsDevLogin) return <FullPageSpinner />
  if (!signedIn || !me) return <Navigate to={LOGIN_PATH[role]} replace state={{ from: location.pathname + location.search }} />
  if (problem) return <Navigate to={LOGIN_PATH[role]} replace state={{ notice: problem }} />

  return <>{children}</>
}
