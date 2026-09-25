import { WORKFLOWS, WORKFLOW_BY_ID } from './catalog'
import type { Run, RunError, RunStatus, RunStep, StepStatus, SystemId, TriggerSource, Workflow } from './types'

/**
 * Deterministic mock-data generator. Structure is seeded (same runs every load);
 * timestamps are anchored to "now" so the dashboard always looks live.
 */

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const NOW = Math.floor(Date.now() / MIN) * MIN

/** A run still in progress longer than this multiple of its expected duration is Stuck. */
export const STUCK_MULTIPLIER = 3

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(20260925)
const rand = (min: number, max: number) => min + rng() * (max - min)
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1))
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]

const FIRST = ['Priya', 'Marcus', 'Elena', 'Jamal', 'Sofia', 'Kenji', 'Aisha', 'Liam', 'Noor', 'Diego', 'Hannah', 'Wei', 'Olu', 'Maya', 'Tomas', 'Grace']
const LAST = ['Shah', 'Reed', 'Rossi', 'Okafor', 'Lindqvist', 'Tanaka', 'Haddad', 'Murphy', 'Karimi', 'Alvarez', 'Becker', 'Chen', 'Adeyemi', 'Patel', 'Novak', 'Kim']
const VENDORS = ['Acme Industrial', 'Northwind Supply', 'Globex Logistics', 'Initech Services', 'Umbrella Office', 'Stark Components']
const CUSTOMERS = ['Brightline Health', 'Copperleaf Retail', 'Halcyon Labs', 'Meridian Bank', 'Tidewater Foods', 'Vantage Air']
const APPS = ['GitHub Enterprise', 'Figma', 'Snowflake', 'Jira', 'Tableau', 'AWS Console']

interface Ctx {
  person: string
  email: string
  ticket: string
  invoice: string
  vendor: string
  amount: number
  customer: string
  order: string
  app: string
}

function makeCtx(): Ctx {
  const f = pick(FIRST)
  const l = pick(LAST)
  return {
    person: `${f} ${l}`,
    email: `${f}.${l}`.toLowerCase() + '@acme-corp.com',
    ticket: `INC00${randInt(41000, 49999)}`,
    invoice: `INV-2026-${randInt(10000, 99999)}`,
    vendor: pick(VENDORS),
    amount: Math.round(rand(120, 48000) * 100) / 100,
    customer: pick(CUSTOMERS),
    order: `SO-${randInt(700000, 799999)}`,
    app: pick(APPS),
  }
}

function trigger(w: Workflow, ctx: Ctx): TriggerSource {
  switch (w.agentId) {
    case 'agent-it':
      return rng() < 0.6
        ? { kind: 'event', label: `ServiceNow ${ctx.ticket}` }
        : { kind: 'user', label: `Slack · @${ctx.email.split('@')[0]}` }
    case 'agent-hr':
      return w.id === 'wf-benefits'
        ? { kind: 'user', label: `Slack · @${ctx.email.split('@')[0]}` }
        : { kind: 'event', label: 'Workday · worker event' }
    case 'agent-fin':
      return rng() < 0.5
        ? { kind: 'schedule', label: 'Schedule · every 30 min' }
        : { kind: 'event', label: `AP inbox · ${ctx.invoice}` }
    default:
      return { kind: 'event', label: `Zendesk #${randInt(88000, 99999)}` }
  }
}

