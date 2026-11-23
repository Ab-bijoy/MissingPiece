import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { organizerApi, qk, useMessages } from '../../api/organizer'
import { useAuth } from '../../auth/AuthProvider'
import { timeAgo } from '../../lib/format'
import Notice from '../ui/Notice'
import { smallBtn, Spinner } from './ui'

/**
 * One organizer–sponsor message thread (build prompt rule 6): text only, and
 * only the two people the thread was opened for can post. Used on the
 * organizer Messages page and the sponsor request page.
 */
export default function Conversation({
  threadId,
  title,
  summary,
  headerAction,
  onBack,
  minHeight = 'min-h-[520px]',
}: {
  threadId: string
  title: string
  summary?: string
  headerAction?: ReactNode
  /** Shows a back arrow on small screens */
  onBack?: () => void
  minHeight?: string
}) {
  const { me } = useAuth()
  const { data: messages, isPending } = useMessages(threadId)
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const inputId = `msg-${threadId}`

  const send = useMutation({
    mutationFn: () => organizerApi.sendMessage(threadId, text.trim()),
    onSuccess: () => setText(''),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.messages(threadId) })
      void qc.invalidateQueries({ queryKey: qk.threads })
    },
  })

  // Opening a thread marks it read on the server; refresh the unread counts.
  useEffect(() => {
    if (messages) void qc.invalidateQueries({ queryKey: qk.threads })
  }, [messages?.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the newest message in view by scrolling the message box itself, never
  // the page (the request page shows this panel below other content).
  useEffect(() => {
    const box = list.current
    if (box) box.scrollTop = box.scrollHeight
  }, [messages?.length])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim()) send.mutate()
  }

  return (
    <section className={`flex ${minHeight} flex-col overflow-hidden rounded-[14px] border border-[#E2DED5] bg-white`} aria-label={`Conversation with ${title}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DED5] px-5 py-4">
        <div className="flex items-center gap-2">
          {onBack && (
            <button type="button" onClick={onBack} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-paper lg:hidden" aria-label="Back to conversations">
              <ArrowLeft aria-hidden />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            {summary && <p className="text-sm text-ink-soft">{summary}</p>}
          </div>
        </div>
        {headerAction}
      </header>

      <div ref={list} className="flex max-h-[60vh] flex-1 flex-col gap-3 overflow-y-auto px-5 py-5" aria-live="polite">
        {isPending && <Spinner />}
        {messages?.length === 0 && <p className="text-center text-ink-soft">No messages yet. Say hello.</p>}
        {messages?.map((m) => {
          const mine = m.sender_id === me?.id
          return (
            <div key={m.id} className={`max-w-[80%] rounded-xl px-4 py-2.5 ${mine ? 'self-end bg-[#E6F1EE]' : 'self-start bg-paper'}`}>
              <div className="text-xs text-ink-soft">
                {mine ? 'You' : m.sender_name} · {timeAgo(m.created_at)}
              </div>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          )
        })}
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-[#E2DED5] px-5 py-4">
        <label htmlFor={inputId} className="sr-only">
          Message to {title}
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message"
          className="min-h-12 flex-1 rounded-[10px] border border-[#C9C3B6] px-3.5"
          autoComplete="off"
        />
        <button type="submit" className={`${smallBtn.primary} min-h-12`} disabled={send.isPending || !text.trim()}>
          <Send className="size-4" aria-hidden /> Send
        </button>
      </form>
      {send.isError && (
        <div className="px-5 pb-4">
          <Notice tone="error">{send.error instanceof Error ? send.error.message : 'Could not send.'}</Notice>
        </div>
      )}
    </section>
  )
}
