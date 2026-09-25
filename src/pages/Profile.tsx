import { Check, History, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar } from '../components/UserMenu'
import { Button, Card, CardHeader, Empty } from '../components/ui'
import { RUN_BY_ID } from '../data/seed'
import { WORKFLOW_BY_ID } from '../data/catalog'
import { ACTIVITY_LABEL, CURRENT_USER, fmtClock, useActivity } from '../lib/activity'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const PERMISSIONS = [
  'View all AI Employees, runs and connected systems',
  'Retry, escalate and resolve runs (single and bulk)',
  'Approve or reject human-in-the-loop steps',
  'Configure connected systems and credentials',
  'Manage users, roles and notification policies',
]

const CHANNELS = ['In-app', 'Email', 'Slack', 'PagerDuty'] as const
type Channel = (typeof CHANNELS)[number]

const EVENTS = [
  { id: 'critical', label: 'Critical issue detected', hint: 'Correlated failures across workflows' },
  { id: 'warning', label: 'Warning issue detected', hint: 'Smaller failure clusters' },
  { id: 'approval', label: 'Run awaiting my approval', hint: 'Human-in-the-loop steps' },
  { id: 'stuck', label: 'Run stuck', hint: 'Running > 3× expected duration' },
  { id: 'digest', label: 'Daily health digest', hint: 'Summary at 9:00 AM' },
] as const

type Prefs = Record<string, Channel[]>

const DEFAULT_PREFS: Prefs = {
  critical: ['In-app', 'Slack', 'PagerDuty'],
  warning: ['In-app', 'Slack'],
  approval: ['In-app', 'Email'],
  stuck: ['In-app'],
  digest: ['Email'],
}
const PREFS_KEY = 'ema-ops.notification-prefs'

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

export function Profile() {
  useDocumentTitle('My profile')
  const { hash } = useLocation()
  const { entries } = useActivity()
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [dirty, setDirty] = useState(false)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const toggle = (event: string, ch: Channel) => {
    setPrefs((p) => {
      const cur = new Set(p[event] ?? [])
      if (cur.has(ch)) cur.delete(ch)
      else cur.add(ch)
      return { ...p, [event]: CHANNELS.filter((c) => cur.has(c)) }
    })
    setDirty(true)
  }

  const save = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      /* storage unavailable — keep in memory */
    }
    setDirty(false)
    toast.success('Notification preferences saved')
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-4 p-5">
          <Avatar size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">{CURRENT_USER.name}</h1>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                {CURRENT_USER.role}
              </span>
            </div>
            <p className="text-sm text-slate-500">{CURRENT_USER.email}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 px-5 py-3 text-sm sm:grid-cols-4">
          {[
            ['Team', CURRENT_USER.team],
            ['Role', CURRENT_USER.role],
            ['Time zone', timezone],
            ['Member since', CURRENT_USER.memberSince],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{k}</dt>
              <dd className="mt-0.5 text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader title="Access & permissions" subtitle={`Granted by the ${CURRENT_USER.role} role`} />
          <ul className="space-y-2 px-4 py-3 text-sm">
            {PERMISSIONS.map((p) => (
              <li key={p} className="flex gap-2 text-slate-700">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                {p}
              </li>
            ))}
          </ul>
          <p className="flex gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            In production these permissions are enforced server-side per role. This prototype does not enforce them.
          </p>
        </Card>

        <Card>
          <div id="notifications" className="scroll-mt-4" />
          <CardHeader
            title="Notification preferences"
            subtitle="Where you are alerted for each event"
            right={
              <Button size="sm" variant="primary" disabled={!dirty} onClick={save}>
                Save
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Event</th>
                  {CHANNELS.map((c) => (
                    <th key={c} className="px-2 py-2 text-center">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {EVENTS.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800">{e.label}</div>
                      <div className="text-xs text-slate-500">{e.hint}</div>
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c} className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${e.label} via ${c}`}
                          className="size-4 accent-indigo-600"
                          checked={prefs[e.id]?.includes(c) ?? false}
                          onChange={() => toggle(e.id, c)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <div id="activity" className="scroll-mt-4" />
        <CardHeader title="My activity" subtitle="Actions you've taken on runs this session" />
        {entries.length === 0 ? (
          <Empty icon={<History className="size-6 text-slate-300" />} title="No actions yet this session">
            Retries, escalations, approvals and other actions you take on runs will appear here.
          </Empty>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="w-20 shrink-0 text-xs tabular-nums text-slate-500">{fmtClock(e.at)}</span>
                <span className="font-medium text-slate-800">{ACTIVITY_LABEL[e.kind]}</span>
                <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {e.runIds.slice(0, 6).map((id) => (
                    <Link key={id} to={`/runs/${id}`} className="font-mono text-xs text-indigo-700 hover:underline">
                      {id}
                    </Link>
                  ))}
                  {e.runIds.length > 6 && <span className="text-xs text-slate-500">+{e.runIds.length - 6} more</span>}
                </span>
                {e.runIds.length === 1 && RUN_BY_ID.get(e.runIds[0]) && (
                  <span className="text-xs text-slate-500">{WORKFLOW_BY_ID[RUN_BY_ID.get(e.runIds[0])!.workflowId].name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
