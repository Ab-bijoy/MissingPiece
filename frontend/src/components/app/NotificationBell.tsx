import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { organizerApi, qk, useNotifications } from '../../api/organizer'
import { timeAgo } from '../../lib/format'

/** The bell polls GET /notifications every 30 seconds (build prompt 9.4). */
export default function NotificationBell() {
  const { data = [] } = useNotifications()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  // On phones the panel spans the screen just below the bell (it would hang off the left edge otherwise)
  const [panelTop, setPanelTop] = useState(80)
  const box = useRef<HTMLDivElement>(null)
  const toggle = () => {
    const bell = box.current?.getBoundingClientRect()
    if (bell) setPanelTop(Math.round(bell.bottom + 8))
    setOpen((v) => !v)
  }
  const unread = data.filter((n) => !n.read).length

  const refresh = () => qc.invalidateQueries({ queryKey: qk.notifications })
  const readOne = useMutation({ mutationFn: organizerApi.readNotification, onSettled: refresh })
  const readAll = useMutation({ mutationFn: organizerApi.readAllNotifications, onSettled: refresh })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-sand-light hover:bg-white/10"
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-5 rounded-full bg-coral px-1 text-center text-xs leading-5 font-bold text-ink">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{ '--panel-top': `${panelTop}px` } as CSSProperties}
          className="z-50 overflow-hidden rounded-2xl border border-[#E2DED5] bg-white text-ink shadow-xl max-sm:fixed max-sm:inset-x-3 max-sm:top-(--panel-top) sm:absolute sm:right-0 sm:mt-2 sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-[#E2DED5] px-4 py-3">
            <h2 className="font-bold">Notifications</h2>
            {unread > 0 && (
              <button type="button" onClick={() => readAll.mutate()} className="min-h-11 text-[15px] font-bold text-accent">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {data.length === 0 && <li className="px-4 py-6 text-center text-ink-soft">Nothing new yet.</li>}
            {data.map((n) => (
              <li key={n.id} className="border-b border-[#F0EDE6] last:border-0">
                <button
                  type="button"
                  onClick={() => !n.read && readOne.mutate(n.id)}
                  className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-paper ${n.read ? '' : 'bg-[#F2F8F7]'}`}
                >
                  <span
                    className={`mt-2 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-accent'}`}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-[15px]">
                      {n.text}
                      {!n.read && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className="text-sm text-ink-soft">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
