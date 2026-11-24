import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import PublicFooter from '../../../components/layout/PublicFooter'
import PublicHeader, { type SectionLink } from '../../../components/layout/PublicHeader'
import Audiences from './Audiences'
import GetStarted from './GetStarted'
import Hero from './Hero'
import HowItWorks from './HowItWorks'
import Intro from './Intro'
import Showcase from './Showcase'
import { useScrollReveal } from '../../../lib/useScrollReveal'

// The navbar links to the sections of this page, in the order they appear
const SECTIONS: SectionLink[] = [
  { id: 'about', label: 'About' },
  { id: 'who-its-for', label: 'Who it’s for' },
  { id: 'how-it-works', label: 'How it works' },
  { id: 'get-started', label: 'Find your place' },
]

/** Main landing page for logged-out visitors. */
export default function Landing() {
  const { hash } = useLocation()
  const main = useScrollReveal<HTMLElement>()

  // Router links like "/#how-it-works" don't scroll on their own.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  return (
    <>
      <PublicHeader sections={SECTIONS} joinMenu />
      <main ref={main} className="landing-sections">
        <Hero />
        <Intro />
        <Showcase />
        <Audiences />
        <HowItWorks />
        <GetStarted />
      </main>
      <PublicFooter />
    </>
  )
}
