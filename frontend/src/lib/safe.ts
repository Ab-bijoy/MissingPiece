/**
 * Small guards for values that come from outside the app.
 */

/** Only http(s) links may be opened; blocks javascript:, data: and similar. */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url, window.location.origin)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/**
 * One CSV cell. Quotes it, and stops spreadsheet apps from running a value
 * that starts with = + - @ (or a tab/return) as a formula ("CSV injection").
 */
export function csvCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${v.replace(/"/g, '""')}"`
}
