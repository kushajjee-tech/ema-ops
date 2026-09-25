import clsx from 'clsx'
import { Activity, Bot, LayoutDashboard, Menu, Network, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { activeIncidents } from '../lib/analysis'
import { UserMenu } from './UserMenu'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/agents', label: 'AI Employees', icon: Bot },
  { to: '/runs', label: 'Runs', icon: Activity },
  { to: '/systems', label: 'Connected Systems', icon: Network },
]

const incidentCount = activeIncidents().length

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    // Pages with a #hash scroll to their own anchor.
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname, location.hash])

  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div className={clsx('flex h-14 items-center gap-2.5 border-b border-slate-800 px-4', compact && 'justify-center px-0')}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-sm font-bold text-white">E</div>
        {!compact && (
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Ema Ops</div>
            <div className="text-[11px] text-slate-400">AI Employee monitoring</div>
          </div>
        )}
      </div>
      <div className={clsx('border-b border-slate-800 p-2', compact && 'flex justify-center')}>
        <UserMenu variant="sidebar" compact={compact} />
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={compact ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                compact && 'justify-center',
                isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {!compact && <span className="flex-1">{label}</span>}
            {!compact && to === '/' && incidentCount > 0 && (
              <span title={`${incidentCount} active issue${incidentCount === 1 ? '' : 's'}`} className="rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{incidentCount}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className={clsx('border-t border-slate-800 p-3 text-[11px] text-slate-500', compact && 'hidden')}>
        Prototype · mock data
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 hidden bg-slate-900 transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-56',
        )}
      >
        {sidebar(collapsed)}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute bottom-3 right-3 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={collapsed ? { right: '50%', transform: 'translateX(50%)' } : undefined}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded p-1 text-slate-600 hover:bg-slate-100">
          <Menu className="size-5" />
        </button>
        <span className="text-sm font-semibold">Ema Ops</span>
        <div className="ml-auto">
          <UserMenu variant="topbar" />
        </div>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-60 bg-slate-900">
            {sidebar(false)}
            <button onClick={() => setMobileOpen(false)} className="absolute right-2 top-3 rounded p-1 text-slate-400" aria-label="Close navigation">
              <X className="size-4" />
            </button>
          </aside>
        </div>
      )}

      <main className={clsx('transition-[padding] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-56')}>
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
