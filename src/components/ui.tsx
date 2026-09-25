import clsx from 'clsx'
import { AlertTriangle, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { SYSTEM_BY_ID } from '../data/catalog'
import type { RunStatus, StepStatus, SystemId } from '../data/types'
import type { Health, SystemHealth } from '../lib/analysis'
import { HEALTH, RUN_STATUS, STEP_STATUS, SYSTEM_HEALTH, type Tone } from '../lib/status'

export function Pill({ tone, children, pulse, icon, className }: { tone: Tone; children?: ReactNode; pulse?: boolean; icon?: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tone.pill,
        className,
      )}
    >
      {icon ?? (
        <span className="relative flex size-1.5">
          {pulse && <span className={clsx('absolute inline-flex size-full animate-ping rounded-full opacity-75', tone.dot)} />}
          <span className={clsx('relative inline-flex size-1.5 rounded-full', tone.dot)} />
        </span>
      )}
      {children ?? tone.label}
    </span>
  )
}

export function StatusPill({ status, className }: { status: RunStatus; className?: string }) {
  const tone = RUN_STATUS[status]
  return (
    <Pill
      tone={tone}
      pulse={status === 'in_progress'}
      icon={status === 'stuck' ? <AlertTriangle className="size-3" strokeWidth={2.5} /> : undefined}
      className={className}
    />
  )
}

export function StepStatusPill({ status }: { status: StepStatus }) {
  return <Pill tone={STEP_STATUS[status]} pulse={status === 'running'} />
}

export function HealthPill({ health }: { health: Health }) {
  return <Pill tone={HEALTH[health]} />
}

export function SystemHealthPill({ health }: { health: SystemHealth }) {
  return <Pill tone={SYSTEM_HEALTH[health]} pulse={health === 'down'} />
}

export function SystemBadge({ id, size = 'sm', withName }: { id: SystemId; size?: 'xs' | 'sm'; withName?: boolean }) {
  const s = SYSTEM_BY_ID[id]
  const badge = (
    <span
      title={s.name}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded font-bold text-white',
        size === 'xs' ? 'h-4 min-w-4 px-0.5 text-[8px]' : 'h-5 min-w-5 px-1 text-[9px]',
      )}
      style={{ backgroundColor: s.color }}
    >
      {s.badge}
    </span>
  )
  if (!withName) return badge
  return (
    <span className="inline-flex items-center gap-1.5">
      {badge}
      <span className="text-slate-700">{s.name}</span>
    </span>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-lg border border-slate-200 bg-white', className)}>{children}</div>
}

export function CardHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function StatCard({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <Card className="px-3.5 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={clsx('mt-0.5 text-xl font-semibold tabular-nums', accent ?? 'text-slate-900')}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      {icon}
      <div className="mt-2 text-sm font-medium text-slate-800">{title}</div>
      {children && <div className="mt-1 max-w-md text-xs text-slate-500">{children}</div>}
    </div>
  )
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; size?: 'sm' | 'md' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
        variant === 'primary' && 'bg-indigo-600 text-white hover:bg-indigo-700',
        variant === 'secondary' && 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        variant === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={clsx('flex max-h-[85vh] w-full flex-col rounded-lg bg-white shadow-xl', wide ? 'max-w-3xl' : 'max-w-md')}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-auto px-4 py-3 text-sm text-slate-700">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Sparkline({ values, color, width = 96, height = 28 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values, 0.5)
  const max = 1
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={width} height={height} className="overflow-visible" aria-label="7-day success rate trend">
      <path d={`${d} L${x(values.length - 1)},${height} L${x(0)},${height} Z`} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={2.2} fill={color} />
    </svg>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            value === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function MiniBar({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
      <div className={clsx('h-full rounded-full', tone.dot)} style={{ width: `${Math.min(100, Math.max(value * 100, value > 0 ? 4 : 0))}%` }} />
    </div>
  )
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}
