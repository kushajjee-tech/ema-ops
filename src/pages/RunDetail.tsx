import clsx from 'clsx'
import {
  AlertTriangle, ArrowRight, Check, ChevronDown, ChevronRight, CircleDashed, Clock, Download, FileJson,
  GitBranch, Link2, Loader2, RotateCcw, ShieldAlert, ThumbsDown, ThumbsUp, Unlink, X, Repeat, StepForward,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AGENT_BY_ID, SYSTEM_BY_ID, WORKFLOW_BY_ID } from '../data/catalog'
import { RUN_BY_ID } from '../data/seed'
import type { Run, RunStep } from '../data/types'
import { Button, Card, CardHeader, Empty, Modal, Pill, StatusPill, StepStatusPill, SystemBadge } from '../components/ui'
import { downloadJson, useConfirm } from '../lib/actions'
import { activeIncidents, correlate, CORRELATION_WINDOW_MS, problemStep, signatureOf } from '../lib/analysis'
import { runsUrl } from '../lib/filters'
import { fmtDateTime, fmtDuration, fmtRelative, fmtTime } from '../lib/format'
import { SEVERITY, STEP_STATUS } from '../lib/status'

export function RunDetail() {
  const { runId } = useParams()
  const run = runId ? RUN_BY_ID.get(runId) : undefined
  if (!run) {
    return (
      <Card>
        <Empty icon={<Unlink className="size-6 text-slate-300" />} title={`Run ${runId} not found`}>
          <Link to="/runs" className="text-indigo-600 hover:underline">Back to all runs</Link>
        </Empty>
      </Card>
    )
  }
  // key forces fresh expand-state when navigating between runs
  return <RunDetailView key={run.id} run={run} />
}

