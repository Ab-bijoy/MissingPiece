import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import type { Me } from '../api/types'
import { forgetSavedCache } from '../lib/persistCache'
import { authService } from './authService'

type AuthState = {
  /** null while we are still checking for a saved session */
  signedIn: boolean | null
  me: Me | null
  meLoading: boolean
  /** Fetches GET /auth/me now (after log-in or registration). */
  loadMe: () => Promise<Me | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** GET /auth/me. A 404 means signed in with Supabase but no profile yet (mid sign-up). */
async function fetchMe(): Promise<Me | null> {
  try {
    return await authApi.me()
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    authService.getAccessToken().then((t) => setSignedIn(!!t))
    return authService.onChange((s) => {
      setSignedIn(s)
      if (s) void queryClient.invalidateQueries({ queryKey: ['me'] }) // a new session may be a different account
      else {
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
        forgetSavedCache()
      }
      if (!s) queryClient.setQueryData(['me'], null)
    })
  }, [queryClient])

  const meQuery = useQuery({ queryKey: ['me'], queryFn: fetchMe, enabled: signedIn === true, staleTime: 60_000 })

  const loadMe = useCallback(
    () => queryClient.fetchQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: 0 }),
    [queryClient],
  )

  const signOut = useCallback(async () => {
    await authService.signOut()
    // Forget the old account now, without waiting for Supabase's sign-out event.
    setSignedIn(false)
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
    queryClient.setQueryData(['me'], null)
    forgetSavedCache() // the saved copy in this browser goes too
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      signedIn,
      me: meQuery.data ?? null,
      meLoading: signedIn === null || (signedIn && meQuery.isPending),
      loadMe,
      signOut,
    }),
    [signedIn, meQuery.data, meQuery.isPending, loadMe, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
