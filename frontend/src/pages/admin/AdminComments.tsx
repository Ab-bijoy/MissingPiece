import { EyeOff } from 'lucide-react'
import { useState } from 'react'
import { adminApi, useAdminAction, useHiddenComments, useRestoreComment } from '../../api/admin'
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
      <h1 className="text-[34px] font-bold">Hidden comments</h1>
      <p className="text-ink-soft">Comments hidden for harmful content or personal contact details, held when AI could not check them, or hidden by organizers. Only admins can view hidden comments. Restore a comment only if it is safe to publish and contains no phone number, email address or private home address.</p>
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
    </main>
  )
}
