import { useState } from 'react'
import { refreshAfter, userApi, useUserAction } from '../../api/user'
import Notice from '../../components/ui/Notice'
import { ubtn } from './bits'

export default function LeaveProgramButton({ programId }: { programId: string }) {
  const [confirming, setConfirming] = useState(false)
  const leave = useUserAction(() => userApi.leave(programId), () => refreshAfter.join(programId))
  return (
    <div>
      <button
        type="button"
        className={ubtn.ghost}
        disabled={leave.isPending}
        onClick={() => setConfirming(true)}
      >
        {leave.isPending ? 'Cancelling…' : "I can't come any more"}
      </button>
      {confirming && (
        <div role="group" aria-label="Confirm attendance cancellation" className="mt-2 rounded-xl bg-user-bg p-3">
          <p>Your seat will become available to someone else.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={ubtn.primary} disabled={leave.isPending} onClick={() => leave.mutate(undefined)}>
              {leave.isPending ? 'Cancelling…' : 'Confirm cancellation'}
            </button>
            <button type="button" className={ubtn.soft} disabled={leave.isPending} onClick={() => setConfirming(false)}>Keep my seat</button>
          </div>
        </div>
      )}
      {leave.isError && <Notice tone="error">{leave.error instanceof Error ? leave.error.message : 'Could not cancel attendance.'}</Notice>}
    </div>
  )
}
