import { Outlet } from 'react-router-dom'
import { useSponsorRequests } from '../../api/sponsor'
import type { RequestState } from '../../api/types'
import AppHeader from '../../components/app/AppHeader'

/** Frame for /sponsor/* (prototype nav: Requests, Browse events, My offers, Company profile). */
export default function SponsorLayout() {
  const { data: requests } = useSponsorRequests()
  const fresh = requests?.filter((r) => r.state === 'new').length ?? 0
  return (
    <div className="min-h-svh bg-paper text-[17px] leading-normal text-ink">
      <AppHeader
        nav={[
          { to: '/sponsor', label: 'Requests', badge: fresh, end: true },
          { to: '/sponsor/events', label: 'Browse events' },
          { to: '/sponsor/offers', label: 'My offers' },
          { to: '/sponsor/profile', label: 'Company profile' },
        ]}
        profileTo="/sponsor/profile"
      />
      <Outlet />
    </div>
  )
}

/** Plain-language request states for the inbox (status = words, with an icon where shown as a pill). */
export const REQUEST_STATE: Record<RequestState, { label: string; tone: 'open' | 'covered' | 'received' | 'neutral' | 'conflict' }> = {
  new: { label: 'New', tone: 'open' },
  offer_sent: { label: 'Offer sent · waiting', tone: 'neutral' },
  accepted: { label: 'Offer accepted', tone: 'covered' },
  received: { label: 'Received · thank you', tone: 'received' },
  covered_by_other: { label: 'Already covered by another sponsor', tone: 'neutral' },
  withdrawn: { label: 'You withdrew', tone: 'neutral' },
  expired: { label: 'Event date passed', tone: 'neutral' },
}
