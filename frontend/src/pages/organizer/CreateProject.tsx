import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { organizerApi, qk, useTemplates } from '../../api/organizer'
import type { Template } from '../../api/types'
import { Card, smallBtn, Spinner } from '../../components/app/ui'
import { TextField } from '../../components/ui/Field'
import Notice from '../../components/ui/Notice'
import NeedFields, { draftFromNeed, emptyDraft, needErrors, needFromDraft, type NeedDraft } from './NeedFields'

/** Label for the "institution" field, which changes with the template (prototype). */
const INSTITUTION_LABEL: Record<string, string> = {
  university_event: 'Approving institution',
  ngo_project: 'Registered NGO',
  elders_youth: 'Community group',
}

type Details = { name: string; description: string; purpose: string; event_date: string; venue: string; audience: string; institution: string }
const emptyDetails: Details = { name: '', description: '', purpose: '', event_date: '', venue: '', audience: '', institution: '' }

/**
 * Create project (prototype "Organizer · Create project"): pick one of the
 * three templates, which fills the needs; edit details and needs; save as a
 * draft or publish (POST /projects, then POST /projects/{id}/publish).
 */
export default function CreateProject() {
  const { data: templates, isPending } = useTemplates()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [tpl, setTpl] = useState<Template | null>(null)
  const [details, setDetails] = useState<Details>(emptyDetails)
  const [needs, setNeeds] = useState<NeedDraft[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [needErrs, setNeedErrs] = useState<Record<string, Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null)

  // Start with the first template, like the prototype.
  useEffect(() => {
    if (templates?.length && !tpl) pick(templates[0])
  }, [templates]) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(t: Template) {
    setTpl(t)
    setNeeds(t.default_needs.map(draftFromNeed))
    setNeedErrs({})
  }

  const set = (k: keyof Details, v: string) => setDetails((d) => ({ ...d, [k]: v }))

  function validate() {
    const e: Record<string, string> = {}
    if (!details.name.trim()) e.name = 'Give the project a name.'
    if (!details.description.trim()) e.description = 'Describe the project in a sentence or two.'
    if (!details.event_date) e.event_date = 'Choose the event date.'
    if (!details.venue.trim()) e.venue = 'Where will it happen?'
    if (!/^\d+$/.test(details.audience)) e.audience = 'Enter a number, for example 200.'
    const ne: Record<string, Record<string, string>> = {}
    needs.forEach((n) => {
      const x = needErrors(n)
      if (Object.keys(x).length) ne[n.key] = x
    })
    setErrors(e)
    setNeedErrs(ne)
    if (!needs.length) setFormError('Add at least one need.')
    return !Object.keys(e).length && !Object.keys(ne).length && needs.length > 0
  }

  async function save(mode: 'draft' | 'publish') {
    setFormError(null)
    if (!validate()) {
      setFormError((f) => f ?? 'Please fix the highlighted fields.')
      return
    }
    setBusy(mode)
    try {
      const project = await organizerApi.createProject({
        template_id: tpl?.id ?? null,
        name: details.name.trim(),
        purpose: details.purpose.trim() || details.description.trim(),
        description: details.description.trim(),
        event_date: details.event_date,
        venue: details.venue.trim(),
        audience: Number(details.audience),
        institution: details.institution.trim() || null,
        needs: needs.map(needFromDraft),
      })
      if (mode === 'publish') await organizerApi.publish(project.id)
      await qc.invalidateQueries({ queryKey: qk.myProjects })
      navigate(`/organizer/projects/${project.id}`)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save the project.')
      setBusy(null)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void save('publish')
  }

  if (isPending) return <Spinner />

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-[15px]">
        <Link to="/organizer" className="font-bold text-accent underline underline-offset-2">
          Dashboard
        </Link>{' '}
        / New project
      </nav>
      <h1 className="mt-1 text-[34px] font-bold">New project</h1>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-6" noValidate>
        <Card title="1. Choose a project type">
          <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Project templates">
            {templates?.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tpl?.id === t.id}
                onClick={() => pick(t)}
                className={`rounded-xl p-4 text-left transition-colors ${
                  tpl?.id === t.id ? 'border-2 border-accent bg-[#E6F1EE]' : 'border border-[#C9C3B6] bg-white hover:border-accent'
                }`}
              >
                <span className="block font-bold">{t.name}</span>
                <span className="mt-1 block text-[15px] text-ink-soft">{t.blurb}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[15px] text-ink-soft">Picking a template fills in the usual needs below. You can change them.</p>
        </Card>

        <Card title="2. Project details">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <TextField label="Project name" value={details.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
            </div>
            <div className="sm:col-span-2">
              <label className="font-bold" htmlFor="desc">
                Description <span className="font-normal text-ink-soft">· the AI uses this to suggest sponsors</span>
              </label>
              <textarea
                id="desc"
                value={details.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                aria-invalid={errors.description ? true : undefined}
                className="mt-1.5 block w-full rounded-[10px] border border-[#C9C3B6] px-3.5 py-2.5"
              />
              {errors.description && <p className="mt-1 text-[15px] font-bold text-warning">{errors.description}</p>}
            </div>
            <TextField label="Date" type="date" value={details.event_date} onChange={(e) => set('event_date', e.target.value)} error={errors.event_date} />
            <TextField label="Venue" value={details.venue} onChange={(e) => set('venue', e.target.value)} error={errors.venue} />
            <TextField label="Expected audience" inputMode="numeric" value={details.audience} onChange={(e) => set('audience', e.target.value)} error={errors.audience} />
            <TextField
              label={INSTITUTION_LABEL[tpl?.project_type ?? ''] ?? 'Institution'}
              value={details.institution}
              onChange={(e) => set('institution', e.target.value)}
              hint="Optional"
            />
          </div>
        </Card>

        <Card title="3. Needs" aside={<span className="text-[15px] text-ink-soft">Filled from the template. Edit or add your own.</span>}>
          <ol className="flex flex-col gap-4">
            {needs.map((n, i) => (
              <li key={n.key} className="rounded-xl border border-[#E2DED5] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-bold text-ink-soft">Need {i + 1}</span>
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 font-bold text-warning hover:bg-[#FBEBDD]"
                    onClick={() => setNeeds((list) => list.filter((x) => x.key !== n.key))}
                  >
                    <Trash2 className="size-4" aria-hidden /> Remove<span className="sr-only"> {n.title || `need ${i + 1}`}</span>
                  </button>
                </div>
                <NeedFields
                  value={n}
                  onChange={(d) => setNeeds((list) => list.map((x) => (x.key === n.key ? d : x)))}
                  errors={needErrs[n.key]}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setNeeds((list) => [...list, emptyDraft()])}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dashed border-accent px-4 font-bold text-accent hover:bg-[#E6F1EE]"
          >
            <Plus className="size-4" aria-hidden /> Add a need
          </button>
        </Card>

        {formError && <Notice tone="error">{formError}</Notice>}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className={`${smallBtn.secondary} min-h-12 px-5`} disabled={!!busy} onClick={() => save('draft')}>
            {busy === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button type="submit" className={`${smallBtn.primary} min-h-12 px-6 text-base`} disabled={!!busy}>
            {busy === 'publish' ? 'Publishing…' : 'Publish project'}
          </button>
        </div>
      </form>
    </main>
  )
}
