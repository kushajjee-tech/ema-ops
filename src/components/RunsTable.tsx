import clsx from 'clsx'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, RotateCcw, Search, SearchX, ShieldAlert, CheckCheck, X, Repeat } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AGENTS, AGENT_BY_ID, SYSTEMS, SYSTEM_BY_ID, WORKFLOWS, WORKFLOW_BY_ID } from '../data/catalog'
import { RUNS } from '../data/seed'
import type { Run, RunStatus, SystemId } from '../data/types'
import { useBulkAction } from '../lib/actions'
import { applyFilters, FILTER_KEYS, parseFilters, RANGE_PRESETS, toParams, type RangePreset, type RunFilters } from '../lib/filters'
import { fmtDateTime, fmtDuration, fmtRelative, fmtTime } from '../lib/format'
import { RUN_STATUS, RUN_STATUS_ORDER } from '../lib/status'
import { LatestActivityChip } from './ActivityChip'
import { Button, Card, Empty, StatusPill, SystemBadge } from './ui'

const PAGE_SIZE = 25

type SortKey = 'startedAt' | 'duration'

interface Props {
  /** Filters fixed by the host screen (e.g. an AI Employee's detail page). Not editable. */
  locked?: Pick<RunFilters, 'agent'>
}

/**
 * The reusable Runs table. Filter state lives in the URL so every pre-filtered link
 * ("View all affected runs", correlation links, workflow rows) is just a URL.
 */
