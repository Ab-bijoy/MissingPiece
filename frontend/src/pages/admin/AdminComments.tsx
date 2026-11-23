import { EyeOff } from 'lucide-react'
import { useState } from 'react'
import { adminApi, useAdminAction, useHiddenComments, useHiddenMessages, useRestoreComment } from '../../api/admin'
import { Card, EmptyNote, smallBtn, Spinner } from '../../components/app/ui'
import Notice from '../../components/ui/Notice'
import { timeAgo } from '../../lib/format'

/**
 * Hidden comments (prototype "Admin payments and moderation", rule 15):
 * Review comments flagged by AI, held during AI outages or hidden by organizers.
 */
export default function AdminComments() {
  const { data, isPending, error } = useHiddenComments()
  const restore = useRestoreComment()
  // "Keep hidden" changes nothing on the server; it just clears the item from this review.
  const [reviewed, setReviewed] = useState<string[]>([])
  const del = useAdminAction((id: string) => adminApi.deleteComment(id))
  const list = (data ?? []).filter((c) => !reviewed.includes(c.id))

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-[34px] font-bold">Hidden comments and messages</h1>
      <p className="text-ink-soft">Only admins can view hidden comments and messages. Restore content only if it is safe to publish and contains no phone number, email address or private home address.</p>
      {error && <Notice tone="error">{error.message}</Notice>}
      {restore.isError && <Notice tone="error">{restore.error instanceof Error ? restore.error.message : 'Could not restore.'}</Notice>}
      {del.isError && (
        <div className="mt-4">
          <Notice tone="error">{del.error instanceof Error ? del.error.message : 'Could not delete.'}</Notice>
        </div>
      )}
      <Card className="mt-6">
        {isPending ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyNote>Nothing to review.</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((c) => (
              <li key={c.id} className="rounded-xl border border-[#E2DED5] p-4">
                <p className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <EyeOff className="size-4" aria-hidden /> {c.project_name} · hidden from public view · posted {timeAgo(c.created_at).toLowerCase()}
                </p>
                <p className="mt-2">
                  <strong>{c.author_name}:</strong> {c.body}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className={smallBtn.secondary} disabled={restore.isPending || del.isPending} onClick={() => restore.mutate(c.id)}>
                    Restore comment
                  </button>
                  <button type="button" className={smallBtn.secondary} onClick={() => setReviewed((r) => [...r, c.id])}>
                    Keep hidden
                  </button>
                  <button
                    type="button"
                    className={smallBtn.primary}
                    disabled={del.isPending || restore.isPending}
                    onClick={() => confirm('Delete this comment and its replies for good? This cannot be undone.') && del.mutate(c.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <HiddenMessages />
    </main>
  )
}

function HiddenMessages() {
  const { data, isPending, error } = useHiddenMessages()
  const restore = useAdminAction((id: string) => adminApi.restoreMessage(id))
  const remove = useAdminAction((id: string) => adminApi.deleteMessage(id))
  return (
    <Card className="mt-6">
      <h2 className="text-xl font-bold">Hidden messages</h2>
      <p className="mb-4 text-sm text-ink-soft">Only admins can view these messages. Restore only safe messages without personal contact details; restoring delivers them to the conversation.</p>
      {(error || restore.error || remove.error) && <Notice tone="error">{(error || restore.error || remove.error)?.message ?? 'Could not update messages.'}</Notice>}
      {isPending ? <Spinner /> : !data?.length ? <EmptyNote>No hidden messages to review.</EmptyNote> : (
        <ul className="flex flex-col gap-3">{data.map((m) => (
          <li key={m.id} className="rounded-xl border border-[#E2DED5] p-4">
            <p className="text-sm text-ink-soft">{m.project_name} · {timeAgo(m.created_at)}</p>
            <p className="mt-2 whitespace-pre-wrap"><strong>{m.sender_name}:</strong> {m.body}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className={smallBtn.secondary} disabled={restore.isPending || remove.isPending} onClick={() => restore.mutate(m.id)}>Restore message</button>
              <button type="button" className={smallBtn.primary} disabled={restore.isPending || remove.isPending} onClick={() => confirm('Delete this hidden message permanently?') && remove.mutate(m.id)}>Delete</button>
            </div>
          </li>
        ))}</ul>
      )}
    </Card>
  )
}
