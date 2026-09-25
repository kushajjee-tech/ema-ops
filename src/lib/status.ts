import type { RunStatus, StepStatus } from '../data/types'
import type { Health, SystemHealth } from './analysis'

/**
 * Single source of truth for status colors. Every screen reads from here so a color
 * always means the same thing.
 */
export interface Tone {
  label: string
  /** Pill background + text + ring classes. */
  pill: string
  dot: string
  /** Hex for charts. */
  hex: string
}

export const RUN_STATUS: Record<RunStatus, Tone> = {
  success: { label: 'Success', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', hex: '#10b981' },
  failed: { label: 'Failed', pill: 'bg-red-50 text-red-700 ring-red-600/20', dot: 'bg-red-500', hex: '#ef4444' },
  partial: { label: 'Partial', pill: 'bg-amber-50 text-amber-800 ring-amber-600/25', dot: 'bg-amber-400', hex: '#f59e0b' },
  awaiting_approval: { label: 'Awaiting Approval', pill: 'bg-violet-50 text-violet-700 ring-violet-600/20', dot: 'bg-violet-500', hex: '#8b5cf6' },
  in_progress: { label: 'In Progress', pill: 'bg-slate-100 text-slate-700 ring-slate-500/20', dot: 'bg-sky-500', hex: '#0ea5e9' },
  stuck: { label: 'Stuck', pill: 'bg-orange-100 text-orange-800 ring-orange-600/30', dot: 'bg-orange-500', hex: '#f97316' },
}

export const RUN_STATUS_ORDER: RunStatus[] = ['failed', 'stuck', 'partial', 'awaiting_approval', 'in_progress', 'success']

export const STEP_STATUS: Record<StepStatus, Tone> = {
  success: RUN_STATUS.success,
  failed: RUN_STATUS.failed,
  warning: { ...RUN_STATUS.partial, label: 'Warning' },
  awaiting: { ...RUN_STATUS.awaiting_approval, label: 'Awaiting' },
  running: { ...RUN_STATUS.in_progress, label: 'Running' },
  pending: { label: 'Not reached', pill: 'bg-white text-slate-400 ring-slate-300/60', dot: 'bg-slate-300', hex: '#cbd5e1' },
}

export const HEALTH: Record<Health, Tone> = {
  healthy: { label: 'Healthy', pill: RUN_STATUS.success.pill, dot: RUN_STATUS.success.dot, hex: RUN_STATUS.success.hex },
  degraded: { label: 'Degraded', pill: RUN_STATUS.partial.pill, dot: RUN_STATUS.partial.dot, hex: RUN_STATUS.partial.hex },
  issues: { label: 'Issues Detected', pill: RUN_STATUS.failed.pill, dot: RUN_STATUS.failed.dot, hex: RUN_STATUS.failed.hex },
}

export const SYSTEM_HEALTH: Record<SystemHealth, Tone> = {
  healthy: HEALTH.healthy,
  degraded: HEALTH.degraded,
  down: { ...HEALTH.issues, label: 'Down' },
}

export const SEVERITY = {
  critical: { ...RUN_STATUS.failed, label: 'Critical' },
  warning: { ...RUN_STATUS.partial, label: 'Warning' },
}
