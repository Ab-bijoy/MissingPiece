import { ArrowLeft, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, useAdminAction, useRegistration, useRegistrations } from '../../api/admin'
import type { OrganizerProfile, RegistrationDetail, RegistrationStatus, SponsorProfile } from '../../api/types'
import { Card, EmptyNote, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { timeAgo } from '../../lib/format'
import { safeHttpUrl } from '../../lib/safe'

const ORG_TYPE = { ngo: 'NGO', university: 'University club or office', community_group: 'Community group' }
const TABS: { key: RegistrationStatus; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

/**
 * Registration approvals (prototype "Admin · Registration approvals"):
 * organizers and sponsors can log in only after an admin approves them.
 */
export default function AdminApprovals() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('show') as RegistrationStatus | null) ?? 'pending'
  const selected = params.get('id')
  const { data: list, isPending } = useRegistrations(tab)
  const { data: pending } = useRegistrations('pending')

  useEffect(() => {
    if (!selected && list?.length && window.matchMedia('(min-width: 1024px)').matches)
      setParams({ show: tab, id: list[0].user_id }, { replace: true })
  }, [selected, list, tab, setParams])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-[34px] font-bold">Registration requests</h1>
      <p className="max-w-3xl text-ink-soft">
        Organizers and sponsors can log in only after you approve them. General users verify by email and need no approval.
      </p>

      <div role="group" aria-label="Show" className="mt-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setParams({ show: t.key })}
            className={`min-h-11 rounded-full px-4 text-[15px] font-bold ${
              tab === t.key ? 'bg-accent text-white' : 'border border-[#C9C3B6] bg-white hover:border-accent'
            }`}
          >
            {t.label}
            {t.key === 'pending' && pending ? ` (${pending.length})` : ''}
          </button>
        ))}
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside aria-label={`${tab} requests`} className={`rounded-[14px] border border-[#E2DED5] bg-white p-3 ${selected ? 'hidden lg:block' : ''}`}>
          {isPending ? (
            <Spinner />
          ) : !list?.length ? (
            <EmptyNote>{tab === 'pending' ? 'No requests are waiting. Nice work.' : `No ${tab} requests.`}</EmptyNote>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map((r) => (
                <li key={r.user_id}>
                  <button
                    type="button"
                    onClick={() => setParams({ show: tab, id: r.user_id })}
                    aria-current={r.user_id === selected ? 'true' : undefined}
                    className={`w-full rounded-xl px-3 py-3 text-left ${r.user_id === selected ? 'bg-[#E6F1EE]' : 'hover:bg-paper'}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-bold">{r.name}</span>
                      <span className="shrink-0 rounded-full bg-[#EFEDE8] px-2 py-0.5 text-xs font-bold">
                        {r.role === 'organizer' ? 'Organizer' : 'Sponsor'}
                      </span>
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {r.kind} · sent {timeAgo(r.sent_at).toLowerCase()}
                    </span>
                    {r.reviewed_by_name && (
                      <span className="block text-sm text-ink-soft">
                        {r.status === 'rejected' ? 'Rejected' : 'Approved'} by {r.reviewed_by_name}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {selected ? (
          <Detail key={selected} id={selected} onBack={() => setParams({ show: tab })} />
        ) : (
          <section className="hidden min-h-80 items-center justify-center rounded-[14px] border border-[#E2DED5] bg-white text-ink-soft lg:flex">
            Choose a request.
          </section>
        )}
      </div>
    </main>
  )
}

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: r, isPending } = useRegistration(id)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [fileMsg, setFileMsg] = useState<string | null>(null)
  const decide = useAdminAction(({ approve }: { approve: boolean }) => (approve ? adminApi.approve(id) : adminApi.reject(id, note.trim())))

  if (isPending || !r) return <Spinner />

  const reject = () => {
    if (!note.trim()) {
      setNoteError('Write a note first. The applicant sees it in their email.')
      return
    }
    setNoteError(null)
    decide.mutate({ approve: false })
  }

  async function openFile(docId: string) {
    setFileMsg(null)
    try {
      const { url } = await adminApi.fileLink(docId)
      const safe = safeHttpUrl(url)
      if (safe) window.open(safe, '_blank', 'noopener,noreferrer')
      else setFileMsg('Demo mode keeps no file contents. With the real back end this opens a short-lived download link.')
    } catch (e) {
      setFileMsg(e instanceof Error ? e.message : 'Could not open the file.')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 w-fit items-center gap-1.5 font-bold text-accent lg:hidden">
        <ArrowLeft className="size-5" aria-hidden /> All requests
      </button>
      <Card>
        <p className="text-[15px] text-ink-soft">{r.role === 'organizer' ? 'Organizer request' : 'Sponsor request'}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[28px] font-bold">{r.name}</h2>
          {statusPill(r)}
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-[200px_1fr]">
          {fields(r).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="font-bold break-words">{v}</dd>
            </div>
          ))}
        </dl>

        <h3 className="mt-6 font-bold">Documents</h3>
        {r.documents.length === 0 ? (
          <p className="mt-2 text-ink-soft">No documents uploaded.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {r.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2DED5] px-4 py-3">
                <span className="flex items-center gap-2">
                  <FileText className="size-5 text-accent" aria-hidden />
                  <span>
                    <span className="block font-bold">{d.file_name}</span>
                    <span className="text-sm text-ink-soft">
                      {d.kind === 'trade_license' ? 'Trade licence' : 'Registration proof'} · {(d.size_bytes / 1024).toFixed(0)} KB
                    </span>
                  </span>
                </span>
                <button type="button" className={smallBtn.secondary} onClick={() => openFile(d.id)}>
                  Open<span className="sr-only"> {d.file_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {fileMsg && (
          <div className="mt-2">
            <Notice tone="info">{fileMsg}</Notice>
          </div>
        )}

        {r.status === 'pending_approval' ? (
          <div className="mt-6 flex flex-col gap-3">
            <label htmlFor="note" className="font-bold">
              Note to the applicant <span className="font-normal text-ink-soft">· required if you reject</span>
            </label>
            <textarea
              id="note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={noteError ? true : undefined}
              placeholder="For example: the registration number does not match the certificate."
              className="w-full rounded-[10px] border border-[#C9C3B6] px-3.5 py-2.5"
            />
            {noteError && <p className="font-bold text-warning">{noteError}</p>}
            {decide.isError && <Notice tone="error">{decide.error instanceof Error ? decide.error.message : 'Could not save.'}</Notice>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={`${smallBtn.primary} min-h-12 px-6`} disabled={decide.isPending} onClick={() => decide.mutate({ approve: true })}>
                Approve
              </button>
              <button type="button" className={`${smallBtn.secondary} min-h-12 px-6`} disabled={decide.isPending} onClick={reject}>
                Reject
              </button>
            </div>
            <p className="text-[15px] text-ink-soft">The applicant gets an email either way.</p>
          </div>
        ) : (
          <div className="mt-6">
            <Notice tone={r.status === 'rejected' ? 'warning' : 'success'}>
              {r.status === 'rejected' ? 'Rejected' : 'Approved'}
              {r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ''}
              {r.reviewed_at ? ` on ${whenText(r.reviewed_at)}` : ''}.{' '}
              {r.status === 'rejected' ? `Note sent: “${r.rejection_note ?? ''}”` : 'They can log in.'}
            </Notice>
          </div>
        )}
      </Card>
    </div>
  )
}

/** "23 Nov 2026, 14:05" in Bangladesh time */
function whenText(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' })
}

function statusPill(r: RegistrationDetail) {
  if (r.status === 'pending_approval') return <Pill tone="open">Pending</Pill>
  if (r.status === 'rejected') return <Pill tone="conflict">Rejected</Pill>
  if (r.status === 'suspended') return <Pill tone="neutral">Suspended</Pill>
  return <Pill tone="received">Approved</Pill>
}

function fields(r: RegistrationDetail): [string, string][] {
  const sent: [string, string] = ['Sent', new Date(r.sent_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Dhaka' })]
  if (r.role === 'organizer') {
    const p = r.profile as OrganizerProfile
    return [
      ['Organization type', ORG_TYPE[p.org_type]],
      ['Registration number', p.registration_number],
      ['Contact person', p.contact_person],
      ['Phone', p.phone],
      ['Work email', r.email],
      sent,
    ]
  }
  const p = r.profile as SponsorProfile
  return [
    ['Industry', p.industry],
    ['Trade licence number', p.trade_license_number],
    ['Contact person', p.contact_person],
    ['Phone', p.phone],
    ['Work email', r.email],
    sent,
  ]
}
