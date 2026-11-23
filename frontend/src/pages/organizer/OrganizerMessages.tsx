import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useThreads } from '../../api/organizer'
import Conversation from '../../components/app/Conversation'
import { EmptyNote, smallBtn, Spinner } from '../../components/app/ui'
import { timeAgo } from '../../lib/format'

/**
 * Messages (prototype "Organizer · Messages", build prompt rule 6): a thread
 * opens only when the organizer sends a request. Text only, no attachments.
 */
export default function OrganizerMessages() {
  const { data: threads, isPending } = useThreads()
  const [params, setParams] = useSearchParams()
  const selected = params.get('thread')
  const thread = threads?.find((t) => t.id === selected) ?? null

  // On wide screens, open the newest conversation by default.
  useEffect(() => {
    if (!selected && threads?.length && window.matchMedia('(min-width: 1024px)').matches)
      setParams({ thread: threads[0].id }, { replace: true })
  }, [selected, threads, setParams])

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section
          className={`rounded-[14px] border border-[#E2DED5] bg-white p-3 ${thread ? 'hidden lg:block' : ''}`}
          aria-label="Conversations"
        >
          <div className="px-2 pt-2 pb-3">
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-sm text-ink-soft">A thread opens when you send a sponsor a request.</p>
          </div>
          {isPending ? (
            <Spinner />
          ) : !threads?.length ? (
            <EmptyNote>No conversations yet. Send a request from your dashboard to start one.</EmptyNote>
          ) : (
            <ul className="flex flex-col gap-1">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setParams({ thread: t.id })}
                    aria-current={t.id === selected ? 'true' : undefined}
                    className={`w-full rounded-xl px-3 py-3 text-left ${t.id === selected ? 'bg-[#E6F1EE]' : 'hover:bg-paper'}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-bold">{t.sponsor_name}</span>
                      <span className="shrink-0 text-sm text-ink-soft">{timeAgo(t.last_at)}</span>
                    </span>
                    <span className="block text-sm text-ink-soft">
                      {t.project_name} · {t.need_title}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={`line-clamp-1 text-[15px] ${t.unread ? 'font-bold' : ''}`}>
                        {t.last_message ?? 'Request sent. No reply yet.'}
                      </span>
                      {t.unread > 0 && (
                        <span className="min-w-5 rounded-full bg-coral px-1.5 text-center text-xs leading-5 font-bold text-ink">
                          {t.unread}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {thread ? (
          <Conversation
            key={thread.id}
            threadId={thread.id}
            title={thread.sponsor_name}
            summary={`About your request: ${thread.request_summary}`}
            onBack={() => setParams({})}
            headerAction={
              <Link to={`/organizer/projects/${thread.project_id}`} className={smallBtn.secondary}>
                View project
              </Link>
            }
          />
        ) : (
          <section className="hidden min-h-80 items-center justify-center rounded-[14px] border border-[#E2DED5] bg-white text-ink-soft lg:flex">
            Choose a conversation.
          </section>
        )}
      </div>
    </main>
  )
}