function RunDetailView({ run }: { run: Run }) {
  const agent = AGENT_BY_ID[run.agentId]
  const workflow = WORKFLOW_BY_ID[run.workflowId]
  const showCorrelation = run.status === 'failed' || run.status === 'partial' || run.status === 'stuck'

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link to="/runs" className="hover:text-slate-800">Runs</Link>
        <ChevronRight className="size-3" />
        <span className="font-mono text-slate-700">{run.id}</span>
      </nav>

      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-mono text-lg font-semibold text-slate-900">{run.id}</h1>
              <StatusPill status={run.status} className="text-sm" />
              {run.attempt > 1 && <Pill tone={STEP_STATUS.pending}>Attempt {run.attempt}</Pill>}
            </div>
            <div className="mt-1 text-sm text-slate-600">
              <Link to={`/agents/${agent.id}`} className="font-medium text-slate-800 hover:text-indigo-700">{agent.name}</Link>
              <span className="mx-1.5 text-slate-300">/</span>
              <Link to={`/agents/${agent.id}?tab=runs&workflow=${workflow.id}`} className="hover:text-indigo-700">{workflow.name}</Link>
            </div>
          </div>
          <RunActions run={run} />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-100 px-4 py-3 text-sm sm:grid-cols-4">
          <Meta label="Started">{fmtDateTime(run.startedAt)}</Meta>
          <Meta label="Ended">{run.endedAt ? fmtDateTime(run.endedAt) : <span className="text-slate-400">— still running</span>}</Meta>
          <Meta label="Duration">
            <span className={clsx(run.status === 'stuck' && 'font-medium text-orange-700')}>
              {fmtDuration(run.durationMs)}
              {run.status === 'stuck' && <span className="ml-1 text-xs font-normal">(expected ~{fmtDuration(workflow.expectedSec * 1000)})</span>}
            </span>
          </Meta>
          <Meta label="Triggered by">
            {run.triggeredBy.kind === 'run' ? (
              <Link to={`/runs/${run.triggeredBy.runId}`} className="font-mono text-indigo-700 hover:underline">{run.triggeredBy.runId}</Link>
            ) : (
              run.triggeredBy.label
            )}
          </Meta>
        </dl>
        <RelatedRuns run={run} />
      </Card>

      {run.status === 'partial' && run.caveat && (
        <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-medium">Completed with a caveat: </span>
            {run.caveat}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Step timeline" subtitle={`${run.steps.length} steps · click a step to inspect its payloads`} />
          <StepTimeline run={run} />
        </Card>
        <div className="space-y-4">
          {showCorrelation && <CorrelationPanel run={run} />}
          <Card>
            <CardHeader title="Systems touched" />
            <ul className="divide-y divide-slate-100 text-sm">
              {[...new Set(run.steps.map((s) => s.system))].map((sys) => {
                const steps = run.steps.filter((s) => s.system === sys)
                const bad = steps.find((s) => s.status === 'failed' || s.status === 'warning')
                return (
                  <li key={sys} className="flex items-center justify-between px-4 py-2">
                    <SystemBadge id={sys} withName />
                    <span className={clsx('text-xs', bad ? 'font-medium text-red-600' : 'text-slate-500')}>
                      {bad ? `Issue at "${bad.name}"` : `${steps.length} step${steps.length > 1 ? 's' : ''}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  )
}

// ---------- Actions (status-conditional) ----------

function RunActions({ run }: { run: Run }) {
  const confirm = useConfirm()
  const [payloadOpen, setPayloadOpen] = useState(false)
  const failing = problemStep(run)

  const exportLogs = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        downloadJson(`${run.id}-logs.json`, run)
        toast.success(`Exported logs for ${run.id}`)
      }}
    >
      <Download className="size-3.5" /> Export logs
    </Button>
  )

  let primary: ReactNode = null
  if (run.status === 'failed' || run.status === 'stuck') {
    primary = (
      <>
        <Button
          variant="primary"
          onClick={() =>
            confirm({
              title: `Retry ${run.id}?`,
              body: `A new attempt (#${run.attempt + 1}) of "${WORKFLOW_BY_ID[run.workflowId].name}" will start from the first step.`,
              confirmLabel: 'Retry run',
              onConfirm: () => toast.success(`Retry queued — attempt ${run.attempt + 1} of ${run.id}`),
            })
          }
        >
          <RotateCcw className="size-3.5" /> Retry
        </Button>
        <Button
          onClick={() =>
            confirm({
              title: `Retry from "${failing?.name}"?`,
              body: `Steps before "${failing?.name}" will be skipped and their outputs reused.`,
              confirmLabel: 'Retry from step',
              onConfirm: () => toast.success(`Resuming ${run.id} from "${failing?.name}"`),
            })
          }
        >
          <StepForward className="size-3.5" /> Retry from failed step
        </Button>
        <Button
          onClick={() =>
            confirm({
              title: 'Escalate to a human?',
              body: `${run.id} will be assigned to the ${AGENT_BY_ID[run.agentId].name} on-call owner with full run context.`,
              confirmLabel: 'Escalate',
              onConfirm: () => toast.success(`${run.id} escalated to on-call owner`),
            })
          }
        >
          <ShieldAlert className="size-3.5" /> Escalate to human
        </Button>
      </>
    )
  } else if (run.status === 'awaiting_approval') {
    primary = <ApprovalButtons run={run} />
  } else if (run.status === 'success' || run.status === 'partial') {
    primary = (
      <Button onClick={() => setPayloadOpen(true)}>
        <FileJson className="size-3.5" /> View full payload
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary}
      {exportLogs}
      <Modal open={payloadOpen} onClose={() => setPayloadOpen(false)} title={`${run.id} — full payload`} wide>
        <pre className="overflow-auto rounded bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100">{JSON.stringify(run, null, 2)}</pre>
      </Modal>
    </div>
  )
}

function ApprovalButtons({ run, size = 'md' }: { run: Run; size?: 'sm' | 'md' }) {
  const confirm = useConfirm()
  const step = problemStep(run)
  return (
    <>
      <Button
        size={size}
        variant="primary"
        className="bg-emerald-600 hover:bg-emerald-700"
        onClick={() => toast.success(`Approved "${step?.name}" — ${run.id} will continue`)}
      >
        <ThumbsUp className="size-3.5" /> Approve
      </Button>
      <Button
        size={size}
        onClick={() =>
          confirm({
            title: 'Reject this request?',
            body: `${run.id} will stop at "${step?.name}" and the requester will be notified.`,
            confirmLabel: 'Reject',
            danger: true,
            onConfirm: () => toast(`Rejected — ${run.id} stopped at "${step?.name}"`),
          })
        }
      >
        <ThumbsDown className="size-3.5" /> Reject
      </Button>
    </>
  )
}

// ---------- Related runs thread ----------

function retryChain(run: Run): Run[] {
  let root = run
  while (root.retryOf && RUN_BY_ID.get(root.retryOf)) root = RUN_BY_ID.get(root.retryOf)!
  const chain = [root]
  while (chain[chain.length - 1].retriedBy) chain.push(RUN_BY_ID.get(chain[chain.length - 1].retriedBy!)!)
  return chain
}

function RunRef({ id }: { id: string }) {
  const r = RUN_BY_ID.get(id)
  if (!r) return <span className="font-mono">{id}</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Link to={`/runs/${r.id}`} className="font-mono font-medium text-indigo-700 hover:underline">{r.id}</Link>
      <span className="text-slate-500">
        ({WORKFLOW_BY_ID[r.workflowId].name}, {AGENT_BY_ID[r.agentId].name})
      </span>
      <StatusPill status={r.status} />
    </span>
  )
}

function RelatedRuns({ run }: { run: Run }) {
  const chain = run.retryOf || run.retriedBy ? retryChain(run) : null
  const parent = run.triggeredBy.kind === 'run' ? run.triggeredBy.runId : undefined
  return (
    <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Related runs</div>
      {parent && (
        <div className="flex flex-wrap items-center gap-2">
          <GitBranch className="size-3.5 text-slate-400" />
          <span className="text-slate-600">Triggered by:</span>
          <RunRef id={parent} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="size-3.5 text-slate-400" />
        {run.triggeredRunIds.length > 0 ? (
          <>
            <span className="text-slate-600">Triggered:</span>
            {run.triggeredRunIds.map((id) => <RunRef key={id} id={id} />)}
          </>
        ) : (
          <span className="text-slate-500">No downstream runs triggered.</span>
        )}
      </div>
      {chain && (
        <div className="flex flex-wrap items-center gap-2">
          <Repeat className="size-3.5 text-slate-400" />
          <span className="text-slate-600">
            {run.retryOf ? (
              <>Retry of <Link to={`/runs/${run.retryOf}`} className="font-mono text-indigo-700 hover:underline">{run.retryOf}</Link> → this is attempt {run.attempt}.</>
            ) : (
              <>This run was retried.</>
            )}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {chain.map((r, i) => (
              <span key={r.id} className="inline-flex items-center gap-1">
                {i > 0 && <ArrowRight className="size-3 text-slate-400" />}
                <Link
                  to={`/runs/${r.id}`}
                  className={clsx(
                    'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs',
                    r.id === run.id ? 'border-indigo-300 bg-indigo-50 font-semibold' : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <span className="text-slate-500">#{r.attempt}</span>
                  <span className="font-mono">{r.id}</span>
                  <StatusDot run={r} />
                </Link>
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  )
}

function StatusDot({ run }: { run: Run }) {
  const map = { success: 'bg-emerald-500', failed: 'bg-red-500', partial: 'bg-amber-400', stuck: 'bg-orange-500', in_progress: 'bg-sky-500', awaiting_approval: 'bg-violet-500' }
  return <span className={clsx('size-1.5 rounded-full', map[run.status])} title={run.status} />
}

// ---------- Step timeline ----------

function StepTimeline({ run }: { run: Run }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(run.problemStepIndex !== undefined ? [run.problemStepIndex] : []))
  const toggle = (i: number) =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  return (
    <ol className="px-4 py-3">
      {run.steps.map((step, i) => (
        <StepNode key={i} run={run} step={step} last={i === run.steps.length - 1} open={open.has(i)} onToggle={() => toggle(i)} />
      ))}
    </ol>
  )
}

const STEP_ICON: Record<RunStep['status'], ReactNode> = {
  success: <Check className="size-3.5" strokeWidth={3} />,
  failed: <X className="size-3.5" strokeWidth={3} />,
  warning: <AlertTriangle className="size-3" strokeWidth={2.5} />,
  awaiting: <Clock className="size-3.5" strokeWidth={2.5} />,
  running: <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />,
  pending: <CircleDashed className="size-3.5" />,
}

const STEP_NODE_CLASS: Record<RunStep['status'], string> = {
  success: 'bg-emerald-500 text-white',
  failed: 'bg-red-500 text-white ring-4 ring-red-100',
  warning: 'bg-amber-400 text-white ring-4 ring-amber-100',
  awaiting: 'bg-violet-500 text-white ring-4 ring-violet-100',
  running: 'bg-sky-500 text-white ring-4 ring-sky-100',
  pending: 'bg-white text-slate-300 ring-1 ring-slate-200',
}

function StepNode({ run, step, last, open, onToggle }: { run: Run; step: RunStep; last: boolean; open: boolean; onToggle: () => void }) {
  const stalled = run.status === 'stuck' && step.status === 'running'
  const flagged = step.status === 'failed' || stalled
  const reached = step.status !== 'pending'
  return (
    <li className="relative flex gap-3 pb-3 last:pb-0">
      {!last && <span className={clsx('absolute left-[11px] top-7 bottom-0 w-px', reached ? 'bg-slate-200' : 'border-l border-dashed border-slate-200')} />}
      <span className={clsx('relative z-10 mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full', stalled ? 'bg-orange-500 text-white ring-4 ring-orange-100' : STEP_NODE_CLASS[step.status])}>
        {stalled ? <AlertTriangle className="size-3" strokeWidth={2.5} /> : STEP_ICON[step.status]}
      </span>
      <div
        className={clsx(
          'min-w-0 flex-1 rounded-md border',
          flagged ? (stalled ? 'border-orange-300 bg-orange-50/40' : 'border-red-300 bg-red-50/40') : 'border-slate-200',
          step.status === 'warning' && 'border-amber-300 bg-amber-50/40',
          step.status === 'awaiting' && 'border-violet-300 bg-violet-50/40',
        )}
      >
        <button onClick={onToggle} disabled={!reached} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left disabled:cursor-default" aria-expanded={open}>
          {reached ? <ChevronDown className={clsx('size-3.5 text-slate-400 transition-transform', !open && '-rotate-90')} /> : <span className="w-3.5" />}
          <span className={clsx('font-medium', reached ? 'text-slate-900' : 'text-slate-400')}>
            <span className="mr-1.5 text-xs tabular-nums text-slate-400">{step.index + 1}.</span>
            {step.name}
          </span>
          <SystemBadge id={step.system} withName />
          {stalled ? <StatusPill status="stuck" /> : <StepStatusPill status={step.status} />}
          <span className="ml-auto flex items-center gap-3 text-xs tabular-nums text-slate-500">
            {step.startedAt && <span>{fmtTime(step.startedAt)}</span>}
            {step.durationMs !== undefined && <span className={clsx('w-16 text-right', (flagged || step.status === 'awaiting') && 'font-medium text-slate-800')}>{fmtDuration(step.durationMs)}</span>}
          </span>
        </button>
        {open && reached && (
          <div className="space-y-3 border-t border-slate-200/70 px-3 py-3">
            {step.error && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-800">
                  <X className="size-3.5" /> Error · {step.error.code}
                </div>
                <p className="mt-1 break-words font-mono text-xs text-red-900">{step.error.message}</p>
              </div>
            )}
            {stalled && (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900">
                <span className="font-semibold">No response for {fmtDuration(step.durationMs ?? 0)}.</span> The request to {SYSTEM_BY_ID[step.system].name} has not returned; this step normally completes in a few seconds.
              </div>
            )}
            {step.status === 'warning' && run.caveat && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{run.caveat}</div>
            )}
            {step.status === 'awaiting' && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                <span>
                  Waiting on <b>{String(step.output?.approvalRequestedFrom ?? 'approver')}</b> in {String(step.output?.channel ?? 'Slack')} for {fmtDuration(step.durationMs ?? 0)}.
                </span>
                <span className="flex gap-2">
                  <ApprovalButtons run={run} size="sm" />
                </span>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Payload label="Input" data={step.input} />
              <Payload label="Output" data={step.output} empty={step.status === 'failed' ? 'No output — step failed' : 'No output yet'} />
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

function Payload({ label, data, empty }: { label: string; data?: Record<string, unknown>; empty?: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      {data ? (
        <pre className="overflow-auto rounded-md bg-slate-900 p-2.5 font-mono text-[11px] leading-relaxed text-slate-100">{JSON.stringify(data, null, 2)}</pre>
      ) : (
        <div className="rounded-md border border-dashed border-slate-200 p-2.5 text-xs text-slate-400">{empty}</div>
      )}
    </div>
  )
}

// ---------- Root cause / correlation ----------

function CorrelationPanel({ run }: { run: Run }) {
  const navigate = useNavigate()
  const c = correlate(run)!
  const sysName = SYSTEM_BY_ID[c.system].name
  const incident = activeIncidents().find((i) => i.key === signatureOf(run))
  const verb = run.status === 'stuck' ? 'stalled' : run.status === 'partial' ? 'hit a problem' : 'failed'
  const hours = CORRELATION_WINDOW_MS / 3_600_000

  if (c.related.length === 0) {
    return (
      <Card>
        <CardHeader title="Root cause correlation" />
        <div className="flex gap-3 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
            <Check className="size-4 text-slate-500" />
          </div>
          <div className="text-sm">
            <div className="font-medium text-slate-900">No related failures found — this run appears to be an isolated issue.</div>
            <p className="mt-1 text-xs text-slate-500">
              No other runs {verb === 'stalled' ? 'stalled or failed' : 'failed'} at &ldquo;{c.stepName}&rdquo; in {sysName} within {hours} hours of this run. Other workflows using {sysName} are not showing the same symptom.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const byWorkflow = new Map<string, number>()
  for (const r of c.related) byWorkflow.set(r.workflowId, (byWorkflow.get(r.workflowId) ?? 0) + 1)
  const all = [run, ...c.related]
  const link = runsUrl({ step: c.stepName, failedAt: c.system, from: c.windowStart, to: c.windowEnd })

  return (
    <Card className="border-red-200">
      <CardHeader
        title="Root cause correlation"
        right={incident && <Pill tone={SEVERITY[incident.severity]}>Active issue</Pill>}
      />
      <div className="space-y-3 p-4 text-sm">
        <p className="text-slate-800">
          This run {verb} at the same step (<b>&lsquo;{c.stepName}&rsquo;</b>), in the same system (<b>{sysName}</b>), as{' '}
          <b className="text-red-700">{c.related.length} other run{c.related.length > 1 ? 's' : ''}</b> within {hours} hours.
        </p>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-md bg-slate-50 py-2">
            <div className="text-lg font-semibold tabular-nums text-slate-900">{new Set(all.map((r) => r.workflowId)).size}</div>
            <div className="text-[11px] text-slate-500">workflows affected</div>
          </div>
          <div className="rounded-md bg-slate-50 py-2">
            <div className="text-lg font-semibold tabular-nums text-slate-900">{new Set(all.map((r) => r.agentId)).size}</div>
            <div className="text-[11px] text-slate-500">AI Employees affected</div>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Other affected workflows</div>
          <ul className="space-y-1">
            {[...byWorkflow].map(([wfId, n]) => (
              <li key={wfId} className="flex items-center justify-between text-xs">
                <span className="text-slate-700">
                  {WORKFLOW_BY_ID[wfId].name} <span className="text-slate-400">· {AGENT_BY_ID[WORKFLOW_BY_ID[wfId].agentId].name}</span>
                </span>
                <span className="tabular-nums font-medium text-slate-800">{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Most recent</div>
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
            {c.related.slice(0, 4).map((r) => (
              <li key={r.id}>
                <Link to={`/runs/${r.id}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs hover:bg-slate-50">
                  <span className="font-mono text-indigo-700">{r.id}</span>
                  <span className="truncate text-slate-500">{WORKFLOW_BY_ID[r.workflowId].name}</span>
                  <span className="shrink-0 text-slate-400">{fmtRelative(r.startedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <Button variant="primary" className="w-full" onClick={() => navigate(link)}>
          View all {c.related.length} related runs <ArrowRight className="size-3.5" />
        </Button>
        <p className="text-center text-[11px] text-slate-400">Opens the Runs table filtered to this failure signature (includes this run).</p>
      </div>
    </Card>
  )
}
