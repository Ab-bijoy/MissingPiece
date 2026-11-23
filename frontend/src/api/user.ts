import { useMutation, useQuery, useQueryClient, type InvalidateQueryFilters, type QueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Comment, CommentKind, FeedItem, JoinInput, MyContribution, MyMembership, MyProfile, OrganizerProfileView, ProgramDetail } from './types'

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

/**
 * Start loading a page when the pointer rests on (or a keyboard focuses) a link to it,
 * so it is usually ready by the time it is clicked. Spread the result on the link.
 */
export function usePrefetchProgram() {
  const qc = useQueryClient()
  return (id: string) => {
    const load = () => void qc.prefetchQuery({ queryKey: uqk.program(id), queryFn: () => userApi.program(id), staleTime: 30_000 })
    return { onMouseEnter: load, onFocus: load, onTouchStart: load }
  }
}

export const useFeed = () => useQuery({ queryKey: uqk.feed, queryFn: userApi.feed })
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

/**
 * Show "Attending" straight away after Join, with one more participant and one seat
 * fewer. If the server refuses (full, closed), the refresh that follows every action
 * puts the true numbers back and the page shows the server's message.
 */
export function joinAtOnce(qc: QueryClient, programId: string) {
  const joined = <T extends { my_membership: MyMembership; participants: number; seats_left: number }>(p: T): T =>
    p.my_membership
      ? p
      : {
          ...p,
          my_membership: { id: 'pending', role: 'participant', status: 'approved' },
          participants: p.participants + 1,
          seats_left: Math.max(0, p.seats_left - 1),
        }
  qc.setQueryData<ProgramDetail>(uqk.program(programId), (p) => (p ? joined(p) : p))
  qc.setQueryData<FeedItem[]>(uqk.feed, (list) => list?.map((f) => (f.id === programId ? joined(f) : f)))
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
  /** Change the screen before the server answers (see joinAtOnce) */
  atOnce?: (qc: QueryClient, vars: TVars) => void,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onMutate: (vars) => {
      if (!atOnce) return
      // Loads already under way are cancelled so their (older) answers are thrown away.
      // Not awaited: a request already sent cannot be stopped, and waiting for it would
      // delay the instant change by a whole round trip.
      void qc.cancelQueries({ queryKey: ['user'] })
      atOnce(qc, vars)
    },
    onSuccess: (result, vars) => onData?.(qc, result, vars),
    onSettled: (_result, _error, vars) => {
      for (const filters of refresh(vars)) void qc.invalidateQueries(filters)
    },
  })
}
