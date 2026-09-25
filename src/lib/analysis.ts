import { AGENTS, SYSTEMS, WORKFLOWS, WORKFLOW_BY_ID } from '../data/catalog'
import { NOW, RUNS } from '../data/seed'
import type { Run, RunStatus, SystemId } from '../data/types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const INCIDENT_WINDOW_MS = 6 * HOUR
export const CORRELATION_WINDOW_MS = 2 * HOUR
export const INCIDENT_MIN_RUNS = 3

// ---------- generic helpers ----------

export function problemStep(run: Run) {
  return run.problemStepIndex === undefined ? undefined : run.steps[run.problemStepIndex]
}

/** Failed and Partial runs are "failure signals" — the inputs to incident grouping. */
export function isFailureSignal(run: Run) {
  return run.status === 'failed' || run.status === 'partial'
}

export function signatureOf(run: Run): string | undefined {
  const s = problemStep(run)
  return s ? `${s.name}::${s.system}` : undefined
}

export function runsSince(ms: number, runs: Run[] = RUNS) {
  return runs.filter((r) => r.startedAt >= NOW - ms)
}

// ---------- stats ----------

export interface Stats {
  total: number
  success: number
  failed: number
  partial: number
  inProgress: number
  stuck: number
  awaiting: number
  /** Success / finished runs (excludes in-flight). */
  successRate: number
  /** (Failed + Stuck) / runs that have finished or should have. */
  failureRate: number
}

export function computeStats(runs: Run[]): Stats {
  const c = (s: RunStatus) => runs.filter((r) => r.status === s).length
  const success = c('success')
  const failed = c('failed')
  const partial = c('partial')
  const stuck = c('stuck')
  const finished = success + failed + partial
  return {
    total: runs.length,
    success,
    failed,
    partial,
    inProgress: c('in_progress'),
    stuck,
    awaiting: c('awaiting_approval'),
    successRate: finished ? success / finished : 1,
    failureRate: finished + stuck ? (failed + stuck) / (finished + stuck) : 0,
  }
}

// ---------- health ----------

export type Health = 'healthy' | 'degraded' | 'issues'

export function healthFromFailureRate(rate: number): Health {
  if (rate > 0.2) return 'issues'
  if (rate >= 0.05) return 'degraded'
  return 'healthy'
}

export const HEALTH_RANK: Record<Health, number> = { issues: 0, degraded: 1, healthy: 2 }

export interface AgentSummary {
  agentId: string
  stats24h: Stats
  health: Health
  runsToday: number
  workflowCount: number
  /** Daily success rate, oldest → newest, last 7 days. */
  trend: { day: string; successRate: number; runs: number }[]
}

export function dailyBuckets(runs: Run[], days = 7) {
  const out: { start: number; label: string; runs: Run[] }[] = []
  const today = new Date(NOW)
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const start = today.getTime() - i * DAY
    out.push({
      start,
      label: new Date(start).toLocaleDateString(undefined, { weekday: 'short' }),
      runs: runs.filter((r) => r.startedAt >= start && r.startedAt < start + DAY),
    })
  }
  return out
}

export function hourlyBuckets(runs: Run[], hours = 24) {
  const out: { start: number; label: string; runs: Run[] }[] = []
  const top = Math.floor(NOW / HOUR) * HOUR
  for (let i = hours - 1; i >= 0; i--) {
    const start = top - i * HOUR
    out.push({
      start,
      label: new Date(start).toLocaleTimeString(undefined, { hour: 'numeric' }),
      runs: runs.filter((r) => r.startedAt >= start && r.startedAt < start + HOUR),
    })
  }
  return out
}

export function agentSummary(agentId: string): AgentSummary {
  const runs = RUNS.filter((r) => r.agentId === agentId)
  const stats24h = computeStats(runsSince(DAY, runs))
  const startOfDay = new Date(NOW)
  startOfDay.setHours(0, 0, 0, 0)
  return {
    agentId,
    stats24h,
    health: healthFromFailureRate(stats24h.failureRate),
    runsToday: runs.filter((r) => r.startedAt >= startOfDay.getTime()).length,
    workflowCount: WORKFLOWS.filter((w) => w.agentId === agentId).length,
    trend: dailyBuckets(runs).map((b) => ({
      day: b.label,
      runs: b.runs.length,
      successRate: computeStats(b.runs).successRate,
    })),
  }
}

export const AGENT_SUMMARIES: AgentSummary[] = AGENTS.map((a) => agentSummary(a.id))
export const AGENT_SUMMARY_BY_ID = new Map(AGENT_SUMMARIES.map((s) => [s.agentId, s]))

export function workflowStats(workflowId: string, windowMs: number) {
  const runs = runsSince(windowMs, RUNS.filter((r) => r.workflowId === workflowId))
  const stats = computeStats(runs)
  return { ...stats, health: healthFromFailureRate(stats.failureRate) }
}

// ---------- incidents & correlation (single implementation, used everywhere) ----------

export interface Incident {
  key: string
  stepName: string
  system: SystemId
  runs: Run[]
  workflowIds: string[]
  agentIds: string[]
  firstSeen: number
  lastSeen: number
  severity: 'critical' | 'warning'
  title: string
}

