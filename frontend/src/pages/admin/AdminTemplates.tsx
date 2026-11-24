import { Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { adminApi, useAdminAction, useAdminTemplates } from '../../api/admin'
import type { Template, TemplateInput } from '../../api/types'
import { Card, EmptyNote, Modal, Pill, smallBtn, Spinner } from '../../components/app/ui'
import { SelectField, TextField } from '../../components/ui/Field'
import Notice from '../../components/ui/Notice'
import { NEED_TYPE_LABEL, qtyText } from '../../lib/format'
import NeedFields, { draftFromNeed, emptyDraft, needErrors, needFromDraft, type NeedDraft } from '../organizer/NeedFields'

/** Project templates (prototype "Admin · Templates"): a template fills in the needs a project type usually has. */
export default function AdminTemplates() {
  const { data: templates, isPending } = useAdminTemplates()
  const [editing, setEditing] = useState<Template | 'new' | null>(null)

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold">Project templates</h1>
          <p className="text-ink-soft">A template fills in the needs a project type usually has. Only live templates show to organizers.</p>
        </div>
        <button type="button" className={`${smallBtn.primary} min-h-12 px-5`} onClick={() => setEditing('new')}>
          <Plus className="size-5" aria-hidden /> New template
        </button>
      </div>

      {isPending ? (
        <Spinner />
      ) : !templates?.length ? (
        <div className="mt-6">
          <EmptyNote>No templates yet.</EmptyNote>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold">{t.name}</h2>
                {t.status === 'live' ? <Pill tone="received">Live</Pill> : <Pill tone="neutral">Draft</Pill>}
              </div>
              <p className="mt-1 text-[15px] text-ink-soft">{t.blurb}</p>
              <ul className="mt-3 flex-1 list-disc space-y-1 pl-5">
                {t.default_needs.map((n, i) => (
                  <li key={i}>
                    {n.title} · {NEED_TYPE_LABEL[n.type].toLowerCase()} <span className="text-ink-soft">({qtyText(n)})</span>
                  </li>
                ))}
              </ul>
              <button type="button" className={`${smallBtn.secondary} mt-4 w-fit`} onClick={() => setEditing(t)}>
                Edit<span className="sr-only"> {t.name}</span>
              </button>
            </Card>
          ))}
        </div>
      )}

      {editing && <TemplateEditor template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function TemplateEditor({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const [name, setName] = useState(template?.name ?? '')
  const [blurb, setBlurb] = useState(template?.blurb ?? '')
  const [status, setStatus] = useState<Template['status']>(template?.status ?? 'draft')
  const [needs, setNeeds] = useState<NeedDraft[]>(() => (template?.default_needs ?? [{ type: 'product', title: '', quantity: 1, unit: '' }]).map(draftFromNeed))
  const [errs, setErrs] = useState<Record<string, Record<string, string>>>({})
  const [nameErr, setNameErr] = useState<string | null>(null)

  const save = useAdminAction(() => {
    const body: TemplateInput = {
      name: name.trim(),
      blurb: blurb.trim(),
      status,
      project_type: template?.project_type ?? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      default_needs: needs.map((d) => {
        const n = needFromDraft(d)
        return { type: n.type, title: n.title, quantity: n.quantity, unit: n.unit, budget_item: n.budget_item }
      }),
    }
    return template ? adminApi.updateTemplate(template.id, body) : adminApi.createTemplate(body)
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ne: Record<string, Record<string, string>> = {}
    needs.forEach((n) => {
      const x = needErrors(n, false)
      if (Object.keys(x).length) ne[n.key] = x
    })
    setErrs(ne)
    setNameErr(name.trim() ? null : 'Give the template a name.')
    if (!name.trim() || Object.keys(ne).length || !needs.length) return
    save.mutate(undefined, { onSuccess: onClose })
  }

  return (
    <Modal open onClose={onClose} title={template ? `Edit ${template.name}` : 'New template'}>
      <form onSubmit={submit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={nameErr} />
        <TextField label="Short description" value={blurb} onChange={(e) => setBlurb(e.target.value)} hint="Shown on the template card, for example: Fills in trainers and a venue." />
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value as Template['status'])} hint="Only live templates show to organizers.">
          <option value="live">Live</option>
          <option value="draft">Draft</option>
        </SelectField>
        <h3 className="mt-2 text-lg font-bold">Default needs</h3>
        <ol className="flex flex-col gap-3">
          {needs.map((n, i) => (
            <li key={n.key} className="rounded-xl border border-[#E2DED5] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold text-ink-soft">Need {i + 1}</span>
                <button type="button" onClick={() => setNeeds((l) => l.filter((x) => x.key !== n.key))} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-bold text-warning hover:bg-[#FBEBDD]">
                  <Trash2 className="size-4" aria-hidden /> Remove
                </button>
              </div>
              <NeedFields value={n} onChange={(d) => setNeeds((l) => l.map((x) => (x.key === n.key ? d : x)))} errors={errs[n.key]} withTimes={false} />
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setNeeds((l) => [...l, emptyDraft()])} className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-lg border border-dashed border-accent px-4 font-bold text-accent">
          <Plus className="size-4" aria-hidden /> Add a need
        </button>
        {save.isError && <Notice tone="error">{save.error instanceof Error ? save.error.message : 'Could not save.'}</Notice>}
        <div className="sticky bottom-0 flex justify-end gap-2 bg-white pt-2">
          <button type="button" className={smallBtn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={smallBtn.primary} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
