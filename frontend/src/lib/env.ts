const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * Testing switch: no log-in needed. Opening an area signs you in as that
 * role's demo account, and a bar at the bottom lets you jump between areas.
 * Only works with demo data (there is no real token to send to FastAPI).
 */
const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true'

export const env = {
  apiUrl: (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, ''),
  supabaseUrl,
  supabaseAnonKey,
  skipAuth,
  /**
   * Demo mode: auth and API calls are answered in the browser with seed-like
   * data, so screens work before the backend and Supabase are set up.
   * On when VITE_USE_MOCKS=true, when log-in is skipped, or when Supabase is not configured.
   */
  useMocks: skipAuth || import.meta.env.VITE_USE_MOCKS === 'true' || !supabaseUrl || !supabaseAnonKey,
}
