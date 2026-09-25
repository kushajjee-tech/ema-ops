import clsx from 'clsx'
import { Bell, ChevronsUpDown, History, LogOut, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useConfirm } from '../lib/actions'
import { CURRENT_USER } from '../lib/activity'

export function Avatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-emerald-600 font-semibold text-white',
        size === 'sm' && 'size-7 text-[11px]',
        size === 'md' && 'size-8 text-xs',
        size === 'lg' && 'size-16 text-xl',
      )}
    >
      {CURRENT_USER.initials}
    </span>
  )
}

/**
 * Signed-in user control. `variant="sidebar"` renders the full profile block (or just the avatar
 * when the sidebar is collapsed); `variant="topbar"` renders the avatar only, for small screens.
 */
export function UserMenu({ variant, compact }: { variant: 'sidebar' | 'topbar'; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const confirm = useConfirm()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.hash])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${CURRENT_USER.name}`}
        title={compact ? `${CURRENT_USER.name} · ${CURRENT_USER.role}` : undefined}
        className={clsx(
          'flex items-center gap-2.5 rounded-md text-left transition-colors',
          variant === 'sidebar' && 'w-full px-2 py-1.5 hover:bg-slate-800',
          variant === 'sidebar' && open && 'bg-slate-800',
          variant === 'sidebar' && compact && 'justify-center px-0',
        )}
      >
        <Avatar size={variant === 'topbar' ? 'sm' : 'md'} />
        {variant === 'sidebar' && !compact && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-slate-100">{CURRENT_USER.name}</span>
              <span className="block truncate text-[11px] text-slate-400">{CURRENT_USER.role}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-slate-500" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute z-50 w-64 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl',
            variant === 'topbar' && 'right-0 top-full mt-2',
            variant === 'sidebar' && !compact && 'left-0 top-full mt-1.5',
            variant === 'sidebar' && compact && 'left-full top-0 ml-2',
          )}
        >
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-slate-900">{CURRENT_USER.name}</div>
              <div className="truncate text-xs text-slate-500">{CURRENT_USER.email}</div>
            </div>
          </div>
          <div className="px-2.5 pb-2">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
              {CURRENT_USER.role}
            </span>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <Link role="menuitem" to="/profile" className={item}>
            <UserRound className="size-4 text-slate-400" /> View profile
          </Link>
          <Link role="menuitem" to="/profile#activity" className={item}>
            <History className="size-4 text-slate-400" /> My activity
          </Link>
          <Link role="menuitem" to="/profile#notifications" className={item}>
            <Bell className="size-4 text-slate-400" /> Notification preferences
          </Link>
          <div className="my-1 border-t border-slate-100" />
          <button
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false)
              confirm({
                title: 'Sign out?',
                body: 'You will need to sign in again to access Ema Ops.',
                confirmLabel: 'Sign out',
                onConfirm: () => toast('Sign-out is disabled in this prototype (no real authentication).'),
              })
            }}
          >
            <LogOut className="size-4 text-slate-400" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
