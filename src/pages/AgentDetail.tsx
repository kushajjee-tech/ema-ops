import clsx from 'clsx'
import { Bot, ChevronRight, Unlink } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ActivityChart } from '../components/ActivityChart'
import { ConnectedSystemsTable } from '../components/ConnectedSystemsTable'
import { RunsTable } from '../components/RunsTable'
import { Card, CardHeader, Empty, HealthPill, MiniBar, StatCard, SystemBadge, Tabs } from '../components/ui'
import { AGENT_BY_ID, WORKFLOW_BY_ID, workflowSystems } from '../data/catalog'
import { RUNS } from '../data/seed'
import { AGENT_SUMMARY_BY_ID, systemSummaries, workflowStats } from '../lib/analysis'
import { fmtPct } from '../lib/format'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { HEALTH } from '../lib/status'

type Tab = 'overview' | 'workflows' | 'runs' | 'systems'

export function AgentDetail() {
  const { agentId } = useParams()
  const [params, setParams] = useSearchParams()
  const agent = agentId ? AGENT_BY_ID[agentId] : undefined
  useDocumentTitle(agent?.name ?? 'AI Employee not found')
  if (!agent) {
    return (
      <Card>
        <Empty icon={<Unlink className="size-6 text-slate-300" />} title="AI Employee not found">
          <Link to="/agents" className="text-indigo-600 hover:underline">Back to AI Employees</Link>
        </Empty>
      </Card>
    )
  }
  const summary = AGENT_SUMMARY_BY_ID.get(agent.id)!
  const tab = (params.get('tab') as Tab) ?? 'overview'
  const runs = RUNS.filter((r) => r.agentId === agent.id)

  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t })
  const openWorkflowRuns = (workflowId: string) => setParams({ tab: 'runs', workflow: workflowId })

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link to="/agents" className="hover:text-slate-800">AI Employees</Link>
        <ChevronRight className="size-3" />
        <span className="text-slate-700">{agent.name}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Bot className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{agent.name}</h1>
            <HealthPill health={summary.health} />
          </div>
          <p className="text-sm text-slate-500">{agent.role}</p>
        </div>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'workflows', label: 'Workflows', count: agent.workflowIds.length },
          { id: 'runs', label: 'Runs', count: runs.length },
          { id: 'systems', label: 'Connected Systems', count: systemSummaries(agent.id).length },
        ]}
      />

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total runs (24h)" value={summary.stats24h.total} />
            <StatCard label="Success rate (24h)" value={fmtPct(summary.stats24h.successRate, 1)} accent={clsx(summary.health === 'issues' ? 'text-red-600' : summary.health === 'degraded' ? 'text-amber-600' : 'text-emerald-600')} />
            <StatCard label="Failed runs (24h)" value={summary.stats24h.failed} accent={summary.stats24h.failed ? 'text-red-600' : undefined} sub={`+ ${summary.stats24h.partial} partial`} />
            <StatCard
              label="In progress / Stuck"
              value={
                <>
                  {summary.stats24h.inProgress}
                  <span className="mx-1 text-slate-300">/</span>
                  <span className={clsx(summary.stats24h.stuck && 'text-orange-600')}>{summary.stats24h.stuck}</span>
                </>
              }
              sub={`${summary.stats24h.awaiting} awaiting approval`}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader title="Workflows" subtitle="Last 24h · click to see runs" />
              <ul className="divide-y divide-slate-100">
                {agent.workflowIds.map((id) => {
                  const s = workflowStats(id, 24 * 3_600_000)
                  return (
                    <li key={id}>
                      <button onClick={() => openWorkflowRuns(id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                        <span className={clsx('size-2 shrink-0 rounded-full', HEALTH[s.health].dot)} title={HEALTH[s.health].label} />
                        <span className="flex-1 truncate text-sm font-medium text-slate-800">{WORKFLOW_BY_ID[id].name}</span>
                        <span className="w-16 text-right text-xs tabular-nums text-slate-500">{s.total} runs</span>
                        <MiniBar value={s.failureRate} tone={HEALTH[s.health]} />
                        <span className={clsx('w-10 text-right text-xs font-medium tabular-nums', s.failureRate > 0.2 ? 'text-red-600' : s.failureRate >= 0.05 ? 'text-amber-700' : 'text-slate-500')}>
                          {fmtPct(s.failureRate)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
            <ActivityChart runs={runs} />
          </div>
        </div>
      )}

      {tab === 'workflows' && <WorkflowsTab agentId={agent.id} onOpen={openWorkflowRuns} />}

      {tab === 'runs' && <RunsTable locked={{ agent: agent.id }} />}

      {tab === 'systems' && (
        <Card>
          <CardHeader title="Connected systems" subtitle={`Systems ${agent.name}'s workflows depend on. Status is global; affected counts are scoped to this agent.`} />
          <ConnectedSystemsTable agentId={agent.id} />
        </Card>
      )}
    </div>
  )
}

const PERIODS = { '24h': 24 * 3_600_000, '7d': 7 * 24 * 3_600_000 } as const

function WorkflowsTab({ agentId, onOpen }: { agentId: string; onOpen: (id: string) => void }) {
  const [period, setPeriod] = useState<keyof typeof PERIODS>('7d')
  const agent = AGENT_BY_ID[agentId]
  return (
    <Card>
      <CardHeader
        title="Workflows"
        subtitle="Click a workflow to see its runs"
        right={
          <div className="flex rounded-md border border-slate-200 p-0.5 text-xs">
            {(Object.keys(PERIODS) as (keyof typeof PERIODS)[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className={clsx('rounded px-2 py-0.5 font-medium', period === p ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}>
                {p}
              </button>
            ))}
          </div>
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Workflow</th>
              <th className="px-4 py-2">Systems</th>
              <th className="px-4 py-2 text-right">Runs</th>
              <th className="px-4 py-2 text-right">Failed</th>
              <th className="px-4 py-2">Failure rate</th>
              <th className="px-4 py-2">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agent.workflowIds.map((id) => {
              const w = WORKFLOW_BY_ID[id]
              const s = workflowStats(id, PERIODS[period])
              return (
                <tr key={id} onClick={() => onOpen(id)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-slate-900">{w.name}</div>
                    <div className="text-xs text-slate-500">{w.description}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {workflowSystems(w).map((sys) => <SystemBadge key={sys} id={sys} size="xs" />)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{s.total}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{s.failed + s.stuck}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <MiniBar value={s.failureRate} tone={HEALTH[s.health]} />
                      <span className="text-xs tabular-nums text-slate-600">{fmtPct(s.failureRate, 1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <HealthPill health={s.health} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
