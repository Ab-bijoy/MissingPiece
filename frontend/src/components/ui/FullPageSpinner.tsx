import { LoaderCircle } from 'lucide-react'

export default function FullPageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-paper" role="status">
      <LoaderCircle className="size-10 animate-spin text-brand" aria-hidden />
      <span className="sr-only">{label}…</span>
    </div>
  )
}
