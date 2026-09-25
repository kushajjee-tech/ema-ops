import type { AIEmployee, ConnectedSystem, SystemId, Workflow } from './types'

export const SYSTEMS: ConnectedSystem[] = [
  { id: 'okta', name: 'Okta', category: 'Identity', badge: 'OK', color: '#1d4ed8' },
  { id: 'slack', name: 'Slack', category: 'Messaging', badge: 'SL', color: '#7c3aed' },
  { id: 'servicenow', name: 'ServiceNow', category: 'ITSM', badge: 'SN', color: '#15803d' },
  { id: 'sap', name: 'SAP', category: 'ERP', badge: 'SAP', color: '#0369a1' },
  { id: 'salesforce', name: 'Salesforce', category: 'CRM', badge: 'SF', color: '#0891b2' },
  { id: 'workday', name: 'Workday', category: 'HRIS', badge: 'WD', color: '#c2410c' },
  { id: 'zendesk', name: 'Zendesk', category: 'Support desk', badge: 'ZD', color: '#0f766e' },
]

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s])) as Record<
  SystemId,
  ConnectedSystem
>

function wf(
  id: string,
  agentId: string,
  name: string,
  description: string,
  steps: Workflow['steps'],
): Workflow {
  return { id, agentId, name, description, steps, expectedSec: steps.reduce((a, s) => a + s.avgSec, 0) }
}

