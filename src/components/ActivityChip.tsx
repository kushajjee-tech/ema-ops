import { CheckCheck, RotateCcw, ShieldAlert, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { ACTIVITY_LABEL, fmtClock, useActivity, type ActivityEntry, type ActivityKind } from '../lib/activity'

const ICON: Partial<Record<ActivityKind, ReactNode>> = {
  retry: <RotateCcw className="size-3" />,
  retry_step: <RotateCcw className="size-3" />,
  escalate: <ShieldAlert className="size-3" />,
  resolve: <CheckCheck className="size-3" />,
  approve: <ThumbsUp className="size-3" />,
  reject: <ThumbsDown className="size-3" />,
}

/** Neutral chip showing the operator action taken on a run (distinct from run status colors). */
export function ActivityChip({ entry, compact }: { entry: ActivityEntry; compact?: boolean }) {
  return (
    <span
      title={`${ACTIVITY_LABEL[entry.kind]} by ${entry.actor} at ${fmtClock(entry.at)}`}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20"
    >
      {ICON[entry.kind]}
      {ACTIVITY_LABEL[entry.kind]}
      {!compact && <span className="font-normal text-indigo-500">· {entry.actor}</span>}
    </span>
  )
}

export function LatestActivityChip({ runId, compact }: { runId: string; compact?: boolean }) {
  const entry = useActivity().latestFor(runId)
  return entry ? <ActivityChip entry={entry} compact={compact} /> : null
}
