import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { CommentPostResult } from './user'
import type {
  AppNotification,
  Benefit,
  Comment,
  CommentKind,
  Gaps,
  Message,
  Need,
  NeedInput,
  OfferList,
  Project,
  ProjectInput,
  ProjectReport,
  ProjectSummary,
  ProjectMember,
  Readiness,
  RequestInput,
  SentRequest,
  SponsorPublicProfile,
  SponsorSearchResult,
  SponsorMatchList,
  Template,
  Thread,
} from './types'

// Every organizer call from build prompt 7.3, plus the shared ones from 7.6
// that organizer screens use. Paths are relative to VITE_API_URL (…/api).

export const organizerApi = {
  templates: () => api<Template[]>('/templates'),
  createProject: (body: ProjectInput) => api<Project>('/projects', { method: 'POST', json: body }),
  myProjects: () => api<ProjectSummary[]>('/projects/mine'),
  project: (id: string) => api<Project>(`/projects/${id}`),
  updateProject: (id: string, body: Partial<Omit<ProjectInput, 'needs'>>) =>
    api<Project>(`/projects/${id}`, { method: 'PATCH', json: body }),
  publish: (id: string) => api<Project>(`/projects/${id}/publish`, { method: 'POST' }),
  complete: (id: string) => api<Project>(`/projects/${id}/complete`, { method: 'POST' }),
  gaps: (id: string) => api<Gaps>(`/projects/${id}/gaps`),
  readiness: (id: string) => api<Readiness>(`/projects/${id}/readiness`),

  addNeed: (projectId: string, body: NeedInput) => api<Need>(`/projects/${projectId}/needs`, { method: 'POST', json: body }),
  updateNeed: (id: string, body: Partial<NeedInput>) => api<Need>(`/needs/${id}`, { method: 'PATCH', json: body }),
  deleteNeed: (id: string) => api<void>(`/needs/${id}`, { method: 'DELETE' }),

  generateMatches: (projectId: string) =>
    api<SponsorMatchList>(`/projects/${projectId}/sponsor-matches`, { method: 'POST' }),
  matches: (projectId: string) => api<SponsorMatchList>(`/projects/${projectId}/sponsor-matches`),
  sponsorProfile: (sponsorId: string) => api<SponsorPublicProfile>(`/sponsors/${sponsorId}`),
  sentRequests: (projectId: string) => api<SentRequest[]>(`/projects/${projectId}/requests`),
  searchSponsors: (projectId: string, q: string) =>
    api<SponsorSearchResult[]>('/sponsors/search', { query: { project_id: projectId, q } }),
  dismissMatch: (id: string) => api<void>(`/sponsor-matches/${id}/dismiss`, { method: 'POST' }),
  sendRequest: (projectId: string, body: RequestInput) =>
    api<{ id: string; thread_id: string }>(`/projects/${projectId}/requests`, { method: 'POST', json: body }),

  offers: (projectId: string) => api<OfferList>(`/projects/${projectId}/offers`),
  acceptOffer: (id: string) => api<void>(`/offers/${id}/accept`, { method: 'POST' }),
  declineOffer: (id: string) => api<void>(`/offers/${id}/decline`, { method: 'POST' }),
  receiveOffer: (id: string) => api<void>(`/offers/${id}/receive`, { method: 'POST' }),

  approveMembership: (id: string) => api<void>(`/memberships/${id}/approve`, { method: 'POST' }),
  memberships: (id: string) => api<ProjectMember[]>(`/projects/${id}/memberships`),
  rejectMembership: (id: string) => api<void>(`/memberships/${id}/reject`, { method: 'POST' }),

  setBenefit: (id: string, given: boolean) => api<Benefit>(`/benefits/${id}`, { method: 'PATCH', json: { given } }),
  hideComment: (id: string) => api<void>(`/comments/${id}/hide`, { method: 'POST' }),
  report: (projectId: string) => api<ProjectReport>(`/projects/${projectId}/report`),

  // Shared (7.6)
  comments: (projectId: string) => api<Comment[]>(`/events/${projectId}/comments`),
  postComment: (projectId: string, body: { kind: CommentKind; body: string; parent_id: string | null }) =>
    api<CommentPostResult>(`/events/${projectId}/comments`, { method: 'POST', json: body }),
  threads: () => api<Thread[]>('/threads'),
  messages: (threadId: string) => api<Message[]>(`/threads/${threadId}/messages`),
  sendMessage: (threadId: string, body: string) =>
    api<Message | { id: string; status: 'hidden' }>(`/threads/${threadId}/messages`, { method: 'POST', json: { body } }),
  notifications: () => api<AppNotification[]>('/notifications'),
  readNotification: (id: string) => api<void>(`/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => api<void>('/notifications/read-all', { method: 'POST' }),
}

// ---- Query keys and hooks -------------------------------------------------

export const qk = {
  templates: ['templates'] as const,
  myProjects: ['projects', 'mine'] as const,
  project: (id: string) => ['project', id] as const,
  gaps: (id: string) => ['project', id, 'gaps'] as const,
  readiness: (id: string) => ['project', id, 'readiness'] as const,
  matches: (id: string) => ['project', id, 'matches'] as const,
  offers: (id: string) => ['project', id, 'offers'] as const,
  memberships: (id: string) => ['project', id, 'memberships'] as const,
  comments: (id: string) => ['project', id, 'comments'] as const,
  report: (id: string) => ['project', id, 'report'] as const,
  requests: (id: string) => ['project', id, 'requests'] as const,
  sponsor: (id: string) => ['sponsor-profile', id] as const,
  sponsorSearch: (id: string, q: string) => ['project', id, 'sponsor-search', q] as const,
  threads: ['threads'] as const,
  messages: (id: string) => ['threads', id, 'messages'] as const,
  notifications: ['notifications'] as const,
}

export const useTemplates = () => useQuery({ queryKey: qk.templates, queryFn: organizerApi.templates })
export const useMyProjects = () => useQuery({ queryKey: qk.myProjects, queryFn: organizerApi.myProjects })
export const useProject = (id: string) => useQuery({ queryKey: qk.project(id), queryFn: () => organizerApi.project(id) })
export const useGaps = (id: string) => useQuery({ queryKey: qk.gaps(id), queryFn: () => organizerApi.gaps(id) })
export const useReadiness = (id: string) =>
  useQuery({ queryKey: qk.readiness(id), queryFn: () => organizerApi.readiness(id) })
export const useMatches = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.matches(id), queryFn: () => organizerApi.matches(id), enabled })
export const useOffers = (id: string) => useQuery({ queryKey: qk.offers(id), queryFn: () => organizerApi.offers(id) })
export const useProjectMemberships = (id: string) => useQuery({ queryKey: qk.memberships(id), queryFn: () => organizerApi.memberships(id), refetchInterval: 30_000 })
export const useComments = (id: string) =>
  useQuery({ queryKey: qk.comments(id), queryFn: () => organizerApi.comments(id) })
export const useSponsorPublicProfile = (id: string | null) =>
  useQuery({ queryKey: qk.sponsor(id ?? ''), queryFn: () => organizerApi.sponsorProfile(id!), enabled: !!id, staleTime: 5 * 60_000 })

/** Requests already sent (refreshed by every project action, e.g. sending one) */
export const useSentRequests = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.requests(id), queryFn: () => organizerApi.sentRequests(id), enabled })
/** Sponsors on the platform; `q` is matched against company, industry, location and interests */
export const useSponsorSearch = (id: string, q: string, enabled = true) =>
  useQuery({
    queryKey: qk.sponsorSearch(id, q),
    queryFn: () => organizerApi.searchSponsors(id, q),
    enabled,
    placeholderData: (previous) => previous, // keep the old results on screen while typing
  })
export const useReport = (id: string) => useQuery({ queryKey: qk.report(id), queryFn: () => organizerApi.report(id) })
export const useThreads = () =>
  useQuery({ queryKey: qk.threads, queryFn: organizerApi.threads, refetchInterval: 30_000 })
export const useMessages = (threadId: string | null) =>
  useQuery({
    queryKey: qk.messages(threadId ?? ''),
    queryFn: () => organizerApi.messages(threadId!),
    enabled: !!threadId,
    refetchInterval: 15_000,
  })
/** The bell polls every 30 seconds (build prompt 9.4). */
export const useNotifications = () =>
  useQuery({ queryKey: qk.notifications, queryFn: organizerApi.notifications, refetchInterval: 30_000 })

/**
 * Runs an organizer action, then refreshes everything about that project
 * (needs, gaps, readiness, offers, matches, comments, report) plus the
 * project list, threads and notifications that the action may have changed.
 */
export function useProjectAction<TVars>(projectId: string, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['project', projectId] })
      void qc.invalidateQueries({ queryKey: qk.myProjects })
      void qc.invalidateQueries({ queryKey: qk.threads })
      void qc.invalidateQueries({ queryKey: qk.notifications })
      void qc.invalidateQueries({ queryKey: ['user', 'memberships'] })
      void qc.invalidateQueries({ queryKey: ['user', 'feed'] })
      void qc.invalidateQueries({ queryKey: ['user', 'program', projectId] })
    },
  })
}
