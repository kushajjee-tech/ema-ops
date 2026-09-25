export type RunStatus =
  | 'success'
  | 'failed'
  | 'partial'
  | 'awaiting_approval'
  | 'in_progress'
  | 'stuck'

export type StepStatus =
  | 'success'
  | 'failed'
  | 'warning'
  | 'running'
  | 'awaiting'
  | 'pending'

export type SystemId =
  | 'okta'
  | 'slack'
  | 'servicenow'
  | 'sap'
  | 'salesforce'
  | 'workday'
  | 'zendesk'

export interface ConnectedSystem {
  id: SystemId
  name: string
  category: string
  /** Short badge label + color used in place of a logo. */
  badge: string
  color: string
}

export interface StepTemplate {
  name: string
  system: SystemId
  /** Typical duration in seconds. */
  avgSec: number
  /** Human-in-the-loop gate: runs may pause here awaiting approval. */
  approvalGate?: boolean
}

export interface Workflow {
  id: string
  agentId: string
  name: string
  description: string
  steps: StepTemplate[]
  /** Expected end-to-end duration in seconds (excluding approval waits). */
  expectedSec: number
}

export interface AIEmployee {
  id: string
  name: string
  role: string
  workflowIds: string[]
}

export interface RunStep {
  index: number
  name: string
  system: SystemId
  status: StepStatus
  startedAt?: number
  durationMs?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  error?: RunError
}

export interface RunError {
  code: string
  message: string
  /** Short label used to title incidents, e.g. "Okta timeout". */
  summary: string
}

export type TriggerSource =
  | { kind: 'user'; label: string }
  | { kind: 'schedule'; label: string }
  | { kind: 'event'; label: string }
  | { kind: 'run'; label: string; runId: string }

export interface Run {
  id: string
  agentId: string
  workflowId: string
  status: RunStatus
  startedAt: number
  endedAt?: number
  durationMs: number
  triggeredBy: TriggerSource
  steps: RunStep[]
  /** Index of the step that failed / warned / is blocked, if any. */
  problemStepIndex?: number
  retryOf?: string
  retriedBy?: string
  attempt: number
  triggeredRunIds: string[]
  caveat?: string
}
