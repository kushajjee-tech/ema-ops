import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** Signed-in operator (mocked — no real auth in the prototype). */
export const CURRENT_USER = {
  name: 'Kushaj A.',
  initials: 'KA',
  role: 'Platform Admin',
  email: 'kushaj.a@acme-corp.com',
  team: 'Platform Operations',
  memberSince: 'March 2025',
}

export type ActivityKind = 'retry' | 'retry_step' | 'escalate' | 'resolve' | 'approve' | 'reject' | 'export'

export interface ActivityEntry {
  id: number
  kind: ActivityKind
  runIds: string[]
  at: number
  actor: string
  detail?: string
}

export const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  retry: 'Retry queued',
  retry_step: 'Retry from step queued',
  escalate: 'Escalated',
  resolve: 'Marked resolved',
  approve: 'Approved',
  reject: 'Rejected',
  export: 'Logs exported',
}

interface ActivityApi {
  entries: ActivityEntry[]
  record: (kind: ActivityKind, runIds: string[], detail?: string) => void
  /** Latest state-changing operator action on a run (exports excluded). */
  latestFor: (runId: string) => ActivityEntry | undefined
  forRun: (runId: string) => ActivityEntry[]
}

const Ctx = createContext<ActivityApi | null>(null)
let seq = 0

/**
 * Session-scoped record of operator actions. Actions are still mocked (nothing executes),
 * but the UI reflects them so the operator can see what they've already done. In production
 * this would be the server-side audit log.
 */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])

  const record = useCallback((kind: ActivityKind, runIds: string[], detail?: string) => {
    setEntries((e) => [{ id: ++seq, kind, runIds, at: Date.now(), actor: CURRENT_USER.name, detail }, ...e])
  }, [])

  const api = useMemo<ActivityApi>(
    () => ({
      entries,
      record,
      latestFor: (runId) => entries.find((e) => e.kind !== 'export' && e.runIds.includes(runId)),
      forRun: (runId) => entries.filter((e) => e.runIds.includes(runId)),
    }),
    [entries, record],
  )
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useActivity() {
  const api = useContext(Ctx)
  if (!api) throw new Error('useActivity must be used inside ActivityProvider')
  return api
}

export function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
