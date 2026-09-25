import { NOW } from '../data/seed'
import type { Run, RunStatus, SystemId } from '../data/types'
import { problemStep } from './analysis'

export const RANGE_PRESETS = {
  '1h': { label: 'Last hour', ms: 3_600_000 },
  '6h': { label: 'Last 6 hours', ms: 6 * 3_600_000 },
  '24h': { label: 'Last 24 hours', ms: 24 * 3_600_000 },
  '7d': { label: 'Last 7 days', ms: 7 * 24 * 3_600_000 },
} as const
export type RangePreset = keyof typeof RANGE_PRESETS

export interface RunFilters {
  status?: RunStatus[]
  agent?: string
  workflow?: string
  /** Runs that touched this system at any step. */
  system?: SystemId
  range?: RangePreset
  from?: number
  to?: number
  retries?: boolean
  q?: string
  /** Failure signature: runs whose failing step has this name… */
  step?: string
  /** …in this system. */
  failedAt?: SystemId
}

export const FILTER_KEYS = ['status', 'agent', 'workflow', 'system', 'range', 'from', 'to', 'retries', 'q', 'step', 'failedAt'] as const

export function parseFilters(p: URLSearchParams): RunFilters {
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined)
  const range = p.get('range')
  return {
    status: p.get('status') ? (p.get('status')!.split(',') as RunStatus[]) : undefined,
    agent: p.get('agent') ?? undefined,
    workflow: p.get('workflow') ?? undefined,
    system: (p.get('system') as SystemId) ?? undefined,
    range: range && range in RANGE_PRESETS ? (range as RangePreset) : undefined,
    from: num('from'),
    to: num('to'),
    retries: p.get('retries') === '1' || undefined,
    q: p.get('q') ?? undefined,
    step: p.get('step') ?? undefined,
    failedAt: (p.get('failedAt') as SystemId) ?? undefined,
  }
}

export function toParams(f: RunFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.status?.length) p.set('status', f.status.join(','))
  if (f.agent) p.set('agent', f.agent)
  if (f.workflow) p.set('workflow', f.workflow)
  if (f.system) p.set('system', f.system)
  if (f.range) p.set('range', f.range)
  if (f.from !== undefined) p.set('from', String(f.from))
  if (f.to !== undefined) p.set('to', String(f.to))
  if (f.retries) p.set('retries', '1')
  if (f.q) p.set('q', f.q)
  if (f.step) p.set('step', f.step)
  if (f.failedAt) p.set('failedAt', f.failedAt)
  return p
}

/** Link to the global Runs page with the given filters applied. */
export function runsUrl(f: RunFilters): string {
  const qs = toParams(f).toString()
  return qs ? `/runs?${qs}` : '/runs'
}

export function applyFilters(runs: Run[], f: RunFilters): Run[] {
  const q = f.q?.trim().toLowerCase()
  const since = f.range ? NOW - RANGE_PRESETS[f.range].ms : undefined
  return runs.filter((r) => {
    if (f.status?.length && !f.status.includes(r.status)) return false
    if (f.agent && r.agentId !== f.agent) return false
    if (f.workflow && r.workflowId !== f.workflow) return false
    if (f.system && !r.steps.some((s) => s.system === f.system && s.status !== 'pending')) return false
    if (since !== undefined && r.startedAt < since) return false
    if (f.from !== undefined && r.startedAt < f.from) return false
    if (f.to !== undefined && r.startedAt > f.to) return false
    if (f.retries && !r.retryOf && !r.retriedBy) return false
    if (f.step || f.failedAt) {
      const ps = problemStep(r)
      if (!ps || (f.step && ps.name !== f.step) || (f.failedAt && ps.system !== f.failedAt)) return false
      if (r.status === 'success' || r.status === 'in_progress' || r.status === 'awaiting_approval') return false
    }
    if (q) {
      const hay = [r.id, r.caveat, ...r.steps.map((s) => s.error?.message), ...r.steps.map((s) => s.error?.code)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}
