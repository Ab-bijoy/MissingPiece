import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { qk as sharedQk } from './organizer'
import type { Comment, CommentKind, FeedItem, JoinInput, MyContribution, MyProfile, OrganizerProfileView, ProgramDetail } from './types'

// General user calls from build prompt 7.5, plus comments (7.6).
// Organizer profile (GET/PATCH /organizer/profile) is not in the prompt yet.

export const userApi = {
  feed: () => api<FeedItem[]>('/feed'),
  program: (id: string) => api<ProgramDetail>(`/events/${id}`),
  join: (id: string, body: JoinInput) => api<void>(`/events/${id}/join`, { method: 'POST', json: body }),
  myMemberships: () => api<MyContribution[]>('/me/memberships'),
  withdraw: (offerId: string) => api<void>(`/offers/${offerId}/withdraw`, { method: 'POST' }),
  profile: () => api<MyProfile>('/me/profile'),
  saveProfile: (body: Partial<MyProfile>) => api<MyProfile>('/me/profile', { method: 'PATCH', json: body }),
  comments: (id: string) => api<Comment[]>(`/events/${id}/comments`),
  postComment: (id: string, body: { kind: CommentKind; body: string; parent_id: string | null }) =>
    api<Comment>(`/events/${id}/comments`, { method: 'POST', json: body }),
  orgProfile: () => api<OrganizerProfileView>('/organizer/profile'),
  saveOrgProfile: (body: Partial<OrganizerProfileView>) =>
    api<OrganizerProfileView>('/organizer/profile', { method: 'PATCH', json: body }),
}

export const uqk = {
  feed: ['user', 'feed'] as const,
  program: (id: string) => ['user', 'program', id] as const,
  comments: (id: string) => ['user', 'program', id, 'comments'] as const,
  memberships: ['user', 'memberships'] as const,
  profile: ['user', 'profile'] as const,
  orgProfile: ['organizer', 'profile'] as const,
}

export const useFeed = () => useQuery({ queryKey: uqk.feed, queryFn: userApi.feed })
export const useProgram = (id: string) => useQuery({ queryKey: uqk.program(id), queryFn: () => userApi.program(id) })
export const useProgramComments = (id: string) =>
  useQuery({ queryKey: uqk.comments(id), queryFn: () => userApi.comments(id) })
export const useMyContributions = () => useQuery({ queryKey: uqk.memberships, queryFn: userApi.myMemberships })
export const useMyProfile = () => useQuery({ queryKey: uqk.profile, queryFn: userApi.profile })
export const useOrgProfile = () => useQuery({ queryKey: uqk.orgProfile, queryFn: userApi.orgProfile })

/** Runs a general-user action, then refreshes the feed, programs, contributions and notifications. */
export function useUserAction<TVars, TOut = unknown>(fn: (vars: TVars) => Promise<TOut>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['user'] })
      void qc.invalidateQueries({ queryKey: ['me'] })
      void qc.invalidateQueries({ queryKey: sharedQk.notifications })
    },
  })
}
