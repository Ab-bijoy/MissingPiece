import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query'
import { authService } from '../auth/authService'

/**
 * Remember loaded data between visits, so reopening the app shows the last feed,
 * offers and so on at once while fresh data loads in the background.
 *
 * - Saved in this browser only (localStorage), tagged with the signed-in account.
 *   It is restored only for that same account and dropped after a day.
 * - Signing out deletes it (AuthProvider calls forgetSavedCache).
 * - Only data the server already sent this account; nothing is sent anywhere.
 */

const KEY = 'mp.cache.v1'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

/** The account a session belongs to: the token's subject (or the demo session id). */
function ownerOf(token: string | null): string | null {
  if (!token) return null
  if (token.startsWith('mock.')) return token.slice('mock.'.length)
  try {
    const part = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(part)) as { sub?: string }).sub ?? null
  } catch {
    return null
  }
}

/** Put the saved data back into the cache, if it belongs to whoever is signed in. */
export async function restoreCache(qc: QueryClient): Promise<void> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { owner: string; savedAt: number; state: unknown }
    const owner = ownerOf(await authService.getAccessToken())
    if (!owner || saved.owner !== owner || Date.now() - saved.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY)
      return
    }
    // The saved data counts as old, so every page still refreshes it on first use.
    hydrate(qc, saved.state as Parameters<typeof hydrate>[1])
  } catch {
    /* private window or broken data: start empty */
  }
}

/** Save the cache (at most once a second) while the app is open. Returns a stop function. */
export function keepCacheSaved(qc: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = async () => {
    timer = undefined
    const owner = ownerOf(await authService.getAccessToken())
    if (!owner) return // signed out: nothing to keep
    const state = dehydrate(qc, { shouldDehydrateQuery: (q) => q.state.status === 'success' })
    try {
      localStorage.setItem(KEY, JSON.stringify({ owner, savedAt: Date.now(), state }))
    } catch {
      /* storage full or blocked: not saved, nothing else breaks */
    }
  }
  return qc.getQueryCache().subscribe(() => {
    if (!timer) timer = setTimeout(() => void save(), 1000)
  })
}

export function forgetSavedCache(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
