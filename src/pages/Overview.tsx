import clsx from 'clsx'
import { ArrowRight, CheckCircle2, Clock, Layers, RotateCcw, Siren, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { ActivityChart } from '../components/ActivityChart'
import { Button, Card, CardHeader, HealthPill, PageHeader, Pill, Sparkline, StatCard, SystemBadge } from '../components/ui'
import { AGENT_BY_ID, SYSTEM_BY_ID, WORKFLOW_BY_ID } from '../data/catalog'
import { NOW } from '../data/seed'
import { useBulkAction } from '../lib/actions'
import { activeIncidents, AGENT_SUMMARIES, computeStats, HEALTH_RANK, INCIDENT_MIN_RUNS, INCIDENT_WINDOW_MS, runsSince, type Incident } from '../lib/analysis'
import { runsUrl } from '../lib/filters'
import { fmtPct, fmtRelative, fmtTime } from '../lib/format'
import { HEALTH, SEVERITY } from '../lib/status'

export function Overview() {
  const incidents = activeIncidents()
  const stats = computeStats(runsSince(24 * 3_600_000))
  const worst = [...AGENT_SUMMARIES]
    .sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || b.stats24h.failureRate - a.stats24h.failureRate)
    .slice(0, 3)

  return (
    <div className="space-y-4">
      <PageHeader title="Overview" subtitle={`Operational status across all AI Employees · as of ${fmtTime(NOW)}`} />

      <ActiveIssues incidents={incidents} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total runs (24h)" value={stats.total} />
        <StatCard
          label="Success rate (24h)"
          value={fmtPct(stats.successRate, 1)}
          accent={stats.successRate < 0.8 ? 'text-red-600' : stats.successRate < 0.95 ? 'text-amber-600' : 'text-emerald-600'}
          sub={`${stats.success} of ${stats.success + stats.failed + stats.partial} completed`}
        />
        <StatCard
          label="Failed runs (24h)"
          value={<Link to={runsUrl({ status: ['failed'], range: '24h' })} className="hover:underline">{stats.failed}</Link>}
          accent={stats.failed ? 'text-red-600' : undefined}
          sub={`+ ${stats.partial} partial`}
        />
        <StatCard
          label="In progress / Stuck"
          value={
            <span>
              <Link to={runsUrl({ status: ['in_progress'] })} className="hover:underline">{stats.inProgress}</Link>
              <span className="mx-1 text-slate-300">/</span>
              <Link to={runsUrl({ status: ['stuck'] })} className={clsx('hover:underline', stats.stuck && 'text-orange-600')}>{stats.stuck}</Link>
            </span>
          }
          sub={`${stats.awaiting} awaiting approval`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ActivityChart />
        <Card>
          <CardHeader title="AI Employees needing attention" subtitle="Worst health first · last 24h" right={<Link to="/agents" className="text-xs font-medium text-indigo-600 hover:underline">All</Link>} />
          <ul className="divide-y divide-slate-100">
            {worst.map((a) => (
              <li key={a.agentId}>
                <Link to={`/agents/${a.agentId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{AGENT_BY_ID[a.agentId].name}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <HealthPill health={a.health} />
                      <span className="tabular-nums">{fmtPct(a.stats24h.failureRate)} failing</span>
                    </div>
                  </div>
                  <Sparkline values={a.trend.map((t) => t.successRate)} color={HEALTH[a.health].hex} width={72} />
                  <ArrowRight className="size-3.5 text-slate-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function ActiveIssues({ incidents }: { incidents: Incident[] }) {
  const hours = INCIDENT_WINDOW_MS / 3_600_000
  const critical = incidents.some((i) => i.severity === 'critical')
  return (
    <Card className={clsx('overflow-hidden', incidents.length ? (critical ? 'border-red-300 shadow-sm shadow-red-100' : 'border-amber-300') : 'border-emerald-200')}>
      <div className={clsx('flex flex-wrap items-center justify-between gap-2 px-4 py-3', incidents.length ? (critical ? 'bg-red-50' : 'bg-amber-50') : 'bg-emerald-50')}>
        <div className="flex items-center gap-2.5">
          <Siren className={clsx('size-5', incidents.length ? (critical ? 'text-red-600' : 'text-amber-600') : 'text-emerald-600')} />
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Active issues <span className="ml-1 tabular-nums text-slate-500">{incidents.length}</span>
            </h2>
            <p className="text-xs text-slate-600">
              Failed &amp; partial runs from the last {hours}h, grouped by failing step + connected system ({INCIDENT_MIN_RUNS}+ runs = issue)
            </p>
          </div>
        </div>
      </div>
      {incidents.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6">
          <CheckCircle2 className="size-6 text-emerald-500" />
          <div>
            <div className="text-sm font-medium text-slate-900">No active issues — all systems healthy</div>
            <div className="text-xs text-slate-500">No correlated failures in the last {hours} hours.</div>
          </div>
        </div>
      ) : (
        <ol className="divide-y divide-slate-100">
          {incidents.map((inc, i) => (
            <IncidentRow key={inc.key} incident={inc} rank={i + 1} />
          ))}
        </ol>
      )}
    </Card>
  )
}

function IncidentRow({ incident: inc, rank }: { incident: Incident; rank: number }) {
  const navigate = useNavigate()
  const bulk = useBulkAction()
  const tone = SEVERITY[inc.severity]
  const retryable = inc.runs.filter((r) => r.status === 'failed')
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="mt-0.5 text-xs font-semibold tabular-nums text-slate-400">#{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone} pulse={inc.severity === 'critical'} />
            <span className="text-sm font-semibold text-slate-900">{inc.title}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <SystemBadge id={inc.system} size="xs" />
              Step &ldquo;{inc.stepName}&rdquo; in {SYSTEM_BY_ID[inc.system].name}
            </span>
            <span className="inline-flex items-center gap-1">
              <b className="tabular-nums text-slate-900">{inc.runs.length}</b> runs affected
            </span>
            <span className="inline-flex items-center gap-1" title={inc.workflowIds.map((w) => WORKFLOW_BY_ID[w].name).join(', ')}>
              <Layers className="size-3 text-slate-400" />
              <b className="tabular-nums text-slate-900">{inc.workflowIds.length}</b> workflows
            </span>
            <span className="inline-flex items-center gap-1" title={inc.agentIds.map((a) => AGENT_BY_ID[a].name).join(', ')}>
              <Users className="size-3 text-slate-400" />
              <b className="tabular-nums text-slate-900">{inc.agentIds.length}</b> AI Employee{inc.agentIds.length > 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3 text-slate-400" />
              First detected {fmtTime(inc.firstSeen)} ({fmtRelative(inc.firstSeen)}) · latest {fmtRelative(inc.lastSeen)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 pl-7 md:pl-0">
        <Button
          size="sm"
          onClick={() => navigate(runsUrl({ step: inc.stepName, failedAt: inc.system, status: ['failed', 'partial'], from: inc.firstSeen }))}
        >
          View all affected runs <ArrowRight className="size-3.5" />
        </Button>
        <Button size="sm" variant="primary" disabled={!retryable.length} onClick={() => bulk('retry', retryable)}>
          <RotateCcw className="size-3.5" /> Retry all
        </Button>
      </div>
    </li>
  )
}
