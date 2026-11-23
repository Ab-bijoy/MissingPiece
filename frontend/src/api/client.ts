import { authService } from '../auth/authService'
import { env } from '../lib/env'
import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  status: number
  code?: string
  constructor(status: number, body: ApiErrorBody) {
    super(body.detail)
    this.status = status
    this.code = body.code
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** JSON body */
  json?: unknown
  /** Multipart body (registration with a proof file) */
  form?: FormData
  query?: Record<string, string | number | undefined>
}

/**
 * The one typed API client (build prompt 9.4). Adds the Supabase access token
 * as a Bearer header, turns { detail, code } errors into ApiError, and signs
 * out on 401. `path` is relative to VITE_API_URL, which already ends in /api.
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const token = await authService.getAccessToken()
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    body = opts.form
  }

  const qs = opts.query
    ? '?' +
      new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : ''
  const url = `${env.apiUrl}${path}${qs}`
  const init: RequestInit = { method: opts.method ?? 'GET', headers, body }

  let res: Response
  try {
    // Demo data is only downloaded in demo mode
    res = env.useMocks ? await (await import('./mock/mockApi')).mockFetch(url, init) : await fetch(url, init)
  } catch {
    throw new ApiError(0, { detail: 'Could not reach MissingPiece. Check your connection and try again.' })
  }

  if (res.status === 401) {
    await authService.signOut()
  }
  if (!res.ok) {
    let errBody: ApiErrorBody = { detail: 'Something went wrong. Please try again.' }
    try {
      errBody = await res.json()
    } catch {
      /* keep the default message */
    }
    throw new ApiError(res.status, errBody)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
