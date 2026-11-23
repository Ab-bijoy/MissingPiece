import { useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { uqk, useOrgProfile, userApi } from '../../api/user'
import { useMutation } from '@tanstack/react-query'
import type { OrgType } from '../../api/types'
import { Card, smallBtn, Spinner } from '../../components/app/ui'
import { TextField } from '../../components/ui/Field'
import Notice from '../../components/ui/Notice'

const ORG_TYPE: Record<OrgType, string> = { ngo: 'NGO', university: 'University club or office', community_group: 'Community group' }

/**
 * Organization profile. Contact details can be edited; the organization type
 * and registration number were checked by an admin, so they are read-only.
 * Uses GET/PATCH /organizer/profile (to add to the API: not in the build prompt).
 */
export default function OrganizerProfilePage() {
  const { data, isPending } = useOrgProfile()
  const qc = useQueryClient()
  const [form, setForm] = useState({ org_name: '', contact_person: '', phone: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => userApi.saveOrgProfile({ org_name: form.org_name.trim(), contact_person: form.contact_person.trim(), phone: form.phone.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: uqk.orgProfile })
      void qc.invalidateQueries({ queryKey: ['me'] })
    },
  })

  useEffect(() => {
    if (data) setForm({ org_name: data.org_name, contact_person: data.contact_person, phone: data.phone })
  }, [data])

  if (isPending || !data) return <Spinner />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.org_name.trim()) errs.org_name = 'Please enter the organization name.'
    if (!form.contact_person.trim()) errs.contact_person = 'Please enter a contact person.'
    if (!/^[+\d][\d\s-]{6,}$/.test(form.phone.trim())) errs.phone = 'Please enter a phone number.'
    setErrors(errs)
    if (!Object.keys(errs).length) save.mutate()
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-[34px] font-bold">Organization profile</h1>
      <p className="text-ink-soft">Sponsors and people who join your events see your organization name. Contact details help the MissingPiece team reach you.</p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-6" noValidate>
        <Card title="Contact details">
          <div className="flex flex-col gap-4">
            <TextField label="Organization name" value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} error={errors.org_name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Contact person" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} error={errors.contact_person} />
              <TextField label="Phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
            </div>
          </div>
        </Card>

        <Card
          title="Checked by MissingPiece"
          aside={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F1EE] px-3 py-1 text-sm font-bold text-[#0B4F44]">
              <BadgeCheck className="size-4" aria-hidden /> {data.status === 'active' ? 'Approved' : 'Waiting for approval'}
            </span>
          }
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <ReadOnly label="Work email" value={data.email} />
            <ReadOnly label="Organization type" value={ORG_TYPE[data.org_type]} />
            <ReadOnly label="Registration or approval number" value={data.registration_number} />
          </dl>
          <p className="mt-4 flex gap-2 text-[15px] text-ink-soft">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            An admin checked these against your proof document. To change them, contact the MissingPiece team.
          </p>
        </Card>

        {save.isSuccess && <Notice tone="success">Profile saved.</Notice>}
        {save.isError && <Notice tone="error">{save.error instanceof Error ? save.error.message : 'Could not save.'}</Notice>}
        <button type="submit" className={`${smallBtn.primary} min-h-13 w-fit px-6 text-base`} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </main>
  )
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[15px] text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-bold break-all">{value}</dd>
    </div>
  )
}