export function RunsTable({ locked }: Props) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const bulk = useBulkAction()
  const filterKey = params.toString()
  // Filters are fully described by the URL (plus locked scope), so filterKey is a sufficient memo key.
  const lockedAgent = locked?.agent
  const filters: RunFilters = useMemo(
    () => ({ ...parseFilters(new URLSearchParams(filterKey)), ...(lockedAgent ? { agent: lockedAgent } : {}) }),
    [filterKey, lockedAgent],
  )
  const page = Math.max(1, Number(params.get('page') ?? 1))
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'startedAt', dir: 'desc' })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const scoped = useMemo(() => (locked?.agent ? RUNS.filter((r) => r.agentId === locked.agent) : RUNS), [locked?.agent])
  const filtered = useMemo(() => {
    const out = applyFilters(scoped, filters)
    const val = (r: Run) => (sort.key === 'startedAt' ? r.startedAt : r.durationMs)
    return out.sort((a, b) => (sort.dir === 'asc' ? val(a) - val(b) : val(b) - val(a)))
  }, [scoped, filterKey, sort])

  // Status counts ignore the status filter itself so the chips show what's available.
  const statusCounts = useMemo(() => {
    const base = applyFilters(scoped, { ...filters, status: undefined })
    const c = {} as Record<RunStatus, number>
    for (const s of RUN_STATUS_ORDER) c[s] = 0
    for (const r of base) c[r.status]++
    return c
  }, [scoped, filterKey])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function update(patch: Partial<RunFilters>) {
    const next = { ...parseFilters(params), ...patch }
    const p = toParams(next)
    // Preserve non-filter params owned by the host page (e.g. ?tab=runs).
    params.forEach((v, k) => {
      if (!(FILTER_KEYS as readonly string[]).includes(k) && k !== 'page') p.set(k, v)
    })
    setParams(p, { replace: true })
    setSelected(new Set())
  }

  function setPage(n: number) {
    const p = new URLSearchParams(params)
    p.set('page', String(n))
    setParams(p, { replace: true })
  }

  function clearAll() {
    update(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])) as Partial<RunFilters>)
  }

  const toggleStatus = (s: RunStatus) => {
    const cur = new Set(filters.status ?? [])
    if (cur.has(s)) cur.delete(s)
    else cur.add(s)
    update({ status: cur.size ? [...cur] : undefined })
  }

  const pageIds = rows.map((r) => r.id)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someOnPage = pageIds.some((id) => selected.has(id))
  const selectedRuns = filtered.filter((r) => selected.has(r.id))

  const workflowOptions = WORKFLOWS.filter((w) => !filters.agent || w.agentId === filters.agent)
  const hasFilters = FILTER_KEYS.some((k) => params.has(k))

  const chips: { label: string; clear: Partial<RunFilters> }[] = []
  if (filters.step || filters.failedAt)
    chips.push({
      label: `Failed at: ${filters.step ?? 'any step'}${filters.failedAt ? ` · ${SYSTEM_BY_ID[filters.failedAt].name}` : ''}`,
      clear: { step: undefined, failedAt: undefined },
    })
  if (filters.from !== undefined || filters.to !== undefined)
    chips.push({
      label: `Started ${filters.from ? fmtDateTime(filters.from) : '…'} → ${filters.to ? fmtTime(filters.to) : 'now'}`,
      clear: { from: undefined, to: undefined },
    })

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key === k ? sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null

  return (
    <Card className={clsx('overflow-hidden', selected.size > 0 && 'mb-20')}>
      {/* Filter bar */}
      <div className="space-y-2.5 border-b border-slate-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-56 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.q ?? ''}
              onChange={(e) => update({ q: e.target.value || undefined })}
              placeholder="Search run ID or error message…"
              className="h-8 w-full rounded-md border border-slate-300 bg-white pl-8 pr-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          {!locked?.agent && (
            <Select
              value={filters.agent ?? ''}
              onChange={(v) => update({ agent: v || undefined, workflow: undefined })}
              options={[['', 'All AI Employees'], ...AGENTS.map((a) => [a.id, a.name] as [string, string])]}
            />
          )}
          <Select
            value={filters.workflow ?? ''}
            onChange={(v) => update({ workflow: v || undefined })}
            options={[['', 'All workflows'], ...workflowOptions.map((w) => [w.id, w.name] as [string, string])]}
          />
          <Select
            value={filters.system ?? ''}
            onChange={(v) => update({ system: (v as SystemId) || undefined })}
            options={[['', 'All systems'], ...SYSTEMS.map((s) => [s.id, s.name] as [string, string])]}
          />
          <Select
            value={filters.range ?? ''}
            onChange={(v) => update({ range: (v as RangePreset) || undefined })}
            options={[['', 'All time'], ...Object.entries(RANGE_PRESETS).map(([k, v]) => [k, v.label] as [string, string])]}
          />
          <label className="inline-flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={!!filters.retries}
              onChange={(e) => update({ retries: e.target.checked || undefined })}
              className="accent-indigo-600"
            />
            Has retries
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="size-3.5" /> Clear filters
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {RUN_STATUS_ORDER.map((s) => {
            const active = filters.status?.includes(s)
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                aria-pressed={active}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors',
                  active ? RUN_STATUS[s].pill : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                  active && 'ring-2',
                )}
              >
                <span className={clsx('size-1.5 rounded-full', RUN_STATUS[s].dot)} />
                {RUN_STATUS[s].label}
                <span className="tabular-nums text-slate-400">{statusCounts[s]}</span>
              </button>
            )
          })}
          {chips.map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-1 pl-2.5 pr-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
              {c.label}
              <button onClick={() => update(c.clear)} className="rounded-full p-0.5 hover:bg-indigo-100" aria-label={`Remove filter ${c.label}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white shadow-xl lg:ml-28"
        >
          <span className="font-medium">{selected.size} selected</span>
          {allOnPage && selected.size < filtered.length && (
            <button className="text-xs font-medium text-indigo-300 underline" onClick={() => setSelected(new Set(filtered.map((r) => r.id)))}>
              Select all {filtered.length} matching
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => bulk('retry', selectedRuns, () => setSelected(new Set()))}>
              <RotateCcw className="size-3.5" /> Retry selected
            </Button>
            <Button size="sm" onClick={() => bulk('escalate', selectedRuns, () => setSelected(new Set()))}>
              <ShieldAlert className="size-3.5" /> Escalate selected
            </Button>
            <Button size="sm" onClick={() => bulk('resolve', selectedRuns, () => setSelected(new Set()))}>
              <CheckCheck className="size-3.5" /> Mark resolved
            </Button>
            <button className="h-7 rounded-md px-2.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-9 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all on page"
                  className="accent-indigo-600"
                  checked={allOnPage}
                  ref={(el) => {
                    if (el) el.indeterminate = !allOnPage && someOnPage
                  }}
                  onChange={() => {
                    const next = new Set(selected)
                    pageIds.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)))
                    setSelected(next)
                  }}
                />
              </th>
              <th className="px-3 py-2">Run ID</th>
              {!locked?.agent && <th className="px-3 py-2">AI Employee</th>}
              <th className="px-3 py-2">Workflow</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">
                <button className="inline-flex items-center gap-1 uppercase hover:text-slate-800" onClick={() => toggleSort('startedAt')}>
                  Started <SortIcon k="startedAt" />
                </button>
              </th>
              <th className="px-3 py-2">
                <button className="inline-flex items-center gap-1 uppercase hover:text-slate-800" onClick={() => toggleSort('duration')}>
                  Duration <SortIcon k="duration" />
                </button>
              </th>
              <th className="px-3 py-2">Triggered by</th>
              <th className="px-3 py-2">Systems</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const failSys = r.problemStepIndex !== undefined && r.status !== 'awaiting_approval' && r.status !== 'in_progress' ? r.steps[r.problemStepIndex].system : undefined
              const touched = [...new Set(r.steps.map((s) => s.system))]
              return (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/runs/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/runs/${r.id}`)
                  }}
                  tabIndex={0}
                  aria-label={`Open run ${r.id}`}
                  className={clsx('cursor-pointer hover:bg-slate-50 focus-visible:bg-indigo-50 focus-visible:outline-none', selected.has(r.id) && 'bg-indigo-50/50')}
                >
                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.id}`}
                      className="accent-indigo-600"
                      checked={selected.has(r.id)}
                      onChange={() => {
                        const next = new Set(selected)
                        if (next.has(r.id)) next.delete(r.id)
                        else next.add(r.id)
                        setSelected(next)
                      }}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs font-medium text-indigo-700">
                    <span className="inline-flex items-center gap-1">
                      {r.id}
                      {(r.retryOf || r.retriedBy) && (
                        <span title={r.retryOf ? `Attempt ${r.attempt}` : 'Retried'} className="text-slate-400">
                          <Repeat className="size-3" />
                        </span>
                      )}
                    </span>
                  </td>
                  {!locked?.agent && <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{AGENT_BY_ID[r.agentId].name}</td>}
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-700">{WORKFLOW_BY_ID[r.workflowId].name}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={r.status} />
                      <LatestActivityChip runId={r.id} compact />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-slate-600" title={fmtDateTime(r.startedAt)}>
                    <span className="tabular-nums">{fmtDateTime(r.startedAt)}</span>
                    <span className="ml-1.5 text-xs text-slate-400">{fmtRelative(r.startedAt)}</span>
                  </td>
                  <td className={clsx('whitespace-nowrap px-3 py-1.5 tabular-nums', r.status === 'stuck' ? 'font-medium text-orange-700' : 'text-slate-600')}>
                    {fmtDuration(r.durationMs)}
                  </td>
                  <td className="max-w-40 truncate px-3 py-1.5 text-xs text-slate-500" title={r.triggeredBy.kind === 'run' ? `Run ${r.triggeredBy.runId}` : r.triggeredBy.label}>
                    {r.triggeredBy.kind === 'run' ? <span className="font-mono">{r.triggeredBy.runId}</span> : r.triggeredBy.label}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      {touched.map((s) => (
                        <span key={s} className={clsx('rounded', s === failSys && 'ring-2 ring-red-500 ring-offset-1')}>
                          <SystemBadge id={s} size="xs" />
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty icon={<SearchX className="size-6 text-slate-300" />} title="No runs match these filters">
            Try widening the date range or clearing some filters.
          </Empty>
        )}
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 text-xs text-slate-600">
        <span className="tabular-nums">
          {filtered.length === 0
            ? '0 runs'
            : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} of ${filtered.length} runs`}
        </span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
            <ChevronLeft className="size-3.5" />
          </Button>
          {pageWindow(safePage, pageCount).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
            ) : (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={clsx('h-7 min-w-7 rounded-md px-2 tabular-nums', n === safePage ? 'bg-indigo-600 text-white' : 'hover:bg-slate-100')}
            >
              {n}
            </button>
            ),
          )}
          <Button size="sm" variant="ghost" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} aria-label="Next page">
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

/** Page numbers to show: first, last, and ±1 around the current page, with gaps as null. */
function pageWindow(current: number, count: number): (number | null)[] {
  const keep = new Set([1, count, current - 1, current, current + 1].filter((n) => n >= 1 && n <= count))
  const sorted = [...keep].sort((x, y) => x - y)
  const out: (number | null)[] = []
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(null)
    out.push(n)
  })
  return out
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'h-8 rounded-md border bg-white pl-2 pr-7 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500',
        value ? 'border-indigo-400 text-indigo-800' : 'border-slate-300 text-slate-700',
      )}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}
