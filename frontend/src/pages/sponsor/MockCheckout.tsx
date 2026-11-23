import { useQuery } from '@tanstack/react-query'
import { FlaskConical } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import { useSponsorAction } from '../../api/sponsor'
import { Spinner, smallBtn } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { bdt } from '../../lib/format'
import { env } from '../../lib/env'

type Payment = { id: string; gross_amount: number; commission_amount: number; net_amount: number; status: string; project_name: string; need_title: string }

/**
 * Demo payment gateway (build prompt 10: "Mock gateway page that lets you
 * choose success or failure"). It sends the webhook the real gateway would
 * send to FastAPI. Only used in demo mode.
 */
export default function MockCheckout() {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const { data, isPending } = useQuery({
    queryKey: ['mock-payment', paymentId],
    queryFn: () => api<Payment>(`/payments/${paymentId}`),
    enabled: env.useMocks,
  })
  const settle = useSponsorAction((status: 'succeeded' | 'failed') =>
    api<{ status: string }>('/payments/webhook', { method: 'POST', json: { payment_id: paymentId, status } }),
  )

  if (!env.useMocks)
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <Notice tone="info">The real payment page is hosted by the payment provider.</Notice>
      </main>
    )
  if (isPending || !data) return <Spinner />

  const finish = (status: 'succeeded' | 'failed') =>
    settle.mutate(status, { onSuccess: () => navigate(`/sponsor/offers?payment=${status}`, { replace: true }) })

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <div className="rounded-2xl border-2 border-dashed border-teal/60 bg-white p-6 sm:p-8">
        <p className="flex items-center gap-2 font-bold text-deep">
          <FlaskConical className="size-5" aria-hidden /> Demo payment gateway
        </p>
        <h1 className="mt-3 text-[28px] font-bold">Pay {bdt(data.gross_amount)}</h1>
        <p className="text-ink-soft">
          {data.need_title} for {data.project_name}. {bdt(data.net_amount)} goes to the project and {bdt(data.commission_amount)} to MissingPiece.
        </p>
        {data.status !== 'pending' ? (
          <div className="mt-6">
            <Notice tone="info">This payment is already {data.status}.</Notice>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-[15px]">Choose what the payment provider should report back:</p>
            <button type="button" className={`${smallBtn.primary} min-h-14 text-lg`} onClick={() => finish('succeeded')} disabled={settle.isPending}>
              Payment succeeds
            </button>
            <button type="button" className={`${smallBtn.secondary} min-h-14`} onClick={() => finish('failed')} disabled={settle.isPending}>
              Payment fails
            </button>
          </div>
        )}
        {settle.isError && (
          <div className="mt-4">
            <Notice tone="error">{settle.error instanceof Error ? settle.error.message : 'Something went wrong.'}</Notice>
          </div>
        )}
      </div>
    </main>
  )
}
