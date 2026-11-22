import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

/**
 * Six large boxes for the email code (build prompt 9.2): moves to the next box
 * as you type, back on Backspace, and fills every box from a pasted code.
 */
export default function OtpInput({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  const focus = (i: number) => refs.current[Math.max(0, Math.min(5, i))]?.focus()

  function setAt(i: number, d: string) {
    const next = digits.slice()
    next[i] = d
    onChange(next.join('').slice(0, 6))
  }

  function handleInput(i: number, raw: string) {
    const only = raw.replace(/\D/g, '')
    if (!only) return setAt(i, '')
    if (only.length > 1) return fill(i, only)
    setAt(i, only)
    focus(i + 1)
  }

  function fill(from: number, text: string) {
    const next = digits.slice()
    text
      .replace(/\D/g, '')
      .slice(0, 6 - from)
      .split('')
      .forEach((d, k) => (next[from + k] = d))
    onChange(next.join(''))
    focus(Math.min(5, from + text.length))
  }

  function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i]) {
      e.preventDefault()
      setAt(i - 1, '')
      focus(i - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focus(i + 1)
    }
  }

  function handlePaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    fill(i, e.clipboardData.getData('text'))
  }

  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">6-digit code</legend>
      <div className="flex justify-center gap-2 sm:gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            aria-label={`Digit ${i + 1}`}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            onFocus={(e) => e.target.select()}
            aria-invalid={invalid || undefined}
            className={`h-17 w-12 rounded-xl border-2 text-center text-[30px] font-bold text-ink focus:outline-3 focus:outline-offset-1 focus:outline-brand/30 sm:w-14 ${
              invalid ? 'border-warning' : d ? 'border-accent' : 'border-[#8C857A]'
            }`}
          />
        ))}
      </div>
    </fieldset>
  )
}
