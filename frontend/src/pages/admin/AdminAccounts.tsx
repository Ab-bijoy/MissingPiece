import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { adminApi, useAdminAction, useAdminUsers } from '../../api/admin'
import type { AdminUser, UserRole } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { ROLE_LABEL } from '../../auth/roles'
import { Card, EmptyNote, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { formatDate } from '../../lib/format'

const FILTERS: { key: UserRole | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'organizer', label: 'Organizers' },
  { key: 'sponsor', label: 'Sponsors' },
  { key: 'general', label: 'General users' },
  { key: 'admin', label: 'Admins' },
]

/** Accounts (prototype "Admin · Accounts"): suspend, verify, delete demo accounts. */
export default function AdminAccounts() {
  const { data: users, isPending } = useAdminUsers()
  const { me } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const act = useAdminAction(async ({ id, op }: { id: string; op: 'suspend' | 'reactivate' | 'verify' | 'delete' }) => {
    if (op === 'delete') await adminApi.deleteUser(id)
    else await adminApi.updateUser(id, op === 'verify' ? { verified: true } : { status: op === 'suspend' ? 'suspended' : 'active' })
  })

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (users ?? []).filter((u) => (role === 'all' || u.role === role) && (!t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)))
  }, [users, q, role])

  const run = (u: AdminUser, op: 'suspend' | 'reactivate' | 'verify' | 'delete') => {
    const ask = {
      suspend: `Suspend ${u.name}? They will not be able to use MissingPiece until you reactivate them.`,
      reactivate: `Reactivate ${u.name}?`,
      verify: `Mark ${u.name} as verified?`,
      delete: `Delete the demo account ${u.name}? This cannot be undone.`,
    }[op]
    if (confirm(ask)) act.mutate({ id: u.id, op })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-[34px] font-bold">Accounts</h1>
      <div className="mt-5 flex flex-col gap-4">
        <label className="relative block max-w-xl">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-ink-soft" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" className="min-h-13 w-full rounded-[10px] border border-[#C9C3B6] bg-white pr-3.5 pl-11" />
        </label>
        <div role="group" aria-label="Filter by role" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={role === f.key}
              onClick={() => setRole(f.key)}
              className={`min-h-11 rounded-full px-4 text-[15px] font-bold ${role === f.key ? 'bg-accent text-white' : 'border border-[#C9C3B6] bg-white hover:border-accent'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {act.isError && (
        <div className="mt-4">
          <Notice tone="error">{act.error instanceof Error ? act.error.message : 'Could not save.'}</Notice>
        </div>
      )}

      <Card className="mt-6">
        {isPending ? (
          <Spinner />
        ) : shown.length === 0 ? (
          <EmptyNote>No accounts match.</EmptyNote>
        ) : (
          <div className="relative -mx-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[15px]">
              <thead>
                <tr className="text-sm text-ink-soft">
                  <th className="px-2 pb-2 font-bold">Name</th>
                  <th className="px-2 pb-2 font-bold">Role</th>
                  <th className="px-2 pb-2 font-bold">Status</th>
                  <th className="px-2 pb-2 font-bold">Verified</th>
                  <th className="px-2 pb-2 font-bold">Joined</th>
                  <th className="px-2 pb-2 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id} className="border-t border-[#F0EDE6]">
                    <td className="px-2 py-3">
                      <div className="font-bold">{u.name}</div>
                      <div className="text-sm text-ink-soft">{u.email}</div>
                    </td>
                    <td className="px-2 py-3">{ROLE_LABEL[u.role]}</td>
                    <td className="px-2 py-3">{statusPill(u)}</td>
                    <td className="px-2 py-3">{verifiedText(u)}</td>
                    <td className="px-2 py-3">{formatDate(u.created_at)}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        {u.is_demo && (
                          <button type="button" className={smallBtn.secondary} onClick={() => run(u, 'delete')} disabled={act.isPending}>
                            Delete<span className="sr-only"> {u.name}</span>
                          </button>
                        )}
                        {!u.is_demo && !u.verified && (u.role === 'organizer' || u.role === 'sponsor') && (
                          <button type="button" className={smallBtn.secondary} onClick={() => run(u, 'verify')} disabled={act.isPending}>
                            Verify<span className="sr-only"> {u.name}</span>
                          </button>
                        )}
                        {u.id !== me?.id && u.status === 'active' && (
                          <button type="button" className={smallBtn.secondary} onClick={() => run(u, 'suspend')} disabled={act.isPending}>
                            Suspend<span className="sr-only"> {u.name}</span>
                          </button>
                        )}
                        {u.status === 'suspended' && (
                          <button type="button" className={smallBtn.primary} onClick={() => run(u, 'reactivate')} disabled={act.isPending}>
                            Reactivate<span className="sr-only"> {u.name}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </main>
  )
}

function statusPill(u: AdminUser) {
  switch (u.status) {
    case 'active':
      return <Pill tone="received">Active</Pill>
    case 'pending_approval':
      return <Pill tone="open">Waiting for approval</Pill>
    case 'rejected':
      return <Pill tone="conflict">Rejected</Pill>
    default:
      return <Pill tone="neutral">Suspended</Pill>
  }
}

function verifiedText(u: AdminUser) {
  if (u.is_demo) return <span className="text-ink-soft">Demo account, never verified</span>
  if (u.role === 'general' || u.role === 'admin') return <span className="text-ink-soft">Not needed</span>
  return u.verified ? <span className="font-bold text-accent">Verified</span> : <span className="font-bold text-warning">Not verified</span>
}
