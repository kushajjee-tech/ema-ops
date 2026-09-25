import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button, Modal } from '../components/ui'
import { SYSTEM_BY_ID } from '../data/catalog'
import type { Run, SystemId } from '../data/types'
import { useActivity } from './activity'
import { problemStep, systemSummary } from './analysis'

/**
 * Prototype actions: nothing actually executes. Destructive / bulk actions go through a
 * confirmation dialog, then report via toast. In production these would be role-gated.
 */

interface ConfirmOpts {
  title: string
  body: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}

const ConfirmCtx = createContext<(o: ConfirmOpts) => void>(() => {})

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const close = useCallback(() => setOpts(null), [])
  return (
    <ConfirmCtx.Provider value={setOpts}>
      {children}
      <Modal
        open={!!opts}
        onClose={close}
        title={opts?.title ?? ''}
        footer={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              variant={opts?.danger ? 'danger' : 'primary'}
              onClick={() => {
                opts?.onConfirm()
                close()
              }}
            >
              {opts?.confirmLabel}
            </Button>
          </>
        }
      >
        {opts?.body}
      </Modal>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)

export type BulkAction = 'retry' | 'escalate' | 'resolve'

const BULK_COPY: Record<BulkAction, { verb: string; done: (n: number) => string }> = {
  retry: { verb: 'Retry', done: (n) => `Retry queued for ${n} run${n === 1 ? '' : 's'}` },
  escalate: { verb: 'Escalate', done: (n) => `${n} run${n === 1 ? '' : 's'} escalated to the on-call owner` },
  resolve: { verb: 'Mark resolved', done: (n) => `${n} run${n === 1 ? '' : 's'} marked as resolved` },
}

/** Only runs that went wrong can be retried, escalated or resolved. */
export const isActionable = (r: Run) => r.status === 'failed' || r.status === 'stuck' || r.status === 'partial'

const plural = (n: number) => `${n} run${n === 1 ? '' : 's'}`

export function useBulkAction() {
  const confirm = useConfirm()
  const { record } = useActivity()
  return (action: BulkAction, selection: Run[], after?: () => void) => {
    const c = BULK_COPY[action]
    const runs = selection.filter(isActionable)
    const skipped = selection.length - runs.length
    if (runs.length === 0) {
      toast.error(`Nothing to ${c.verb.toLowerCase()}`, {
        description: 'Only Failed, Stuck or Partial runs can be retried, escalated or resolved.',
      })
      return
    }
    // Retrying into a system that is still down will just fail again — say so up front.
    const downSystems =
      action === 'retry'
        ? [...new Set(runs.map((r) => problemStep(r)?.system).filter(Boolean) as SystemId[])].filter(
            (id) => systemSummary(id).status === 'down',
          )
        : []
    confirm({
      title: `${c.verb} ${plural(runs.length)}?`,
      body: (
        <div className="space-y-2">
          {downSystems.length > 0 && (
            <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>
                <b>{downSystems.map((id) => SYSTEM_BY_ID[id].name).join(', ')}</b> {downSystems.length > 1 ? 'are' : 'is'} currently
                Down. Retries will most likely fail again until the system recovers.
              </span>
            </div>
          )}
          <p>This will {c.verb.toLowerCase()} the following runs:</p>
          <p className="max-h-32 overflow-auto rounded bg-slate-50 p-2 font-mono text-xs text-slate-600">{runs.map((r) => r.id).join(', ')}</p>
          {skipped > 0 && (
            <p className="text-xs text-slate-500">
              {plural(skipped)} skipped: they succeeded, are still running or are awaiting approval.
            </p>
          )}
          <p className="text-xs text-slate-400">Prototype: no real execution takes place.</p>
        </div>
      ),
      confirmLabel: downSystems.length ? `${c.verb} anyway` : c.verb,
      danger: downSystems.length > 0,
      onConfirm: () => {
        record(action, runs.map((r) => r.id))
        toast.success(c.done(runs.length))
        after?.()
      },
    })
  }
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