export const WORKFLOWS: Workflow[] = [
  // IT Support Agent
  wf('wf-pwreset', 'agent-it', 'Password Reset', 'Resets a user’s AD password after identity verification.', [
    { name: 'Receive request', system: 'servicenow', avgSec: 3 },
    { name: 'Verify identity', system: 'okta', avgSec: 8 },
    { name: 'Reset AD password', system: 'okta', avgSec: 6 },
    { name: 'Notify user', system: 'slack', avgSec: 2 },
    { name: 'Close ticket', system: 'servicenow', avgSec: 3 },
  ]),
  wf('wf-access', 'agent-it', 'Access Request', 'Grants application access after manager approval.', [
    { name: 'Parse request', system: 'servicenow', avgSec: 4 },
    { name: 'Verify identity', system: 'okta', avgSec: 8 },
    { name: 'Manager approval', system: 'slack', avgSec: 5, approvalGate: true },
    { name: 'Provision access', system: 'okta', avgSec: 10 },
    { name: 'Update ticket', system: 'servicenow', avgSec: 3 },
  ]),
  wf('wf-offboard', 'agent-it', 'Employee Offboarding', 'Revokes access and closes out a departing employee.', [
    { name: 'Fetch termination record', system: 'workday', avgSec: 4 },
    { name: 'Verify identity', system: 'okta', avgSec: 8 },
    { name: 'Revoke SSO sessions', system: 'okta', avgSec: 12 },
    { name: 'Deactivate Slack account', system: 'slack', avgSec: 4 },
    { name: 'Close offboarding ticket', system: 'servicenow', avgSec: 3 },
  ]),
  // HR Onboarding Agent
  wf('wf-newhire', 'agent-hr', 'New Hire Onboarding', 'Creates accounts and kicks off IT provisioning for new hires.', [
    { name: 'Fetch new hire record', system: 'workday', avgSec: 5 },
    { name: 'Verify identity', system: 'okta', avgSec: 8 },
    { name: 'Create Okta account', system: 'okta', avgSec: 9 },
    { name: 'Send welcome message', system: 'slack', avgSec: 2 },
    { name: 'Request IT access', system: 'servicenow', avgSec: 4 },
  ]),
  wf('wf-benefits', 'agent-hr', 'Benefits Enrollment', 'Collects benefit elections and syncs payroll deductions.', [
    { name: 'Fetch employee profile', system: 'workday', avgSec: 4 },
    { name: 'Collect elections', system: 'slack', avgSec: 20 },
    { name: 'Sync payroll deductions', system: 'sap', avgSec: 15 },
    { name: 'Confirm enrollment', system: 'slack', avgSec: 2 },
  ]),
  wf('wf-offer', 'agent-hr', 'Offer Letter Generation', 'Drafts offer letters and routes them for approval.', [
    { name: 'Fetch candidate', system: 'workday', avgSec: 4 },
    { name: 'Draft offer letter', system: 'workday', avgSec: 12 },
    { name: 'Hiring manager approval', system: 'slack', avgSec: 5, approvalGate: true },
    { name: 'Send offer', system: 'workday', avgSec: 3 },
  ]),
  // Finance Ops Agent
  wf('wf-invoice', 'agent-fin', 'Invoice Processing', 'Extracts, matches and posts supplier invoices.', [
    { name: 'Extract invoice data', system: 'sap', avgSec: 10 },
    { name: 'Match purchase order', system: 'sap', avgSec: 6 },
    { name: 'Payment approval', system: 'slack', avgSec: 5, approvalGate: true },
    { name: 'Post journal entry', system: 'sap', avgSec: 7 },
  ]),
  wf('wf-expense', 'agent-fin', 'Expense Report Review', 'Policy-checks expense reports and posts reimbursements.', [
    { name: 'Fetch expense report', system: 'sap', avgSec: 4 },
    { name: 'Policy check', system: 'sap', avgSec: 9 },
    { name: 'Post journal entry', system: 'sap', avgSec: 7 },
    { name: 'Notify submitter', system: 'slack', avgSec: 2 },
  ]),
  wf('wf-vendor', 'agent-fin', 'Vendor Onboarding', 'Creates vendor master records and syncs to CRM.', [
    { name: 'Create vendor record', system: 'sap', avgSec: 8 },
    { name: 'Sync vendor account', system: 'salesforce', avgSec: 6 },
    { name: 'Notify procurement', system: 'slack', avgSec: 2 },
  ]),
  // Customer Support Agent
  wf('wf-triage', 'agent-cs', 'Ticket Triage', 'Classifies inbound tickets and routes them to the right queue.', [
    { name: 'Fetch ticket', system: 'zendesk', avgSec: 2 },
    { name: 'Classify intent', system: 'zendesk', avgSec: 4 },
    { name: 'Lookup account', system: 'salesforce', avgSec: 3 },
    { name: 'Route ticket', system: 'zendesk', avgSec: 2 },
  ]),
  wf('wf-refund', 'agent-cs', 'Refund Request', 'Validates refund eligibility and issues refunds.', [
    { name: 'Fetch order', system: 'salesforce', avgSec: 3 },
    { name: 'Validate eligibility', system: 'salesforce', avgSec: 5 },
    { name: 'Issue refund', system: 'sap', avgSec: 8 },
    { name: 'Notify customer', system: 'zendesk', avgSec: 2 },
  ]),
  wf('wf-acctupdate', 'agent-cs', 'Account Update', 'Applies customer-requested changes to CRM records.', [
    { name: 'Lookup account', system: 'salesforce', avgSec: 3 },
    { name: 'Update CRM record', system: 'salesforce', avgSec: 4 },
    { name: 'Confirm with customer', system: 'zendesk', avgSec: 2 },
  ]),
]

export const WORKFLOW_BY_ID = Object.fromEntries(WORKFLOWS.map((w) => [w.id, w])) as Record<string, Workflow>

export const AGENTS: AIEmployee[] = [
  { id: 'agent-it', name: 'IT Support Agent', role: 'Handles password resets, access requests and offboarding.' },
  { id: 'agent-hr', name: 'HR Onboarding Agent', role: 'Onboards new hires and manages benefits and offers.' },
  { id: 'agent-fin', name: 'Finance Ops Agent', role: 'Processes invoices, expenses and vendor setup.' },
  { id: 'agent-cs', name: 'Customer Support Agent', role: 'Triages tickets, handles refunds and account changes.' },
].map((a) => ({ ...a, workflowIds: WORKFLOWS.filter((w) => w.agentId === a.id).map((w) => w.id) }))

export const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a])) as Record<string, AIEmployee>

export function workflowSystems(w: Workflow): SystemId[] {
  return [...new Set(w.steps.map((s) => s.system))]
}