function payload(step: { name: string; system: SystemId }, ctx: Ctx): { input: Record<string, unknown>; output: Record<string, unknown> } {
  switch (step.system) {
    case 'okta':
      return {
        input: { user: ctx.email, operation: step.name, factor: 'okta_verify_push' },
        output: { oktaUserId: `00u${randInt(100000, 999999)}abc`, result: 'SUCCESS', sessionId: `102${randInt(10000, 99999)}` },
      }
    case 'slack':
      return {
        input: { channel: step.name.includes('approval') ? '#approvals' : `@${ctx.email.split('@')[0]}`, template: step.name.toLowerCase().replace(/ /g, '_') },
        output: { ok: true, ts: `${Math.floor(NOW / 1000)}.${randInt(100000, 999999)}` },
      }
    case 'servicenow':
      return {
        input: { table: 'incident', number: ctx.ticket, requestedFor: ctx.person, item: ctx.app },
        output: { sys_id: `a${randInt(1e6, 9e6)}f3`, state: step.name.startsWith('Close') ? 'Closed' : 'In Progress' },
      }
    case 'sap':
      return {
        input: { companyCode: '1000', document: ctx.invoice, vendor: ctx.vendor, amount: ctx.amount, currency: 'USD' },
        output: { documentNumber: `51000${randInt(10000, 99999)}`, fiscalYear: 2026, status: 'POSTED' },
      }
    case 'salesforce':
      return {
        input: { object: 'Account', account: ctx.customer, order: ctx.order },
        output: { accountId: `001${randInt(1e6, 9e6)}AAA`, tier: pick(['Enterprise', 'Growth', 'Standard']) },
      }
    case 'workday':
      return {
        input: { worker: ctx.person, email: ctx.email, eventType: step.name },
        output: { workerId: `W${randInt(100000, 999999)}`, department: pick(['Engineering', 'Sales', 'Finance', 'Marketing']), startDate: '2026-10-05' },
      }
    case 'zendesk':
      return {
        input: { ticketId: randInt(88000, 99999), requester: ctx.customer, channel: 'email' },
        output: { intent: pick(['billing', 'refund', 'bug_report', 'account_change']), priority: pick(['normal', 'high']), queue: 'tier-1' },
      }
  }
}

const RANDOM_ERRORS: Record<SystemId, RunError[]> = {
  okta: [{ code: 'E0000047', message: 'API call exceeded rate limit due to too many requests (429).', summary: 'Okta rate limit' }],
  slack: [{ code: 'channel_not_found', message: 'chat.postMessage failed: channel_not_found — user may have left the workspace.', summary: 'Slack channel not found' }],
  servicenow: [{ code: 'HTTP 403', message: 'User integration.ema lacks ACL write access on table [incident].', summary: 'ServiceNow permission denied' }],
  sap: [{ code: 'M8 082', message: 'Purchase order 4500018832 not found for vendor; 3-way match cannot be performed.', summary: 'SAP PO not found' }],
  salesforce: [{ code: 'INVALID_FIELD', message: "No such column 'Support_Tier__c' on entity 'Account'. Field may have been renamed.", summary: 'Salesforce schema mismatch' }],
  workday: [{ code: 'HTTP 404', message: 'Worker record not found for given effective date.', summary: 'Workday record missing' }],
  zendesk: [{ code: 'HTTP 422', message: 'Ticket is closed and cannot be updated.', summary: 'Zendesk ticket closed' }],
}

const OKTA_TIMEOUTS = [
  'OktaApiError: POST /api/v1/authn/factors/verify timed out after 30000ms (HTTP 504 Gateway Timeout).',
  'OktaApiError: upstream request timeout after 30000ms — verify factor challenge did not complete (HTTP 504).',
  'OktaApiError: POST /api/v1/authn timed out after 30000ms (HTTP 504 Gateway Timeout).',
]

type Outcome =
  | { kind: 'success' }
  | { kind: 'failed'; step: number; error: RunError }
  | { kind: 'partial'; step: number; caveat: string }
  | { kind: 'awaiting'; step: number }
  | { kind: 'running'; step: number }

interface Draft extends Run {
  key: string
}

let keySeq = 0