/**
 * Group failure-signal runs by (failed step name + connected system). Any group with
 * at least `minRuns` members becomes an incident.
 */
export function groupFailures(runs: Run[], minRuns = INCIDENT_MIN_RUNS): Incident[] {
  const groups = new Map<string, Run[]>()
  for (const r of runs) {
    if (!isFailureSignal(r)) continue
    const key = signatureOf(r)
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  const incidents: Incident[] = []
  for (const [key, group] of groups) {
    if (group.length < minRuns) continue
    const step = problemStep(group[0])!
    const workflowIds = [...new Set(group.map((r) => r.workflowId))]
    const agentIds = [...new Set(group.map((r) => r.agentId))]
    const times = group.map((r) => r.startedAt)
    const summaries = group.map((r) => problemStep(r)?.error?.summary).filter(Boolean) as string[]
    const topSummary = mode(summaries) ?? `${step.name} failures`
    const wfNames = workflowIds.map((id) => WORKFLOW_BY_ID[id].name)
    const failedCount = group.filter((r) => r.status === 'failed').length
    incidents.push({
      key,
      stepName: step.name,
      system: step.system,
      runs: group.sort((a, b) => b.startedAt - a.startedAt),
      workflowIds,
      agentIds,
      firstSeen: Math.min(...times),
      lastSeen: Math.max(...times),
      severity: failedCount >= 8 || workflowIds.length >= 3 ? 'critical' : 'warning',
      title: `${topSummary} affecting ${formatList(wfNames)}`,
    })
  }
  return incidents.sort(
    (a, b) => (a.severity === b.severity ? b.runs.length - a.runs.length : a.severity === 'critical' ? -1 : 1),
  )
}

export function activeIncidents(): Incident[] {
  return groupFailures(runsSince(INCIDENT_WINDOW_MS))
}

export interface Correlation {
  related: Run[]
  stepName: string
  system: SystemId
  windowStart: number
  windowEnd: number
}

/**
 * For a failed/partial/stuck run, find other runs that went wrong at the same step in the
 * same system within ±window of it. Uses the same signature as incident grouping.
 */
export function correlate(run: Run, windowMs = CORRELATION_WINDOW_MS): Correlation | undefined {
  const step = problemStep(run)
  if (!step) return undefined
  const windowStart = run.startedAt - windowMs
  const windowEnd = Math.min(NOW, run.startedAt + windowMs)
  const sig = signatureOf(run)
  const related = RUNS.filter(
    (r) =>
      r.id !== run.id &&
      (isFailureSignal(r) || r.status === 'stuck') &&
      r.startedAt >= windowStart &&
      r.startedAt <= windowEnd &&
      signatureOf(r) === sig,
  )
  return { related, stepName: step.name, system: step.system, windowStart, windowEnd }
}

// ---------- connected systems ----------

export type SystemHealth = 'healthy' | 'degraded' | 'down'

export interface SystemSummary {
  systemId: SystemId
  status: SystemHealth
  workflowIds: string[]
  agentIds: string[]
  affected24h: Run[]
  runs24h: number
}

/** Runs in scope that went wrong *at* this system (the failing step's system). */
export function runsAffectedBy(systemId: SystemId, runs: Run[]) {
  return runs.filter((r) => r.status !== 'success' && r.status !== 'in_progress' && r.status !== 'awaiting_approval' && problemStep(r)?.system === systemId)
}

export function systemSummary(systemId: SystemId, agentId?: string): SystemSummary {
  const wfs = WORKFLOWS.filter((w) => (!agentId || w.agentId === agentId) && w.steps.some((s) => s.system === systemId))
  const scoped = RUNS.filter((r) => !agentId || r.agentId === agentId)
  const recentGlobal = runsAffectedBy(systemId, runsSince(2 * HOUR))
  const recent6h = runsAffectedBy(systemId, runsSince(INCIDENT_WINDOW_MS))
  // System status is global (a system is down for everyone), derived from recent failures at it.
  const status: SystemHealth = recentGlobal.length >= 6 ? 'down' : recent6h.length >= 2 ? 'degraded' : 'healthy'
  const last24 = runsSince(DAY, scoped)
  return {
    systemId,
    status,
    workflowIds: wfs.map((w) => w.id),
    agentIds: [...new Set(wfs.map((w) => w.agentId))],
    affected24h: runsAffectedBy(systemId, last24),
    runs24h: last24.filter((r) => r.steps.some((s) => s.system === systemId && s.status !== 'pending')).length,
  }
}

export function systemSummaries(agentId?: string): SystemSummary[] {
  return SYSTEMS.map((s) => systemSummary(s.id, agentId)).filter((s) => s.workflowIds.length > 0)
}

// ---------- utils ----------

function mode<T>(arr: T[]): T | undefined {
  const counts = new Map<T, number>()
  let best: T | undefined
  let bestN = 0
  for (const v of arr) {
    const n = (counts.get(v) ?? 0) + 1
    counts.set(v, n)
    if (n > bestN) {
      best = v
      bestN = n
    }
  }
  return best
}

function formatList(items: string[]) {
  if (items.length <= 2) return items.join(' & ')
  return `${items.slice(0, 2).join(', ')} +${items.length - 2} more`
}
