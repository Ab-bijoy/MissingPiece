import { CircleCheck } from 'lucide-react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { sponsorApi, usePaymentQuote, useSponsorAction } from '../../api/sponsor'
import { Card, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { bdt } from '../../lib/format'
import { safeHttpUrl } from '../../lib/safe'

/**
 * Pay an accepted offer (prototype "Sponsor · Pay", rule 10): amount + 5%
 * commission. POST /offers/{id}/payments returns the gateway's checkout URL.
 */
export default function SponsorPay() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: q, isPending, isError, error } = usePaymentQuote(id!)
  const pay = useSponsorAction(() => sponsorApi.pay(id!))
  const withdraw = useSponsorAction(() => sponsorApi.withdraw(id!))

  if (isPending) return <Spinner />
  if (isError)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Notice tone="error">{error instanceof Error ? error.message : 'Could not load this offer.'}</Notice>
      </main>
    )

  // Already paid: nothing to pay
  if (q.offer_stage === 'received')
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Notice tone="success">
          <strong>Paid, thank you.</strong> Your {bdt(q.amount)} for the {q.project_name} {q.need_title.toLowerCase()} went through.
        </Notice>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to={`/sponsor/reports/${q.project_id}`} className={smallBtn.primary}>
            See the impact report
          </Link>
          <Link to="/sponsor/offers" className={smallBtn.secondary}>
            Back to my offers
          </Link>
        </div>
      </main>
    )
  if (q.offer_stage !== 'accepted')
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Notice tone="info">This offer is no longer waiting for a payment.</Notice>
        <Link to="/sponsor/offers" className={`${smallBtn.secondary} mt-4`}>
          Back to my offers
        </Link>
      </main>
    )
  const inProgress = q.payment_in_progress

  const submit = (e: FormEvent) => {
    e.preventDefault()
    pay.mutate(undefined, {
      onSuccess: (res) => {
        // The gateway's secure page. In demo mode it is a page inside this app.
        if (res.checkout_url.startsWith('/') && !res.checkout_url.startsWith('//')) navigate(res.checkout_url)
        else {
          const safe = safeHttpUrl(res.checkout_url)
          if (safe) window.location.assign(safe)
        }
      },
    })
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {inProgress ? (
        <Notice tone="warning">
          You already started paying for this offer. Finish on the payment page, or continue below. If you closed the payment
          page, you can start again after 15 minutes. You will never be charged twice.
        </Notice>
      ) : q.last_payment_status === 'failed' ? (
        <Notice tone="warning">Your last payment did not go through. Your offer is still accepted, so you can try again.</Notice>
      ) : (
        <div className="flex gap-3 rounded-[14px] border border-[#BFDCD4] bg-[#E6F1EE] px-5 py-4">
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden />
          <div>
            <p className="font-bold">Your offer was accepted</p>
            <p className="text-[15px]">
              {q.organizer_name} accepted your {bdt(q.amount)} offer for the {q.project_name} {q.need_title.toLowerCase()}.
            </p>
          </div>
        </div>
      )}

      <h1 className="mt-6 text-[34px] font-bold">Pay your offer</h1>

      <div className="mt-6 flex flex-col gap-6">
        <Card title="Summary">
          <dl className="grid grid-cols-[1fr_auto] gap-y-2">
            <dt>
              {q.need_title} for {q.project_name}
            </dt>
            <dd className="text-right tabular-nums">{bdt(q.amount)}</dd>
            <dt className="text-ink-soft">Platform commission (5%)</dt>
            <dd className="text-right text-ink-soft tabular-nums">{bdt(q.commission)}</dd>
            <dt className="border-t border-[#E2DED5] pt-2 text-xl font-bold">Total</dt>
            <dd className="border-t border-[#E2DED5] pt-2 text-right text-xl font-bold tabular-nums">{bdt(q.total)}</dd>
          </dl>
          <p className="mt-3 text-[15px] text-ink-soft">The project receives the full {bdt(q.amount)}.</p>
        </Card>

        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            {pay.isError && <Notice tone="error">{pay.error instanceof Error ? pay.error.message : 'Could not start the payment.'}</Notice>}
            <button type="submit" className={`${smallBtn.primary} min-h-14 text-lg`} disabled={pay.isPending}>
              {pay.isPending ? 'Opening payment…' : inProgress ? 'Continue payment' : `Pay ${bdt(q.total)}`}
            </button>
            <p className="text-[15px] text-ink-soft">
              You will go to the payment provider's secure page, where you can pay by card, mobile wallet or internet banking. Once
              the payment goes through, your offer is marked received and can no longer be withdrawn.
            </p>
          </form>
        </Card>

        {!inProgress && (
        <button
          type="button"
          className="w-fit min-h-11 font-bold text-warning underline underline-offset-2"
          disabled={withdraw.isPending}
          onClick={() =>
            confirm('Withdraw this offer? The need opens again and the organizer is told.') &&
            withdraw.mutate(undefined, { onSuccess: () => navigate('/sponsor/offers') })
          }
        >
          Withdraw this offer instead
        </button>
        )}
        {withdraw.isError && <Notice tone="error">{withdraw.error instanceof Error ? withdraw.error.message : 'Could not withdraw.'}</Notice>}
      </div>
    </main>
  )
}
