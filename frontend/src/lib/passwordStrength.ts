/**
 * Password rules and a strength score, shared by sign-up and "set a new password".
 *
 * The hard rules match the Supabase setting (Authentication > Sign In / Providers >
 * Email): at least 8 characters with lowercase, uppercase letters and digits.
 * We also cap passwords at 10 characters (MAX_LENGTH); Supabase has no maximum setting.
 * Supabase checks them again on its side, so they cannot be skipped.
 * On top of that we refuse very common passwords and ones built from the email or name.
 */

export const MIN_LENGTH = 8
export const MAX_LENGTH = 10

// The most common passwords (and simple variations people use to pass the rules)
const COMMON = new Set([
  'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword1', 'qwerty123', 'qwerty1234',
  'qwertyuiop', 'letmein1', 'welcome1', 'welcome123', 'admin123', 'iloveyou1', 'abc12345', 'abcd1234', 'aa123456',
  '12345678', '123456789', '1234567890', '11111111', '00000000', 'football1', 'monkey123', 'dragon123', 'sunshine1',
  'princess1', 'baseball1', 'master123', 'shadow123', 'trustno1', 'starwars1', 'bangladesh1', 'bangladesh123',
  'dhaka1234', 'missingpiece', 'missingpiece1', 'changeme1', 'test1234', 'testtest1', 'zaq12wsx', '1q2w3e4r', '1qaz2wsx',
])

export type Rule = { label: string; met: boolean }

export type PasswordCheck = {
  /** 0 too weak, 1 weak, 2 fair, 3 good, 4 strong */
  score: 0 | 1 | 2 | 3 | 4
  label: 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
  /** Every rule is met: the password may be used */
  ok: boolean
  rules: Rule[]
  /** One plain-words tip for the first thing to fix, or to make it stronger */
  tip: string | null
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'] as const

function hasSequence(pw: string): boolean {
  const s = pw.toLowerCase()
  for (let i = 0; i + 3 < s.length; i++) {
    const a = s.charCodeAt(i)
    const up = [1, 2, 3].every((k) => s.charCodeAt(i + k) === a + k)
    const down = [1, 2, 3].every((k) => s.charCodeAt(i + k) === a - k)
    if (up || down) return true // 1234, abcd, 4321
  }
  return /(.)\1{3,}/.test(s) // aaaa, 1111
}

/** Parts of the email or name that should not appear in the password. */
function personalBits(personal: (string | undefined)[]): string[] {
  return personal
    .flatMap((v) => (v ?? '').toLowerCase().split(/[@.\s_+-]+/))
    .filter((bit) => bit.length >= 4)
}

export function checkPassword(pw: string, personal: (string | undefined)[] = []): PasswordCheck {
  const lower = /[a-z]/.test(pw)
  const upper = /[A-Z]/.test(pw)
  const digit = /\d/.test(pw)
  const symbol = /[^A-Za-z0-9]/.test(pw)
  const lowered = pw.toLowerCase()
  const common = COMMON.has(lowered) || COMMON.has(lowered.replace(/[^a-z0-9@]/g, ''))
  const usesPersonal = personalBits(personal).some((bit) => lowered.includes(bit))

  const rules: Rule[] = [
    { label: `${MIN_LENGTH} to ${MAX_LENGTH} characters`, met: pw.length >= MIN_LENGTH && pw.length <= MAX_LENGTH },
    { label: 'A lowercase and an uppercase letter', met: lower && upper },
    { label: 'At least one number', met: digit },
    { label: 'Not a common password, and not your email or name', met: pw.length > 0 && !common && !usesPersonal },
  ]
  const ok = rules.every((r) => r.met)

  // Score: length and variety, minus easy-to-guess patterns
  let score = 0
  if (pw.length >= MIN_LENGTH) score++
  if (pw.length >= MAX_LENGTH) score++ // the longest allowed
  const kinds = [lower, upper, digit, symbol].filter(Boolean).length
  if (kinds >= 3) score++
  if (kinds === 4) score++
  if (hasSequence(pw)) score--
  if (!ok) score = Math.min(score, 1) // a password that breaks a rule is never "fair" or better
  const clamped = Math.max(0, Math.min(4, pw.length === 0 ? 0 : score)) as PasswordCheck['score']
  const final = ok ? (Math.max(clamped, 2) as PasswordCheck['score']) : clamped

  let tip: string | null = null
  if (pw.length === 0) tip = null
  else if (common) tip = 'This is one of the most common passwords. Choose something less easy to guess.'
  else if (usesPersonal) tip = 'Do not use your email or name in your password.'
  else if (pw.length < MIN_LENGTH) tip = `Add ${MIN_LENGTH - pw.length} more character${MIN_LENGTH - pw.length === 1 ? '' : 's'}.`
  else if (pw.length > MAX_LENGTH) tip = `Use at most ${MAX_LENGTH} characters.`
  else if (!(lower && upper)) tip = 'Mix lowercase and uppercase letters.'
  else if (!digit) tip = 'Add a number.'
  else if (final < 4) tip = `To make it stronger, use all ${MAX_LENGTH} characters and add a symbol like ! or #.`

  return { score: final, label: LABELS[final], ok, rules, tip }
}
