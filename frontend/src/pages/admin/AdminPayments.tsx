import { adminApi, useAdminAction, useAdminPayments } from '../../api/admin'
import type { AdminPayment } from '../../api/types'
import { Card, EmptyNote, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { bdt, formatDate } from '../../lib/format'

/**
 * Payments (prototype "4 · Admin payments"): money from sponsors goes through
 * the platform, which keeps 5%. Payouts to projects are sent by hand in v1.
 */
export default function AdminPayments() {
  const { data: payments, isPending } = useAdminPayments()
  const payout = useAdminAction((id: string) => adminApi.payout(id))

  const list = payments ?? []
  const collected = list.filter((p) => p.status === 'succeeded' || p.status === 'paid_out').reduce((s, p) => s + p.commission_amount, 0)
  const toPay = list.filter((p) => p.status === 'succeeded')
  const failed = list.filter((p) => p.status === 'failed').length

  const markPaid = (p: AdminPayment) => {
    if (confirm(`Did you send ${bdt(p.net_amount)} to ${p.project_name}? This marks the payment as paid out.`)) payout.mutate(p.id)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-[34px] font-bold">Payments</h1>

      <section aria-label="Summary" className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Commission collected (5%)" value={bdt(collected)} sub="From payments that went through" />
        <Stat label="Payouts to make" value={String(toPay.length)} sub={toPay.length ? `${bdt(toPay.reduce((s, p) => s + p.net_amount, 0))} in total · sent by hand in v1` : 'Sent by hand in v1'} />
        <Stat label="Failed payments" value={String(failed)} sub="The sponsor can retry" warn={failed > 0} />
      </section>

      {payout.isError && (
        <div className="mt-4">
          <Notice tone="error">{payout.error instanceof Error ? payout.error.message : 'Could not save.'}</Notice>
        </div>
      )}

      <Card title="All payments" className="mt-6">
        {isPending ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyNote>No payments yet.</EmptyNote>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[15px]">
              <thead>
                <tr className="text-sm text-ink-soft">
                  <th className="px-2 pb-2 font-bold">Project</th>
                  <th className="px-2 pb-2 font-bold">Sponsor</th>
                  <th className="px-2 pb-2 text-right font-bold">Sponsor paid</th>
                  <th className="px-2 pb-2 text-right font-bold">Commission</th>
                  <th className="px-2 pb-2 text-right font-bold">To project</th>
                  <th className="px-2 pb-2 font-bold">Status</th>
                  <th className="px-2 pb-2 font-bold">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-t border-[#F0EDE6]">
                    <td className="px-2 py-3 font-bold">{p.project_name}</td>
                    <td className="px-2 py-3">{p.sponsor_name}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{bdt(p.gross_amount)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{bdt(p.commission_amount)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{bdt(p.net_amount)}</td>
                    <td className="px-2 py-3">{statusPill(p)}</td>
                    <td className="px-2 py-3">
                      {p.status === 'succeeded' ? (
                        <button type="button" className={smallBtn.primary} onClick={() => markPaid(p)} disabled={payout.isPending}>
                          Mark paid out<span className="sr-only">: {p.project_name}</span>
                        </button>
                      ) : p.status === 'failed' ? (
                        <span className="text-ink-soft">Waiting for retry</span>
                      ) : p.status === 'paid_out' ? (
                        <span className="text-ink-soft">{formatDate(p.paid_out_at)}</span>
                      ) : (
                        <span className="text-ink-soft">Waiting for the gateway</span>
                      )}
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

function Stat({ label, value, sub, warn }: { label: string; value: string; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-[#E2DED5] bg-white px-4 py-3.5">
      <div className="text-[15px] text-ink-soft">{label}</div>
      <div className={`text-2xl font-bold ${warn ? 'text-warning' : ''}`}>{value}</div>
      <div className="text-sm text-ink-soft">{sub}</div>
    </div>
  )
}

function statusPill(p: AdminPayment) {
  switch (p.status) {
    case 'succeeded':
      return <Pill tone="covered">Succeeded</Pill>
    case 'paid_out':
      return <Pill tone="received">Paid out</Pill>
    case 'failed':
      return <Pill tone="conflict">Failed</Pill>
    default:
      return <Pill tone="open">Pending</Pill>
  }
}
