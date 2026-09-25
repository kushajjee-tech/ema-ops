import { ConnectedSystemsTable } from '../components/ConnectedSystemsTable'
import { RunsTable } from '../components/RunsTable'
import { Card, PageHeader } from '../components/ui'
import { RUNS } from '../data/seed'

export function RunsPage() {
  return (
    <div>
      <PageHeader title="Runs" subtitle={`All runs across every AI Employee · ${RUNS.length} in the last 7 days`} />
      <RunsTable />
    </div>
  )
}

export function SystemsPage() {
  return (
    <div>
      <PageHeader
        title="Connected Systems"
        subtitle="External systems AI Employees depend on. Status is derived from recent failures at each system (Down: 6+ in 2h, Degraded: 2+ in 6h)."
      />
      <Card>
        <ConnectedSystemsTable />
      </Card>
    </div>
  )
}
