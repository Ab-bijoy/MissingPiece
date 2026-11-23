import { ArrowLeft, Check } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { sponsorApi, useSponsorAction, useSponsorProfile, useSponsorRequest, useSponsorRequests } from '../../api/sponsor'
import type { SponsorRequestDetail } from '../../api/types'
import Conversation from '../../components/app/Conversation'
import { Card, EmptyNote, Pill, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { bdt, formatDate, needAmount, qtyText } from '../../lib/format'
import { REQUEST_STATE } from './SponsorLayout'

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')
const commission = (n: number) => Math.round(n * 0.05 * 100) / 100

/** Sponsor inbox and request detail (prototype "2 · Sponsor inbox and offer"). */
export default function SponsorInbox() {
  const { data: requests, isPending } = useSponsorRequests()
  const [params, setParams] = useSearchParams()
  const selected = params.get('request')

  // On wide screens, open the newest request by default.
  useEffect(() => {
    if (!selected && requests?.length && window.matchMedia('(min-width: 1024px)').matches)
      setParams({ request: requests[0].id }, { replace: true })
  }, [selected, requests, setParams])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside aria-label="Request inbox" className={`rounded-[14px] border border-[#E2DED5] bg-white p-3 ${selected ? 'hidden lg:block' : ''}`}>
          <div className="px-2 pt-2 pb-3">
            <h1 className="text-2xl font-bold">Inbox</h1>
            <p className="text-sm text-ink-soft">Organizers send you requests. You reply with an offer.</p>
          </div>
          {isPending ? (
            <Spinner />
          ) : !requests?.length ? (
            <EmptyNote>
              No requests yet. Keep your <Link to="/sponsor/profile" className="font-bold text-accent">company profile</Link> up to
              date so organizers find you.
            </EmptyNote>
          ) : (
            <ul className="flex flex-col gap-1">
              {requests.map((r) => {
                const st = REQUEST_STATE[r.state]
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setParams({ request: r.id })}
                      aria-current={r.id === selected ? 'true' : undefined}
                      className={`w-full rounded-xl px-3 py-3 text-left ${r.id === selected ? 'bg-[#E6F1EE]' : 'hover:bg-paper'}`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-bold">{r.project_name}</span>
                        {r.state === 'new' && <span className="text-sm font-bold text-accent">New</span>}
                      </span>
                      <span className="block text-[15px]">
                        {r.need_title} · {r.need_amount}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {r.state === 'new' ? `Decide by ${r.decide_by ? formatDate(r.decide_by) : 'when you can'}` : st.label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        {selected ? (
          <RequestDetail key={selected} id={selected} onBack={() => setParams({})} />
        ) : (
          <section className="hidden min-h-80 items-center justify-center rounded-[14px] border border-[#E2DED5] bg-white text-ink-soft lg:flex">
            Choose a request.
          </section>
        )}
      </div>
    </main>
  )
}

function RequestDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: r, isPending, isError, error } = useSponsorRequest(id)
  if (isPending) return <Spinner />
  if (isError) return <Notice tone="error">{errText(error)}</Notice>
  const p = r.project
  const st = REQUEST_STATE[r.state]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 w-fit items-center gap-1.5 font-bold text-accent lg:hidden">
        <ArrowLeft className="size-5" aria-hidden /> All requests
      </button>
      <Card>
        <p className="text-[15px] text-ink-soft">
          Request from {p.organizer_name}
          {p.institution ? ` · approved by ${p.institution}` : ''}
        </p>
        <h1 className="mt-1 text-[32px] leading-tight font-bold">
          {p.name}: {r.need.title.toLowerCase()}
        </h1>
        <p className="text-ink-soft">
          {formatDate(p.event_date)} · {p.venue} · {p.audience.toLocaleString('en-US')} expected
        </p>
        <div className="mt-3">
          <Pill tone={st.tone}>{st.label}</Pill>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <Fact label="The ask" value={qtyText(r.need)} sub={`for the ${r.need.title.toLowerCase()}`} />
          <Fact label="Participants" value={String(p.participants)} sub="joined so far" />
          <Fact label="Contributors" value={String(p.contributors)} sub="helping so far" />
        </dl>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h2 className="font-bold">Benefits offered</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {r.benefits.length ? r.benefits.map((b) => <li key={b}>{b}</li>) : <li>None listed</li>}
            </ul>
          </div>
          <div>
            <h2 className="font-bold">Conditions</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Exclusive: {r.exclusive_category ?? 'none'}</li>
              <li>
                Decide by {r.decide_by ? formatDate(r.decide_by) : 'no date set'}
                {r.deliver_by ? `, deliver by ${formatDate(r.deliver_by)}` : ''}
              </li>
              {r.need.slot_start && <li>When: {needAmount(r.need).split(', ').slice(1).join(', ')}</li>}
              {r.conditions && <li>{r.conditions}</li>}
              <li>Contact: {p.organizer_name}</li>
            </ul>
          </div>
        </div>
      </Card>

      <OfferPanel r={r} />

      {r.thread_id && <Conversation threadId={r.thread_id} title="Messages with the organizer" minHeight="min-h-0" />}
    </div>
  )
}

function Fact({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <dt className="text-sm text-ink-soft">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
      <dd className="text-sm text-ink-soft">{sub}</dd>
    </div>
  )
}

function OfferPanel({ r }: { r: SponsorRequestDetail }) {
  const { data: profile } = useSponsorProfile()
  const [conditions, setConditions] = useState('')
  const [exclusive, setExclusive] = useState(false)
  const isMoney = r.need.type === 'money'
  const amount = isMoney ? r.need.quantity : 0
  const category = (r.exclusive_category ?? profile?.industry ?? 'my category').toLowerCase()

  const send = useSponsorAction(() =>
    sponsorApi.makeOffer(r.id, {
      conditions: conditions.trim() || null,
      exclusive_category: exclusive ? category : null,
      amount: isMoney ? amount : null,
    }),
  )
  const withdraw = useSponsorAction((offerId: string) => sponsorApi.withdraw(offerId))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send.mutate(undefined)
  }

  const o = r.my_offer
  if (r.state !== 'new' && r.state !== 'withdrawn') {
    return (
      <Card title="Your offer">
        {r.state === 'covered_by_other' && <EmptyNote>The organizer chose another offer for this need. Thank you for offering.</EmptyNote>}
        {r.state === 'expired' && <EmptyNote>The event date has passed, so this request is closed.</EmptyNote>}
        {o && (r.state === 'offer_sent' || r.state === 'accepted' || r.state === 'received') && (
          <div className="flex flex-col gap-3">
            <p>
              You offered <strong>{o.amount ? bdt(o.amount) : qtyText(r.need)}</strong>
              {o.conditions ? ` · ${o.conditions}` : ''}
              {o.exclusive_category ? ` · exclusive: ${o.exclusive_category}` : ''}.
            </p>
            {r.state === 'offer_sent' && <p className="text-ink-soft">Waiting for the organizer to decide.</p>}
            {r.state === 'received' && (
              <Notice tone="success">
                Received by the organizer.{' '}
                <Link to={`/sponsor/reports/${r.project.id}`} className="font-bold underline">
                  See the impact report
                </Link>
              </Notice>
            )}
            <div className="flex flex-wrap gap-2">
              {r.state === 'accepted' && isMoney && (
                <Link to={`/sponsor/offers/${o.id}/pay`} className={`${smallBtn.primary} min-h-12`}>
                  Pay {bdt(amount + commission(amount))}
                </Link>
              )}
              {(r.state === 'offer_sent' || r.state === 'accepted') && (
                <button
                  type="button"
                  className={smallBtn.secondary}
                  disabled={withdraw.isPending}
                  onClick={() => confirm('Withdraw this offer? The organizer will be told.') && withdraw.mutate(o.id)}
                >
                  Withdraw offer
                </button>
              )}
            </div>
            {withdraw.isError && <Notice tone="error">{errText(withdraw.error)}</Notice>}
          </div>
        )}
      </Card>
    )
  }

  return (
    <Card title="Make your offer">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="-mt-2 text-[15px] text-ink-soft">
          An offer covers the whole need: <strong className="text-ink">{needAmount(r.need)}</strong>.
        </p>
        {r.state === 'withdrawn' && <Notice tone="info">You withdrew an earlier offer. You can offer again.</Notice>}
        <label className="font-bold" htmlFor="cond">
          Your conditions <span className="font-normal text-ink-soft">(optional)</span>
        </label>
        <textarea
          id="cond"
          value={conditions}
          onChange={(e) => setConditions(e.target.value)}
          rows={3}
          className="-mt-2 w-full rounded-[10px] border border-[#C9C3B6] px-3.5 py-2.5"
          placeholder={isMoney ? 'Name the prize after our coding academy.' : 'Delivered to the venue by 9 am.'}
        />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} className="size-5 accent-accent" />
          Ask to be the only sponsor in my category ({category})
        </label>
        {isMoney && (
          <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 border-t border-[#E2DED5] pt-4">
            <dt>Offer amount</dt>
            <dd className="text-right tabular-nums">{bdt(amount)}</dd>
            <dt className="text-ink-soft">Platform commission (5%)</dt>
            <dd className="text-right text-ink-soft tabular-nums">{bdt(commission(amount))}</dd>
            <dt className="text-lg font-bold">You pay after acceptance</dt>
            <dd className="text-right text-lg font-bold tabular-nums">{bdt(amount + commission(amount))}</dd>
          </dl>
        )}
        {send.isError && <Notice tone="error">{errText(send.error)}</Notice>}
        {send.isSuccess && (
          <Notice tone="success">
            <Check className="mr-1 inline size-4" aria-hidden />
            Offer sent. The organizer has been told.
          </Notice>
        )}
        <button type="submit" className={`${smallBtn.primary} min-h-14 text-lg`} disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send offer'}
        </button>
        <p className="text-sm text-ink-soft">
          {isMoney ? 'You can withdraw until you start paying.' : 'You can withdraw until the organizer marks it received.'}
        </p>
      </form>
    </Card>
  )
}
