import { Building2, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useSponsorPublicProfile } from '../../api/organizer'
import { Modal, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { formatDate, NEED_TYPE_LABEL } from '../../lib/format'

/**
 * A sponsor's public profile in a modal: what they do, where, what they like to
 * support, and how much they have delivered on MissingPiece. Never their contact
 * person, phone or email: organizers reach sponsors through Messages.
 */
export default function SponsorProfileModal({ sponsorId, onClose }: { sponsorId: string | null; onClose: () => void }) {
  const { data: s, isPending, isError } = useSponsorPublicProfile(sponsorId)
  return (
    <Modal open={!!sponsorId} onClose={onClose} title={s?.name ?? 'Sponsor profile'}>
      {isPending ? (
        <Spinner />
      ) : isError || !s ? (
        <Notice tone="error">Could not load this sponsor's profile.</Notice>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-ink-soft">
            {s.industry && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4" aria-hidden /> {s.industry}
              </span>
            )}
            {s.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {s.location}
              </span>
            )}
            <span>On MissingPiece since {formatDate(s.member_since.slice(0, 10))}</span>
          </p>

          {s.description && <p>{s.description}</p>}

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-paper px-3.5 py-3">
              <dt className="text-sm text-ink-soft">Contributions delivered</dt>
              <dd className="text-xl font-bold">{s.contributions_received}</dd>
            </div>
            <div className="rounded-xl bg-paper px-3.5 py-3">
              <dt className="text-sm text-ink-soft">Projects supported</dt>
              <dd className="text-xl font-bold">{s.projects_supported}</dd>
            </div>
          </dl>

          {s.interests.length > 0 && (
            <div>
              <h3 className="font-bold">Interested in</h3>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {s.interests.map((i) => (
                  <li key={i} className="rounded-full bg-[#E6F1EE] px-3 py-1 text-sm font-semibold text-accent">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.preferred_types.length > 0 && (
            <div>
              <h3 className="font-bold">Likes to give</h3>
              <p className="mt-1 text-[15px]">{s.preferred_types.map((t) => NEED_TYPE_LABEL[t] ?? t).join(', ')}</p>
            </div>
          )}
          <p className="text-sm text-ink-soft">
            Contact details stay private. Send a request to start a conversation with this sponsor.
          </p>
          <div className="flex justify-end">
            <button type="button" className={smallBtn.secondary} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/** "View profile" link + its modal, for any place that names a sponsor. */
export function SponsorProfileLink({ sponsorId, name }: { sponsorId: string; name: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-left font-bold text-accent underline underline-offset-2">
        {name}
        <span className="sr-only"> (view profile)</span>
      </button>
      <SponsorProfileModal sponsorId={open ? sponsorId : null} onClose={() => setOpen(false)} />
    </>
  )
}
