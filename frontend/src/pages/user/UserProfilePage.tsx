import { Plus, ShieldCheck, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useMyProfile, userApi, useUserAction } from '../../api/user'
import type { MyProfile } from '../../api/types'
import Notice from '../../components/ui/Notice'
import { card, ubtn } from './bits'
import { useLargeText } from './UserLayout'

/** My profile (prototype "UserProfile"): name, age, skills, things to lend, large text. */
export default function UserProfilePage() {
  const { data, isPending } = useMyProfile()
  const { large, setLarge } = useLargeText()
  const [form, setForm] = useState<{ name: string; age: string; skills: string[]; items: string[] } | null>(null)
  const [ageError, setAgeError] = useState<string | null>(null)
  const save = useUserAction((body: Partial<MyProfile>) => userApi.saveProfile(body))

  useEffect(() => {
    if (data && !form) setForm({ name: data.name, age: data.age == null ? '' : String(data.age), skills: data.skills, items: data.items })
  }, [data, form])

  if (isPending || !form) return <p className="p-10 text-center text-ink-soft">Loading…</p>

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (form.age && !(/^\d+$/.test(form.age) && Number(form.age) <= 130)) {
      setAgeError('Please enter your age as a number.')
      return
    }
    setAgeError(null)
    save.mutate({ name: form.name.trim(), age: form.age ? Number(form.age) : null, skills: form.skills, items: form.items })
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <h1 className="text-3xl font-bold">My profile</h1>
      <p className="mt-2 flex gap-2 rounded-xl bg-[#E3F1E8] px-4 py-3 text-user-accent">
        <ShieldCheck className="mt-1 size-5 shrink-0" aria-hidden />
        Your home address is never asked for or shown. Only organizers of events you join can see your age.
      </p>

      <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
        <section className={`${card} flex flex-col gap-4`}>
          <label className="font-semibold">
            Your name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1.5 block min-h-13 w-full rounded-xl border border-black/20 px-4 font-normal"
              autoComplete="name"
            />
          </label>
          <label className="font-semibold">
            Your age
            <input
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              inputMode="numeric"
              aria-invalid={ageError ? true : undefined}
              className="mt-1.5 block min-h-13 w-full max-w-40 rounded-xl border border-black/20 px-4 font-normal"
            />
            {ageError && <span className="mt-1 block text-warning">{ageError}</span>}
          </label>
        </section>

        <ChipList title="Skills I can share" addLabel="Add a skill" placeholder="For example: tailoring" values={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
        <ChipList title="Things I can lend" addLabel="Add an item" placeholder="For example: sewing machine" values={form.items} onChange={(items) => setForm({ ...form, items })} />

        <section className={card}>
          <h2 className="text-xl font-bold">Reading comfort</h2>
          <label className="mt-3 flex min-h-12 items-center gap-3">
            <input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} className="size-6 accent-user-accent" />
            Always use large text
          </label>
          <p className="text-sm text-ink-soft">This changes right away and is remembered on this device.</p>
        </section>

        {save.isSuccess && <Notice tone="success">Saved. Thank you!</Notice>}
        {save.isError && <Notice tone="error">{save.error instanceof Error ? save.error.message : 'Could not save.'}</Notice>}
        <button type="submit" className={`${ubtn.primary} min-h-14 text-lg`} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </main>
  )
}

function ChipList({
  title,
  addLabel,
  placeholder,
  values,
  onChange,
}: {
  title: string
  addLabel: string
  placeholder: string
  values: string[]
  onChange: (v: string[]) => void
}) {
  const [text, setText] = useState('')
  const id = title.replace(/\s+/g, '-').toLowerCase()
  const add = () => {
    const v = text.trim()
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
    setText('')
  }
  return (
    <section className={card} aria-labelledby={id}>
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {values.length === 0 && <li className="text-ink-soft">None yet.</li>}
        {values.map((v) => (
          <li key={v} className="flex items-center gap-1 rounded-full bg-[#E3F1E8] py-1 pr-1 pl-4 font-semibold text-user-accent">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/70" aria-label={`Remove ${v}`}>
              <X className="size-5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <label className="flex-1">
          <span className="sr-only">{addLabel}</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            placeholder={placeholder}
            className="min-h-12 w-full rounded-xl border border-black/20 px-4"
          />
        </label>
        <button type="button" onClick={add} className={ubtn.soft}>
          <Plus className="size-5" aria-hidden /> {addLabel}
        </button>
      </div>
    </section>
  )
}
