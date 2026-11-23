import { Outlet } from 'react-router-dom'
import { useHiddenComments, useHiddenMessages, useRegistrations } from '../../api/admin'
import AppHeader from '../../components/app/AppHeader'

/** Frame for /admin/* (prototype nav: Approvals, Accounts, Templates, Payments, Comments). */
export default function AdminLayout() {
  const { data: pending } = useRegistrations('pending')
  const { data: hidden } = useHiddenComments()
  const { data: messages } = useHiddenMessages()
  return (
    <div className="min-h-svh bg-paper text-[17px] leading-normal text-ink">
      <AppHeader
        nav={[
          { to: '/admin/approvals', label: 'Approvals', badge: pending?.length },
          { to: '/admin/accounts', label: 'Accounts' },
          { to: '/admin/templates', label: 'Templates' },
          { to: '/admin/payments', label: 'Payments' },
          { to: '/admin/comments', label: 'Moderation', badge: (hidden?.length ?? 0) + (messages?.length ?? 0) },
        ]}
      />
      <Outlet />
    </div>
  )
}
