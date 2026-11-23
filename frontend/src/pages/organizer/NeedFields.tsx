import type { NeedInput, NeedType } from '../../api/types'
import { SelectField, TextField } from '../../components/ui/Field'
import { NEED_TYPE_LABEL } from '../../lib/format'

/** Form state for one need. Numbers stay strings while typing. */
export type NeedDraft = {
  key: string
  type: NeedType
  title: string
  quantity: string
  unit: string
  budget_item: string
  slot_start: string
  slot_end: string
  deadline: string
}

const BOOKABLE: NeedType[] = ['skill', 'time', 'equipment', 'space']

// datetime-local works in local wall time; we store Bangladesh time (+06:00).
const toLocal = (iso?: string | null) => (iso ? iso.slice(0, 16) : '')
const fromLocal = (v: string) => (v ? `${v}:00+06:00` : null)

export const draftFromNeed = (n: NeedInput): NeedDraft => ({
  key: crypto.randomUUID(),
  type: n.type,
  title: n.title,
  quantity: String(n.quantity),
  unit: n.unit,
  budget_item: n.budget_item ?? '',
  slot_start: toLocal(n.slot_start),
  slot_end: toLocal(n.slot_end),
  deadline: n.deadline ?? '',
})

export const emptyDraft = (): NeedDraft =>
  draftFromNeed({ type: 'product', title: '', quantity: 1, unit: '' })

/** Checks a need the same way the back end does. Returns field errors. */
export function needErrors(d: NeedDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.title.trim()) e.title = 'Give the need a name.'
  if (!(Number(d.quantity) > 0)) e.quantity = 'Must be more than 0.'
  if (d.type !== 'money' && !d.unit.trim()) e.unit = 'Say the unit, for example packs or hours.'
  if (d.type === 'money' && !d.budget_item.trim()) e.budget_item = 'Money needs a budget item.'
  if (d.slot_start && d.slot_end && d.slot_end <= d.slot_start)
    // Same day but an earlier hour (for example 10:25 PM to 04:23 AM): say what to change
    e.slot_end =
      d.slot_end.slice(0, 10) === d.slot_start.slice(0, 10)
        ? 'Ends before it starts. If it runs past midnight, set the end date to the next day.'
        : 'Must end after it starts.'
  return e
}

export function needFromDraft(d: NeedDraft): NeedInput {
  const bookable = BOOKABLE.includes(d.type)
  return {
    type: d.type,
    title: d.title.trim(),
    quantity: Number(d.quantity),
    unit: d.type === 'money' ? 'BDT' : d.unit.trim(),
    budget_item: d.type === 'money' ? d.budget_item.trim() : null,
    slot_start: bookable ? fromLocal(d.slot_start) : null,
    slot_end: bookable ? fromLocal(d.slot_end) : null,
    deadline: d.deadline || null,
  }
}

/** The fields for one need, used on Create project and in Add a need. */
export default function NeedFields({
  value,
  onChange,
  errors = {},
  withTimes = true,
}: {
  value: NeedDraft
  onChange: (d: NeedDraft) => void
  errors?: Record<string, string>
  /** Templates have no dates, so they hide the time slot and "needed by" fields. */
  withTimes?: boolean
}) {
  const set = (k: keyof NeedDraft, v: string) => onChange({ ...value, [k]: v })
  const bookable = withTimes && BOOKABLE.includes(value.type)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Need" value={value.title} onChange={(e) => set('title', e.target.value)} error={errors.title} placeholder="Snack packs" />
      <SelectField label="Type" value={value.type} onChange={(e) => set('type', e.target.value)}>
        {(Object.keys(NEED_TYPE_LABEL) as NeedType[]).map((t) => (
          <option key={t} value={t}>
            {NEED_TYPE_LABEL[t]}
          </option>
        ))}
      </SelectField>
      <TextField
        label={value.type === 'money' ? 'Amount (BDT)' : 'Quantity'}
        inputMode="decimal"
        value={value.quantity}
        onChange={(e) => set('quantity', e.target.value)}
        error={errors.quantity}
      />
      {value.type === 'money' ? (
        <TextField
          label="Budget item"
          value={value.budget_item}
          onChange={(e) => set('budget_item', e.target.value)}
          error={errors.budget_item}
          placeholder="prizes"
        />
      ) : (
        <TextField
          label="Unit"
          value={value.unit}
          onChange={(e) => set('unit', e.target.value)}
          error={errors.unit}
          placeholder="packs, people, seats"
        />
      )}
      {bookable && (
        <>
          <TextField label="From" type="datetime-local" value={value.slot_start} onChange={(e) => set('slot_start', e.target.value)} hint="Optional" />
          <TextField label="To" type="datetime-local" value={value.slot_end} onChange={(e) => set('slot_end', e.target.value)} error={errors.slot_end} />
        </>
      )}
      {withTimes && (
        <TextField label="Needed by" type="date" value={value.deadline} onChange={(e) => set('deadline', e.target.value)} hint="Optional" />
      )}
    </div>
  )
}
