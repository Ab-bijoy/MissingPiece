interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** "true" runs the app against in-browser demo data instead of Supabase + FastAPI. */
  readonly VITE_USE_MOCKS?: string
  /** "true" turns log-in off for testing: each area opens as its demo account. */
  readonly VITE_SKIP_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
