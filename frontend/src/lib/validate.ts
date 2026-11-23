/** Shared input rules. The backend checks the same (backend/app/schemas/common.py). */

export const AGE_MIN = 13
export const AGE_MAX = 100

/** Age is optional; when given it must be a whole number from 13 to 100. */
export function ageProblem(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (!/^\d{1,3}$/.test(v) || Number(v) < AGE_MIN || Number(v) > AGE_MAX) return `Enter an age from ${AGE_MIN} to ${AGE_MAX}.`
  return null
}

/**
 * Only digits, at most `max` of them, for typing or pasting into number fields.
 * Do not also set maxLength on the input: it would cut a pasted "017-1234-5678" before the dashes are removed.
 */
export const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

/** An 11-digit Bangladeshi mobile number, like 01712345678. */
export function phoneProblem(value: string): string | null {
  if (!/^01[3-9]\d{8}$/.test(value.trim())) return 'Enter an 11-digit mobile number, like 01712345678.'
  return null
}
