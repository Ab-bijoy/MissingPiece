import { useMutation, useQuery, useQueryClient, type InvalidateQueryFilters, type QueryClient } from '@tanstack/react-query'
import { api } from './client'
import { acceptsApplications, useDhakaToday } from '../lib/programDates'
import type { Comment, CommentKind, FeedItem, JoinInput, MyContribution, MyProfile, OrganizerProfileView, ProgramDetail } from './types'

// General user calls from build prompt 7.5, plus comments (7.6).
// Organizer profile (GET/PATCH /organizer/profile) is not in the prompt yet.

export const userApi = {
  feed: () => api<FeedItem[]>('/feed'),
  program: (id: string) => api<ProgramDetail>(`/events/${id}`),
  join: (id: string, body: JoinInput) => api<void>(`/events/${id}/join`, { method: 'POST', json: body }),
  leave: (id: string) => api<void>(`/events/${id}/leave`, { method: 'POST' }),
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

export const useFeed = () => {
  const today = useDhakaToday()
  return useQuery({
    queryKey: uqk.feed,
    queryFn: userApi.feed,
    // Cached pages also stop advertising programs when Dhaka rolls into a new day.
    select: (items) => items.filter((p) => acceptsApplications(p, today)),
  })
}
export const useProgram = (id: string) => useQuery({ queryKey: uqk.program(id), queryFn: () => userApi.program(id) })
export const useProgramComments = (id: string) =>
  useQuery({ queryKey: uqk.comments(id), queryFn: () => userApi.comments(id) })
export const useMyContributions = () => useQuery({ queryKey: uqk.memberships, queryFn: userApi.myMemberships })
export const useMyProfile = () => useQuery({ queryKey: uqk.profile, queryFn: userApi.profile })
export const useOrgProfile = () => useQuery({ queryKey: uqk.orgProfile, queryFn: userApi.orgProfile })

/**
 * What each action changes, so only that is fetched again (each reload is a
 * round trip to the server). `exact` keeps a program's comments from reloading
 * when only the program changed. Pages not on screen are just marked stale.
 */
const programOnly = (id: string): InvalidateQueryFilters => ({ queryKey: uqk.program(id), exact: true })
const anyProgram: InvalidateQueryFilters = {
  predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[1] === 'program' && q.queryKey.length === 3,
}

export const refreshAfter = {
  /** Seats, "you joined" and My contributions change */
  join: (programId: string) => [programOnly(programId), { queryKey: uqk.feed }, { queryKey: uqk.memberships }],
  /** My contributions and that program's membership change (program id not known here) */
  withdraw: () => [{ queryKey: uqk.memberships }, { queryKey: uqk.feed }, anyProgram],
  /** Comment counts and feed previews change; the comment list is updated directly (see addComment) */
  comment: (programId: string) => [programOnly(programId), { queryKey: uqk.feed }],
  /** The name in the header comes from /auth/me */
  profile: () => [{ queryKey: ['me'] }],
}

/** Put a new comment into the program's comment list straight away, without reloading it. */
export function addComment(qc: QueryClient, programId: string, c: Comment) {
  qc.setQueryData<Comment[]>(uqk.comments(programId), (old) => (old ? [...old, c] : old))
}

/** Put saved profile details into the cache, without reloading the profile. */
export function setProfile(qc: QueryClient, profile: MyProfile) {
  qc.setQueryData(uqk.profile, profile)
}

/**
 * Runs a general-user action. `refresh` says which data it changed; `onData` can
 * write the server's answer into the cache so it shows at once.
 */
export function useUserAction<TVars, TOut = unknown>(
  fn: (vars: TVars) => Promise<TOut>,
  refresh: (vars: TVars) => InvalidateQueryFilters[],
  onData?: (qc: QueryClient, result: TOut, vars: TVars) => void,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, vars) => onData?.(qc, result, vars),
    onSettled: (_result, _error, vars) => {
      for (const filters of refresh(vars)) void qc.invalidateQueries(filters)
    },
  })
}
