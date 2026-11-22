import { Paperclip } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const control =
  'mt-1.5 block min-h-13 w-full rounded-[10px] border border-[#C9C3B6] bg-white px-3.5 text-[17px] font-normal text-ink placeholder:text-[#8C857A] focus:border-brand focus:outline-3 focus:outline-offset-0 focus:outline-brand/25 aria-invalid:border-warning'

type Common = { label: string; hint?: ReactNode; error?: string | null }

function Messages({ id, hint, error }: { id: string; hint?: ReactNode; error?: string | null }) {
  return (
    <>
      {hint && (
        <span id={`${id}-hint`} className="mt-1 block text-[15px] font-normal text-ink-soft">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className="mt-1 block text-[15px] font-bold text-warning" role="alert">
          {error}
        </span>
      )}
    </>
  )
}

const describedBy = (id: string, hint?: ReactNode, error?: string | null) =>
  [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined

export function TextField({ label, hint, error, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <input
        id={id}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  )
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <select
        id={id}
        className={control}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...props}
      >
        {children}
      </select>
      <Messages id={id} hint={hint} error={error} />
    </div>
  )
}

/** File picker for proof documents: PDF, JPG or PNG, up to 5 MB. */
export function FileField({
  label,
  hint,
  error,
  file,
  onFile,
  accept = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
}: Common & { file: File | null; onFile: (f: File | null) => void; accept?: string }) {
  const id = useId()
  return (
    <div>
      <span className="font-bold">{label}</span>
      <Messages id={id} hint={hint} />
      <label
        htmlFor={id}
        className="mt-1.5 flex min-h-13 cursor-pointer items-center gap-3 rounded-[10px] border border-dashed border-[#C9C3B6] bg-paper px-3.5 hover:border-brand"
      >
        <Paperclip className="size-5 shrink-0 text-brand" aria-hidden />
        <span className={file ? 'font-bold break-all text-ink' : 'text-ink-soft'}>
          {file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : 'Choose a file'}
        </span>
      </label>
      <input
        id={id}
        type="file"
        accept={accept}
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
      <Messages id={id} error={error} />
    </div>
  )
}

/** Checks a proof document before upload (matches the back-end rule). */
export function fileProblem(file: File | null): string | null {
  if (!file) return 'Please attach the document.'
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) return 'The document must be a PDF, JPG or PNG.'
  if (file.size > 5 * 1024 * 1024) return 'The document must be 5 MB or smaller.'
  return null
}
