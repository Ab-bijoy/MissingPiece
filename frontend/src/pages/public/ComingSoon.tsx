import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicFooter from '../../components/layout/PublicFooter'
import PublicHeader from '../../components/layout/PublicHeader'

/** Temporary page for routes whose designs have not arrived yet. */
export default function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <PublicHeader />
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-start justify-center gap-6 px-4 py-24">
        <h1 className="font-display text-6xl font-extrabold text-brand uppercase">{title}</h1>
        <p className="text-lg text-ink-soft">This screen is next on the list.</p>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 font-bold text-sand-light hover:bg-brand-dark"
        >
          <ArrowLeft className="size-5" aria-hidden /> Back to home
        </Link>
      </main>
      <PublicFooter />
    </>
  )
}
