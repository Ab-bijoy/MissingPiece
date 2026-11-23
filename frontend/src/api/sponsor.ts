import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { qk as sharedQk } from './organizer'
import type {
  EventDetail,
  EventSummary,
  Offer,
  OfferInput,
  PaymentQuote,
  PaymentStart,
  SponsorOfferRow,
  SponsorProfile,
  SponsorReport,
  SponsorRequestDetail,
  SponsorRequestSummary,
} from './types'

// Every sponsor call from build prompt 7.4. Messages and notifications use
// the shared calls in organizer.ts (7.6).

export const sponsorApi = {
  requests: () => api<SponsorRequestSummary[]>('/sponsor/requests'),
  request: (id: string) => api<SponsorRequestDetail>(`/requests/${id}`),
  makeOffer: (requestId: string, body: OfferInput) =>
    api<Offer>(`/requests/${requestId}/offers`, { method: 'POST', json: body }),
  offers: () => api<SponsorOfferRow[]>('/sponsor/offers'),
  withdraw: (offerId: string) => api<void>(`/offers/${offerId}/withdraw`, { method: 'POST' }),
  quote: (offerId: string) => api<PaymentQuote>(`/offers/${offerId}/payment-quote`),
  pay: (offerId: string, method: string) =>
    api<PaymentStart>(`/offers/${offerId}/payments`, { method: 'POST', json: { method } }),
  report: (projectId: string) => api<SponsorReport>(`/sponsor/reports/${projectId}`),
  profile: () => api<SponsorProfile>('/sponsor/profile'),
  saveProfile: (body: Partial<SponsorProfile>) => api<SponsorProfile>('/sponsor/profile', { method: 'PATCH', json: body }),
  events: () => api<EventSummary[]>('/events'),
  event: (id: string) => api<EventDetail>(`/events/${id}`),
}

export const sqk = {
  requests: ['sponsor', 'requests'] as const,
  request: (id: string) => ['sponsor', 'request', id] as const,
  offers: ['sponsor', 'offers'] as const,
  quote: (id: string) => ['sponsor', 'quote', id] as const,
  report: (id: string) => ['sponsor', 'report', id] as const,
  profile: ['sponsor', 'profile'] as const,
  events: ['events'] as const,
  event: (id: string) => ['events', id] as const,
}

export const useSponsorRequests = () => useQuery({ queryKey: sqk.requests, queryFn: sponsorApi.requests, refetchInterval: 30_000 })
export const useSponsorRequest = (id: string | null) =>
  useQuery({ queryKey: sqk.request(id ?? ''), queryFn: () => sponsorApi.request(id!), enabled: !!id })
export const useSponsorOffers = () => useQuery({ queryKey: sqk.offers, queryFn: sponsorApi.offers })
export const usePaymentQuote = (offerId: string) =>
  useQuery({ queryKey: sqk.quote(offerId), queryFn: () => sponsorApi.quote(offerId) })
export const useSponsorReport = (projectId: string) =>
  useQuery({ queryKey: sqk.report(projectId), queryFn: () => sponsorApi.report(projectId), retry: false })
export const useSponsorProfile = () => useQuery({ queryKey: sqk.profile, queryFn: sponsorApi.profile })
export const useEvents = () => useQuery({ queryKey: sqk.events, queryFn: sponsorApi.events })
export const useEvent = (id: string | null) =>
  useQuery({ queryKey: sqk.event(id ?? ''), queryFn: () => sponsorApi.event(id!), enabled: !!id })

/** Runs a sponsor action, then refreshes the inbox, offers and notifications. */
export function useSponsorAction<TVars, TOut = unknown>(fn: (vars: TVars) => Promise<TOut>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['sponsor'] })
      void qc.invalidateQueries({ queryKey: sqk.events })
      void qc.invalidateQueries({ queryKey: sharedQk.threads })
      void qc.invalidateQueries({ queryKey: sharedQk.notifications })
    },
  })
}
