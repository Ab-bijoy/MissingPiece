import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import PublicFooter from '../../../components/layout/PublicFooter'
import PublicHeader from '../../../components/layout/PublicHeader'
import Audiences from './Audiences'
import GetStarted from './GetStarted'
import Hero from './Hero'
import HowItWorks from './HowItWorks'
import Intro from './Intro'
import Showcase from './Showcase'

/** Main landing page for logged-out visitors. */
export default function Landing() {
  const { hash } = useLocation()

  // Router links like "/#how-it-works" don't scroll on their own.
  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [hash])

  return (
    <>
      <PublicHeader hideLogin />
      <main>
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
