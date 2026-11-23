import { useState } from 'react'
import { refreshAfter, userApi, useUserAction } from '../../api/user'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { ubtn } from './bits'

/** "I can't come any more" for participants: confirms in a modal, then frees the seat. */
export default function LeaveProgramButton({ programId, programName }: { programId: string; programName?: string }) {
  const [open, setOpen] = useState(false)
  const leave = useUserAction(() => userApi.leave(programId), () => refreshAfter.join(programId))

  return (
    <>
      <button
        type="button"
        className={ubtn.ghost}
        disabled={leave.isPending}
        onClick={() => {
          leave.reset()
          setOpen(true)
        }}
      >
        {leave.isPending ? 'Cancelling…' : "I can't come any more"}
      </button>
      <ConfirmDialog
        open={open}
        title="Cancel your seat?"
        confirmLabel={leave.isPending ? 'Cancelling…' : 'Yes, cancel my seat'}
        cancelLabel="Keep my seat"
        busy={leave.isPending}
        error={leave.isError ? (leave.error instanceof Error ? leave.error.message : 'Could not cancel your seat.') : null}
        onClose={() => setOpen(false)}
        onConfirm={() => leave.mutate(undefined, { onSuccess: () => setOpen(false) })}
      >
        {programName ? (
          <>
            You will no longer attend <strong className="text-ink">{programName}</strong>. Your seat becomes available to someone
            else.
          </>
        ) : (
          'Your seat becomes available to someone else.'
        )}
      </ConfirmDialog>
    </>
  )
}
