import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ApiError } from './api/client'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'
import './index.css'
import { keepCacheSaved, restoreCache } from './lib/persistCache'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data counts as fresh for 30 s: going back to a page shows it at once
      // instead of reloading it. Actions still refresh what they change right away.
      staleTime: 30_000,
      // Retry once on network or server trouble; a 4xx answer will not change on retry.
      retry: (failures, error) => failures < 1 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
})

// Show the last data straight away (this account only), then keep saving it.
void restoreCache(queryClient).finally(() => {
  keepCacheSaved(queryClient)
  createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
})
