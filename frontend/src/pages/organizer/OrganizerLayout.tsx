import { createContext, useContext, useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useParams } from 'react-router-dom'
import { useMyProjects, useThreads } from '../../api/organizer'
import AppHeader from '../../components/app/AppHeader'
import { Spinner } from '../../components/app/ui'

const LAST_KEY = 'mp-org-last-project'
const readLast = () => {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

type Ctx = { currentId: string | null; setCurrent: (id: string) => void }
const CurrentProject = createContext<Ctx>({ currentId: null, setCurrent: () => {} })
export const useCurrentProject = () => useContext(CurrentProject)

/**
 * Frame for /organizer/*. Remembers which project the organizer was last
 * looking at, so "Dashboard" and "Receive and complete" open that one.
 */
export default function OrganizerLayout() {
  const { data: projects } = useMyProjects()
  const { data: threads } = useThreads()
  const [last, setLast] = useState<string | null>(readLast)

  const valid = projects?.some((p) => p.id === last) ? last : null
  const fallback = projects?.find((p) => p.status === 'live')?.id ?? projects?.[0]?.id ?? null
  const currentId = valid ?? fallback

  const setCurrent = (id: string) => {
    setLast(id)
    try {
      localStorage.setItem(LAST_KEY, id)
    } catch {
      /* ignore */
    }
  }

  const unread = threads?.reduce((s, t) => s + t.unread, 0) ?? 0
  const base = currentId ? `/organizer/projects/${currentId}` : '/organizer'

  return (
    <CurrentProject.Provider value={{ currentId, setCurrent }}>
      <div className="min-h-svh bg-paper text-[17px] leading-normal text-ink">
        <AppHeader
          nav={[
            { to: base, label: 'Dashboard', end: true },
            { to: '/organizer/projects/new', label: 'New project' },
            { to: '/organizer/messages', label: 'Messages', badge: unread },
            { to: `${base}/complete`, label: 'Receive and complete', disabled: !currentId },
            { to: '/organizer/profile', label: 'Profile' },
          ]}
          profileTo="/organizer/profile"
        />
        <Outlet />
      </div>
    </CurrentProject.Provider>
  )
}

/** /organizer: opens the current project, or invites them to create one. */
export function OrganizerHome() {
  const { data: projects, isPending } = useMyProjects()
  const { currentId } = useCurrentProject()
  if (isPending) return <Spinner />
  if (currentId) return <Navigate to={`/organizer/projects/${currentId}`} replace />
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-8">
      <h1 className="text-[34px] font-bold">Welcome to MissingPiece</h1>
      <p className="mt-3 text-lg text-ink-soft">
        {projects?.length === 0 ? 'You have no projects yet.' : ''} Start with a template: we fill in the usual needs,
        and you change the numbers.
      </p>
      <Link
        to="/organizer/projects/new"
        className="mt-8 inline-flex min-h-14 items-center rounded-[10px] bg-accent px-6 text-lg font-bold text-white hover:bg-[#09443B]"
      >
        Create your first project
      </Link>
    </main>
  )
}

/** Keeps the layout's "current project" in sync with the project in the URL. */
export function useTrackProject() {
  const { id } = useParams()
  const { setCurrent } = useCurrentProject()
  useEffect(() => {
    if (id) setCurrent(id)
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  return id!
}
