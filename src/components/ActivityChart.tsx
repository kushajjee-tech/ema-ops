import clsx from 'clsx'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RUNS } from '../data/seed'
import type { Run } from '../data/types'
import { dailyBuckets, hourlyBuckets } from '../lib/analysis'
import { RUN_STATUS } from '../lib/status'
import { Card, CardHeader } from './ui'

const SERIES = [
  { key: 'success', label: 'Success', color: RUN_STATUS.success.hex },
  { key: 'partial', label: 'Partial', color: RUN_STATUS.partial.hex },
  { key: 'failed', label: 'Failed / Stuck', color: RUN_STATUS.failed.hex },
] as const

function tally(runs: Run[]) {
  return {
    success: runs.filter((r) => r.status === 'success').length,
    partial: runs.filter((r) => r.status === 'partial').length,
    failed: runs.filter((r) => r.status === 'failed' || r.status === 'stuck').length,
    other: runs.filter((r) => r.status === 'in_progress' || r.status === 'awaiting_approval').length,
  }
}

export function ActivityChart({ runs = RUNS }: { runs?: Run[] }) {
  const [range, setRange] = useState<'24h' | '7d'>('24h')
  const data = useMemo(
    () => (range === '24h' ? hourlyBuckets(runs) : dailyBuckets(runs)).map((b) => ({ label: b.label, ...tally(b.runs) })),
    [runs, range],
  )

  return (
    <Card>
      <CardHeader
        title="Run activity"
        subtitle={range === '24h' ? 'Runs started per hour, last 24 hours' : 'Runs started per day, last 7 days'}
        right={
          <div className="flex rounded-md border border-slate-200 p-0.5 text-xs">
            {(['24h', '7d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={clsx('rounded px-2 py-0.5 font-medium', range === r ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100')}
              >
                {r}
              </button>
            ))}
          </div>
        }
      />
      <div className="px-4 pt-3">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="h-56 px-2 pb-2 pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap={range === '24h' ? 3 : 18}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={range === '24h' ? 3 : 0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: '#f1f5f9' }} content={(p) => <ChartTooltip {...p} />} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="a"
                fill={s.color}
                stroke="#fff"
                strokeWidth={1}
                radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: readonly { payload?: unknown }[]; label?: string | number }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as ReturnType<typeof tally>
  const total = row.success + row.partial + row.failed + row.other
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-slate-900">{label}</div>
      {SERIES.map((s) => (
        <div key={s.key} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
          <span className="tabular-nums text-slate-900">{row[s.key]}</span>
        </div>
      ))}
      {row.other > 0 && (
        <div className="flex justify-between gap-4 text-slate-500">
          <span>In flight</span>
          <span className="tabular-nums">{row.other}</span>
        </div>
      )}
      <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 font-medium text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">{total}</span>
      </div>
    </div>
  )
}