function buildRun(w: Workflow, startedAt: number, outcome: Outcome, opts: { triggeredBy?: TriggerSource } = {}): Draft {
  const ctx = makeCtx()
  const steps: RunStep[] = []
  let t = startedAt
  let problemStepIndex: number | undefined
  let status = 'success' as RunStatus
  let caveat: string | undefined

  w.steps.forEach((tpl, i) => {
    const base: RunStep = { index: i, name: tpl.name, system: tpl.system, status: 'pending' }
    const stopAt = outcome.kind === 'success' || outcome.kind === 'partial' ? Infinity : outcome.step
    if (i > stopAt) {
      steps.push(base)
      return
    }
    const p = payload(tpl, ctx)
    let stepStatus: StepStatus = 'success'
    let durationMs = Math.round(tpl.avgSec * rand(0.6, 1.6) * 1000)
    let error: RunError | undefined
    let output: Record<string, unknown> | undefined = p.output

    if (i === stopAt && outcome.kind === 'failed') {
      stepStatus = 'failed'
      error = outcome.error
      output = undefined
      if (error.summary === 'Okta timeout') durationMs = 30_000 + randInt(5, 400)
      problemStepIndex = i
      status = 'failed'
    } else if (i === stopAt && outcome.kind === 'awaiting') {
      stepStatus = 'awaiting'
      output = { approvalRequestedFrom: `@${pick(FIRST).toLowerCase()}.${pick(LAST).toLowerCase()}`, channel: '#approvals' }
      durationMs = NOW - t
      problemStepIndex = i
      status = 'awaiting_approval'
    } else if (i === stopAt && outcome.kind === 'running') {
      stepStatus = 'running'
      output = undefined
      durationMs = NOW - t
      problemStepIndex = i
      status = 'in_progress'
    } else if (outcome.kind === 'partial' && i === outcome.step) {
      stepStatus = 'warning'
      caveat = outcome.caveat
      problemStepIndex = i
      status = 'partial'
    }

    steps.push({ ...base, status: stepStatus, startedAt: t, durationMs, input: p.input, output, error })
    t += durationMs + randInt(100, 900)
  })

  const live = status === 'in_progress' || status === 'awaiting_approval'
  // Derived: an in-progress run well past its expected duration is Stuck.
  if (status === 'in_progress' && NOW - startedAt > w.expectedSec * 1000 * STUCK_MULTIPLIER) status = 'stuck'

  return {
    key: `k${keySeq++}`,
    id: '',
    agentId: w.agentId,
    workflowId: w.id,
    status,
    startedAt,
    endedAt: live ? undefined : t,
    durationMs: live ? NOW - startedAt : t - startedAt,
    triggeredBy: opts.triggeredBy ?? trigger(w, ctx),
    steps,
    problemStepIndex,
    attempt: 1,
    triggeredRunIds: [],
    caveat,
  }
}

/**
 * Business-hours-weighted timestamp between `from` and `to` ms ago. Always consumes exactly
 * two random draws so run IDs stay stable regardless of the time of day the app is opened.
 */
function randomTime(fromAgo: number, toAgo: number): number {
  let ts = NOW - rand(toAgo, fromAgo)
  const shift = rng() < 0.65
  const h = new Date(ts).getHours()
  if (shift && (h < 8 || h > 19)) {
    const moved = ts + (h < 8 ? 10 : -10) * HOUR
    if (moved <= NOW - toAgo && moved >= NOW - fromAgo) ts = moved
  }
  return Math.round(ts)
}

const RECENT_QUIET = 24 * HOUR

function backgroundOutcome(w: Workflow, startedAt: number): Outcome {
  // Draw everything up front so the random sequence doesn't depend on wall-clock time.
  const r = rng()
  const step = randInt(0, w.steps.length - 1)
  const skipped = randInt(2, 6)
  const error = pick(RANDOM_ERRORS[w.steps[step].system])
  // Keep random noise out of the recent window so only the deliberate clusters surface as incidents.
  if (NOW - startedAt < RECENT_QUIET) return { kind: 'success' }
  if (r < 0.06) return w.steps[step].approvalGate ? { kind: 'success' } : { kind: 'failed', step, error }
  if (r < 0.095) {
    return { kind: 'partial', step, caveat: `${w.steps[step].name} completed with warnings: 1 of ${skipped} records skipped (validation).` }
  }
  return { kind: 'success' }
}

function link(parent: Draft, child: Draft) {
  parent.triggeredRunIds.push(child.key)
  child.triggeredBy = { kind: 'run', label: WORKFLOW_BY_ID[parent.workflowId].name, runId: parent.key }
}

function retry(original: Draft, retryRun: Draft) {
  original.retriedBy = retryRun.key
  retryRun.retryOf = original.key
  retryRun.attempt = original.attempt + 1
  retryRun.triggeredBy = { kind: 'user', label: 'Manual retry · ops@acme-corp.com' }
}

