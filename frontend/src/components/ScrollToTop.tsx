import { useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Opens every new page at the top. React Router keeps the old scroll position
 * by default, so without this you land half way down the next page.
 *
 * - Only a change of page (pathname) scrolls; ?query changes such as picking a
 *   request in the inbox do not.
 * - Links to a section (#how-it-works) are left to the page, which scrolls there.
 * - The browser's Back and Forward buttons keep their own position.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navType = useNavigationType()

  useLayoutEffect(() => {
    if (hash || navType === 'POP') return
    // 'instant' overrides the smooth scrolling set on <html> for in-page links.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
