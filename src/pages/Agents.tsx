import clsx from 'clsx'
import { Bot } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, HealthPill, PageHeader, Sparkline } from '../components/ui'
import { AGENT_BY_ID } from '../data/catalog'
import { AGENT_SUMMARIES, HEALTH_RANK, type Health } from '../lib/analysis'
import { fmtPct } from '../lib/format'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { HEALTH } from '../lib/status'

type SortMode = 'health' | 'name' | 'volume'

export function Agents() {
  useDocumentTitle('AI Employees')
  const [sort, setSort] = useState<SortMode>('health')
  const [only, setOnly] = useState<Health | 'all'>('all')

  const list = AGENT_SUMMARIES.filter((a) => only === 'all' || a.health === only).sort((a, b) => {
    if (sort === 'name') return AGENT_BY_ID[a.agentId].name.localeCompare(AGENT_BY_ID[b.agentId].name)
    if (sort === 'volume') return b.runsToday - a.runsToday
    return HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || b.stats24h.failureRate - a.stats24h.failureRate
  })

  return (
    <div>
      <PageHeader
        title="AI Employees"
        subtitle="Health is derived from each agent's failure rate over the last 24h (Healthy <5%, Degraded 5–20%, Issues Detected >20%)."
        right={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex rounded-md border border-slate-200 bg-white p-0.5 text-xs">
              {(['all', 'issues', 'degraded', 'healthy'] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setOnly(h)}
                  className={clsx('rounded px-2 py-1 font-medium', only === h ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
                >
                  {h === 'all' ? 'All' : HEALTH[h].label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-8 rounded-md border border-slate-300 bg-white pl-2 pr-7 text-sm"
              aria-label="Sort AI Employees"
            >
              <option value="health">Sort: worst health first</option>
              <option value="volume">Sort: most runs today</option>
              <option value="name">Sort: name</option>
            </select>
          </div>
        }
      />
      {list.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">No AI Employees match this health filter.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((a) => {
            const agent = AGENT_BY_ID[a.agentId]
            return (
              <Link key={a.agentId} to={`/agents/${a.agentId}`} className="group">
                <Card className="h-full p-4 transition-shadow group-hover:border-slate-300 group-hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Bot className="size-5" />
                    </div>
                    <HealthPill health={a.health} />
                  </div>
                  <div className="mt-3 font-semibold text-slate-900 group-hover:text-indigo-700">{agent.name}</div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{agent.role}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">Workflows</dt>
                      <dd className="text-sm font-semibold tabular-nums text-slate-900">{a.workflowCount}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Runs today</dt>
                      <dd className="text-sm font-semibold tabular-nums text-slate-900">{a.runsToday}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Success (24h)</dt>
                      <dd className={clsx('text-sm font-semibold tabular-nums', a.health === 'healthy' ? 'text-slate-900' : a.health === 'degraded' ? 'text-amber-700' : 'text-red-600')}>
                        {fmtPct(a.stats24h.successRate)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-end justify-between border-t border-slate-100 pt-2.5">
                    <span className="text-[11px] text-slate-500">7-day success rate</span>
                    <Sparkline values={a.trend.map((t) => t.successRate)} color={HEALTH[a.health].hex} />
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