function generate(): Run[] {
  const drafts: Draft[] = []
  const wfs = WORKFLOW_BY_ID

  // 1. Background traffic: ~7 days, heavier in the last 24h.
  const volume: Record<string, number> = {
    'wf-pwreset': 28, 'wf-access': 20, 'wf-offboard': 10,
    'wf-newhire': 18, 'wf-benefits': 18, 'wf-offer': 12,
    'wf-invoice': 24, 'wf-expense': 18, 'wf-vendor': 10,
    'wf-triage': 36, 'wf-refund': 16, 'wf-acctupdate': 14,
  }
  for (const w of WORKFLOWS) {
    for (let i = 0; i < volume[w.id]; i++) {
      const recent = rng() < 0.42
      // Okta workflows were healthy until the outage began ~2h ago.
      const minAgo = w.steps.some((s) => s.name === 'Verify identity') ? 2.2 * HOUR : 20 * MIN
      const ts = recent ? randomTime(24 * HOUR, minAgo) : randomTime(7 * DAY, 24 * HOUR)
      drafts.push(buildRun(w, ts, backgroundOutcome(w, ts)))
    }
  }

  // 2. Correlated cluster: Okta "Verify identity" timeouts across 4 workflows / 2 agents, last ~2h.
  const clusterPlan: [string, number][] = [
    ['wf-pwreset', 114], ['wf-access', 109], ['wf-pwreset', 104], ['wf-offboard', 99],
    ['wf-access', 94], ['wf-pwreset', 89], ['wf-newhire', 84], ['wf-access', 78],
    ['wf-pwreset', 72], ['wf-offboard', 66], ['wf-pwreset', 60], ['wf-access', 54],
    ['wf-pwreset', 48], ['wf-offboard', 42], ['wf-access', 36], ['wf-pwreset', 31],
    ['wf-pwreset', 26], ['wf-access', 21], ['wf-offboard', 16], ['wf-pwreset', 12],
    ['wf-access', 8], ['wf-pwreset', 4],
  ]
  const oktaTimeout = (): Outcome => ({
    kind: 'failed', step: 1, error: { code: 'HTTP 504', message: pick(OKTA_TIMEOUTS), summary: 'Okta timeout' },
  })
  const cluster = clusterPlan.map(([id, minsAgo]) =>
    // "Verify identity" is step index 1 in every affected workflow.
    buildRun(wfs[id], NOW - minsAgo * MIN - randInt(0, 50) * 1000, oktaTimeout()),
  )
  drafts.push(...cluster)
  // Retry chains inside the cluster: retries keep failing at the same step.
  const retry2 = buildRun(wfs['wf-pwreset'], cluster[2].startedAt + 12 * MIN, oktaTimeout())
  retry(cluster[2], retry2)
  const chainB2 = buildRun(wfs['wf-access'], cluster[4].startedAt + 9 * MIN, oktaTimeout())
  const chainB3 = buildRun(wfs['wf-access'], chainB2.startedAt + 20 * MIN, oktaTimeout())
  retry(cluster[4], chainB2)
  retry(chainB2, chainB3)
  drafts.push(retry2, chainB2, chainB3)

  // 3. Smaller SAP cluster: journal postings rejected (period closed).
  const sapErr: RunError = {
    code: 'F5 201',
    message: 'BAPI_ACC_DOCUMENT_POST returned E: Posting period 009 2026 is not open for company code 1000.',
    summary: 'SAP posting period closed',
  }
  const sapCaveat = 'Period 009 closed — reimbursement posted to suspense account 199999; manual reclass required.'
  drafts.push(
    buildRun(wfs['wf-invoice'], NOW - 5.1 * HOUR, { kind: 'failed', step: 3, error: sapErr }),
    buildRun(wfs['wf-expense'], NOW - 4.4 * HOUR, { kind: 'failed', step: 2, error: sapErr }),
    buildRun(wfs['wf-invoice'], NOW - 3.6 * HOUR, {
      kind: 'partial', step: 3, caveat: 'Period 009 closed — invoice parked in suspense account 199999; manual reclass required.',
    }),
    buildRun(wfs['wf-expense'], NOW - 2.8 * HOUR, { kind: 'partial', step: 2, caveat: sapCaveat }),
    buildRun(wfs['wf-invoice'], NOW - 1.9 * HOUR, { kind: 'failed', step: 3, error: sapErr }),
    buildRun(wfs['wf-expense'], NOW - 1.2 * HOUR, { kind: 'failed', step: 2, error: sapErr }),
    buildRun(wfs['wf-expense'], NOW - 47 * MIN, { kind: 'partial', step: 2, caveat: sapCaveat }),
    buildRun(wfs['wf-invoice'], NOW - 22 * MIN, { kind: 'failed', step: 3, error: sapErr }),
  )

  // 4. Isolated recent failure (demonstrates the "no related failures" state).
  drafts.push(buildRun(wfs['wf-offer'], NOW - 36 * MIN, { kind: 'failed', step: 1, error: RANDOM_ERRORS.workday[0] }))

  // 5. Older retry chains that recovered.
  const poFail = buildRun(wfs['wf-invoice'], NOW - 2 * DAY - 3 * HOUR, { kind: 'failed', step: 1, error: RANDOM_ERRORS.sap[0] })
  const poRetry = buildRun(wfs['wf-invoice'], poFail.startedAt + 25 * MIN, { kind: 'success' })
  retry(poFail, poRetry)
  const slackFail = buildRun(wfs['wf-offboard'], NOW - 4 * DAY - 5 * HOUR, { kind: 'failed', step: 3, error: RANDOM_ERRORS.slack[0] })
  const slackRetry = buildRun(wfs['wf-offboard'], slackFail.startedAt + 40 * MIN, { kind: 'success' })
  retry(slackFail, slackRetry)
  drafts.push(poFail, poRetry, slackFail, slackRetry)

  // 6. Cross-agent trigger: HR onboarding kicked off an IT access request now awaiting approval.
  const onboarding = buildRun(wfs['wf-newhire'], NOW - 2.6 * HOUR, { kind: 'success' })
  const accessReq = buildRun(wfs['wf-access'], onboarding.startedAt + 45_000, { kind: 'awaiting', step: 2 })
  link(onboarding, accessReq)
  drafts.push(onboarding, accessReq)
  // Older onboarding → access request pairs.
  for (const daysAgo of [1.4, 3.2, 4.1, 5.4, 6.3]) {
    const o = buildRun(wfs['wf-newhire'], NOW - daysAgo * DAY, { kind: 'success' })
    const a = buildRun(wfs['wf-access'], o.startedAt + 40_000, { kind: 'success' })
    link(o, a)
    drafts.push(o, a)
  }

  // 7. Human-in-the-loop approvals pending.
  drafts.push(
    buildRun(wfs['wf-invoice'], NOW - 58 * MIN, { kind: 'awaiting', step: 2 }),
    buildRun(wfs['wf-invoice'], NOW - 2.3 * HOUR, { kind: 'awaiting', step: 2 }),
    buildRun(wfs['wf-offer'], NOW - 4.2 * HOUR, { kind: 'awaiting', step: 2 }),
    buildRun(wfs['wf-offer'], NOW - 26 * MIN, { kind: 'awaiting', step: 2 }),
  )

  // 8. In progress (fresh) and Stuck (well past expected duration).
  drafts.push(
    buildRun(wfs['wf-triage'], NOW - 25_000, { kind: 'running', step: 2 }),
    buildRun(wfs['wf-triage'], NOW - 4_000, { kind: 'running', step: 0 }),
    buildRun(wfs['wf-expense'], NOW - 14_000, { kind: 'running', step: 1 }),
    buildRun(wfs['wf-acctupdate'], NOW - 6_000, { kind: 'running', step: 1 }),
    buildRun(wfs['wf-refund'], NOW - 8_000, { kind: 'running', step: 1 }),
    buildRun(wfs['wf-vendor'], NOW - 5_000, { kind: 'running', step: 0 }),
    buildRun(wfs['wf-benefits'], NOW - 3.3 * HOUR, { kind: 'running', step: 2 }),
    buildRun(wfs['wf-offboard'], NOW - 2.7 * HOUR, { kind: 'running', step: 4 }),
  )

  // Assign human-readable IDs in chronological order, then resolve draft keys to IDs.
  drafts.sort((a, b) => a.startedAt - b.startedAt)
  const idByKey = new Map<string, string>()
  let n = 48120
  for (const d of drafts) {
    n += randInt(3, 17)
    idByKey.set(d.key, `RUN-${n}`)
  }
  return drafts.map(({ key, ...d }) => {
    const r: Run = { ...d, id: idByKey.get(key)! }
    if (r.retryOf) r.retryOf = idByKey.get(r.retryOf)
    if (r.retriedBy) r.retriedBy = idByKey.get(r.retriedBy)
    r.triggeredRunIds = r.triggeredRunIds.map((k) => idByKey.get(k)!)
    if (r.triggeredBy.kind === 'run') r.triggeredBy = { ...r.triggeredBy, runId: idByKey.get(r.triggeredBy.runId)! }
    return r
  })
}

export const RUNS: Run[] = generate().sort((a, b) => b.startedAt - a.startedAt)
export const RUN_BY_ID = new Map(RUNS.map((r) => [r.id, r]))
