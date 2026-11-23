import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { organizerApi, useProjectAction } from '../../api/organizer'
import type { Project } from '../../api/types'
import { Modal, smallBtn } from '../../components/app/ui'
import { TextField } from '../../components/ui/Field'
import Notice from '../../components/ui/Notice'
import { qtyText } from '../../lib/format'

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.')

/** Someone to ask: a suggestion or a sponsor found by search */
export type RequestTarget = { sponsor_id: string; sponsor_name: string }

/** Send a request to one sponsor for one open need (rule 5: at most 5 sponsors per project). */
export default function SendRequestDialog({
  project,
  match,
  needId: startNeed,
  onClose,
}: {
  project: Project
  match: RequestTarget | null
  /** The need to start with (the panel it was opened from) */
  needId?: string
  onClose: () => void
}) {
  const openNeeds = project.needs.filter((n) => n.status === 'open')
  const [needId, setNeedId] = useState(startNeed ?? '')
  const [benefits, setBenefits] = useState('Logo on the main banner')
  const [conditions, setConditions] = useState('')
  const [exclusive, setExclusive] = useState('')
  const [decideBy, setDecideBy] = useState('')
  const [deliverBy, setDeliverBy] = useState('')
  const send = useProjectAction(project.id, () =>
    organizerApi.sendRequest(project.id, {
      need_id: needId || openNeeds[0]!.id,
      sponsor_id: match!.sponsor_id,
      benefits: benefits.split('\n').map((s) => s.trim()).filter(Boolean),
      conditions: conditions.trim() || null,
      exclusive_category: exclusive.trim() || null,
      decide_by: decideBy || null,
      deliver_by: deliverBy || null,
    }),
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    send.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Modal open={!!match} onClose={onClose} title={`Send a request to ${match?.sponsor_name ?? ''}`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {send.isError && (
          <Notice tone="error">
            {send.error instanceof ApiError && send.error.code === 'request_limit'
              ? 'You have already asked 5 sponsors for this project. That is the limit.'
              : errText(send.error)}
          </Notice>
        )}
        <label className="font-bold">
          Which need?
          <select
            value={needId || openNeeds[0]?.id}
            onChange={(e) => setNeedId(e.target.value)}
            className="mt-1.5 block min-h-13 w-full rounded-[10px] border border-[#C9C3B6] bg-white px-3.5 font-normal"
          >
            {openNeeds.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}: {qtyText(n)}
              </option>
            ))}
          </select>
        </label>
        <label className="font-bold">
          What you offer in return
          <span className="block text-[15px] font-normal text-ink-soft">One benefit per line</span>
          <textarea
            value={benefits}
            onChange={(e) => setBenefits(e.target.value)}
            rows={3}
            className="mt-1.5 block w-full rounded-[10px] border border-[#C9C3B6] px-3.5 py-2.5 font-normal"
          />
        </label>
        <TextField label="Conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} hint="Optional" />
        <TextField
          label="Exclusive category"
          value={exclusive}
          onChange={(e) => setExclusive(e.target.value)}
          hint="Optional. For example food, if this sponsor would be the only food sponsor."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Decide by" type="date" value={decideBy} onChange={(e) => setDecideBy(e.target.value)} />
          <TextField label="Deliver by" type="date" value={deliverBy} onChange={(e) => setDeliverBy(e.target.value)} />
        </div>
        <p className="text-[15px] text-ink-soft">Sending opens a message thread with this sponsor. They never see the match score.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className={smallBtn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={smallBtn.primary} disabled={send.isPending}>
            {send.isPending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
