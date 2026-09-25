import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { AGENT_BY_ID, SYSTEM_BY_ID, WORKFLOW_BY_ID } from '../data/catalog'
import { systemSummaries } from '../lib/analysis'
import { runsUrl } from '../lib/filters'
import { SystemBadge, SystemHealthPill } from './ui'

const RANK = { down: 0, degraded: 1, healthy: 2 }

/** Reusable: global Connected Systems screen, or scoped to one AI Employee. */
export function ConnectedSystemsTable({ agentId }: { agentId?: string }) {
  const rows = systemSummaries(agentId).sort((a, b) => RANK[a.status] - RANK[b.status] || b.affected24h.length - a.affected24h.length)
  const [open, setOpen] = useState<Set<string>>(new Set())

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">System</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Used by</th>
            <th className="px-4 py-2 text-right">Runs touching (24h)</th>
            <th className="px-4 py-2 text-right">Runs affected (24h)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((s) => {
            const sys = SYSTEM_BY_ID[s.systemId]
            const isOpen = open.has(s.systemId)
            return (
              <Fragment key={s.systemId}>
                <tr className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <SystemBadge id={s.systemId} />
                      <div>
                        <div className="font-medium text-slate-900">{sys.name}</div>
                        <div className="text-xs text-slate-500">{sys.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <SystemHealthPill health={s.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() =>
                        setOpen((o) => {
                          const n = new Set(o)
                          if (n.has(s.systemId)) n.delete(s.systemId)
                          else n.add(s.systemId)
                          return n
                        })
                      }
                      className="inline-flex items-center gap-1 text-slate-700 hover:text-indigo-700"
                      aria-expanded={isOpen}
                    >
                      {s.workflowIds.length} workflow{s.workflowIds.length > 1 ? 's' : ''}
                      {!agentId && <> · {s.agentIds.length} AI Employee{s.agentIds.length > 1 ? 's' : ''}</>}
                      <ChevronDown className={clsx('size-3.5 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{s.runs24h}</td>
                  <td className="px-4 py-2.5 text-right">
                    {s.affected24h.length > 0 ? (
                      <Link
                        to={runsUrl({ failedAt: s.systemId, range: '24h', agent: agentId })}
                        className="font-semibold tabular-nums text-red-600 hover:underline"
                      >
                        {s.affected24h.length}
                      </Link>
                    ) : (
                      <span className="tabular-nums text-slate-400">0</span>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={5} className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        {s.workflowIds.map((wid) => {
                          const w = WORKFLOW_BY_ID[wid]
                          const steps = w.steps.filter((st) => st.system === s.systemId).map((st) => st.name)
                          return (
                            <Link
                              key={wid}
                              to={`/agents/${w.agentId}?tab=runs&workflow=${wid}`}
                              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:border-indigo-300"
                            >
                              <div className="font-medium text-slate-800">{w.name}</div>
                              <div className="text-slate-500">
                                {AGENT_BY_ID[w.agentId].name} · {steps.join(', ')}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
