import { Plus, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { sponsorApi, useSponsorAction, useSponsorProfile } from '../../api/sponsor'
import type { NeedType, SponsorProfile } from '../../api/types'
import { Card, smallBtn, Spinner } from '../../components/app/ui'
import { TextField } from '../../components/ui/Field'
import Notice from '../../components/ui/Notice'

const GIVES: { type: NeedType; label: string }[] = [
  { type: 'money', label: 'Money' },
  { type: 'product', label: 'Products' },
  { type: 'skill', label: 'Skills (trainers)' },
  { type: 'time', label: 'Time (volunteers)' },
  { type: 'equipment', label: 'Equipment' },
  { type: 'space', label: 'Space' },
]

/** Company profile (prototype "Sponsor · Company profile"). Matching reads it. */
export default function SponsorProfilePage() {
  const { data, isPending } = useSponsorProfile()
  const [form, setForm] = useState<SponsorProfile | null>(null)
  const [newInterest, setNewInterest] = useState('')
  const save = useSponsorAction((body: Partial<SponsorProfile>) => sponsorApi.saveProfile(body))

  useEffect(() => {
    if (data && !form) setForm(data)
  }, [data, form])

  if (isPending || !form) return <Spinner />

  const set = <K extends keyof SponsorProfile>(k: K, v: SponsorProfile[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const addInterest = () => {
    const v = newInterest.trim()
    if (v && !form.interests.some((i) => i.toLowerCase() === v.toLowerCase())) set('interests', [...form.interests, v])
    setNewInterest('')
  }
  const toggleGive = (t: NeedType) =>
    set('preferred_types', form.preferred_types.includes(t) ? form.preferred_types.filter((x) => x !== t) : [...form.preferred_types, t])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({
      company: form.company.trim(),
      industry: form.industry.trim(),
      location: form.location?.trim() || null,
      description: form.description?.trim() || null,
      interests: form.interests,
      preferred_types: form.preferred_types,
    })
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-[34px] font-bold">Company profile</h1>
      <p className="text-ink-soft">The AI uses this profile to suggest you to organizers. You never see match scores, and nobody can bid.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-6">
        <Card>
          <div className="flex flex-col gap-4">
            <TextField label="Company name" value={form.company} onChange={(e) => set('company', e.target.value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Industry" value={form.industry} onChange={(e) => set('industry', e.target.value)} />
              <TextField label="Location" value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} />
            </div>

            <div>
              <span className="font-bold" id="interests-label">
                Interests
              </span>
              <ul className="mt-2 flex flex-wrap gap-2" aria-labelledby="interests-label">
                {form.interests.map((i) => (
                  <li key={i} className="flex items-center gap-1 rounded-full bg-[#E6F1EE] py-1 pr-1 pl-3.5 font-bold text-[#0B4F44]">
                    {i}
                    <button
                      type="button"
                      onClick={() => set('interests', form.interests.filter((x) => x !== i))}
                      className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white/60"
                      aria-label={`Remove ${i}`}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <label htmlFor="new-interest" className="sr-only">
                  New interest
                </label>
                <input
                  id="new-interest"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addInterest()
                    }
                  }}
                  placeholder="For example: student tech"
                  className="min-h-12 flex-1 rounded-[10px] border border-[#C9C3B6] px-3.5"
                />
                <button type="button" onClick={addInterest} className={smallBtn.secondary}>
                  <Plus className="size-4" aria-hidden /> Add
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="about" className="font-bold">
                About your company
              </label>
              <textarea
                id="about"
                rows={3}
                value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-[#C9C3B6] px-3.5 py-2.5"
              />
            </div>

            <fieldset>
              <legend className="font-bold">What you usually give</legend>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {GIVES.map((g) => (
                  <label key={g.type} className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" checked={form.preferred_types.includes(g.type)} onChange={() => toggleGive(g.type)} className="size-5 accent-accent" />
                    {g.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Card>

        {save.isSuccess && <Notice tone="success">Profile saved. New suggestions will use it.</Notice>}
        {save.isError && <Notice tone="error">{save.error instanceof Error ? save.error.message : 'Could not save.'}</Notice>}
        <button type="submit" className={`${smallBtn.primary} min-h-13 w-fit px-6 text-base`} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </main>
  )
}
