import { useEffect, useId, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  /** Shown inside the dialog, e.g. the server's reason it did not work */
  error?: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * A centered confirmation dialog over a dimmed page (the browser's own modal
 * <dialog>): focus moves into it and stays there, Escape or the cancel button
 * closes it, and the page behind cannot be clicked meanwhile.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  busy = false,
  error,
  onConfirm,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const textId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={children ? textId : undefined}
      onCancel={(e) => {
        e.preventDefault() // Escape: close through React state so both stay in step
        if (!busy) onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose() // a click on the dimmed area
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-ink shadow-xl backdrop:bg-black/45"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        {children && (
          <div id={textId} className="mt-2 text-ink-soft">
            {children}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-[#FBEBDD] px-4 py-3 font-semibold text-warning">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            autoFocus
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#E3F1E8] px-5 font-semibold text-user-accent hover:bg-[#D3E9DB] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-warning px-5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
