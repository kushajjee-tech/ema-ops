# Ema Ops — AI Employee monitoring prototype

An operations dashboard for monitoring AI Employees, their workflow runs, and the connected systems they depend on. Everything runs on mock data.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

Stack: React 19, TypeScript, Vite, Tailwind v4, React Router, Recharts, sonner (toasts).

## Where things live

| Path | Purpose |
|---|---|
| `src/data/catalog.ts` | Agents, workflows (with step templates) and connected systems |
| `src/data/seed.ts` | Deterministic run generator (seeded PRNG, timestamps relative to "now") |
| `src/lib/analysis.ts` | **All derived logic**: stats, agent/system health, incident grouping, correlation |
| `src/lib/filters.ts` | Run filter model ⇄ URL params; every "view affected runs" link is just a URL |
| `src/lib/status.ts` | Single source of truth for status colors |
| `src/components/RunsTable.tsx` | Reusable Runs table (global page, agent Runs tab, pre-filtered links) |
| `src/pages/RunDetail.tsx` | Timeline, related-runs thread, correlation panel, status-conditional actions |

## Seed data (what to demo)

~285 runs over 7 days across 4 AI Employees / 12 workflows / 7 systems (~78% success).

- **Critical incident:** 25 runs failing at *Verify identity* in **Okta** (HTTP 504 timeouts), across Password Reset, Access Request, Employee Offboarding (IT) and New Hire Onboarding (HR), all in the last ~2h.
- **Warning incident:** SAP *Post journal entry* rejected (posting period closed): 5 failed + 3 partial across Invoice Processing and Expense Report Review.
- **Retry chains:** Okta failures that keep failing on retry (one reaches attempt 3); two older runs that recovered on retry.
- **Cross-agent trigger:** HR New Hire Onboarding → IT Access Request, which is now **Awaiting Approval**.
- **Stuck:** a Benefits Enrollment run hung at *Sync payroll deductions* (SAP), and an Offboarding run hung at *Close offboarding ticket* (ServiceNow).
- **Isolated failure:** Offer Letter Generation failed at Workday. Its correlation panel shows the "isolated issue" state.

## Derived logic

- **Incidents** = Failed/Partial runs from the last 6h grouped by *(failing step name + system)*, with 3 or more runs per group. Critical when ≥8 failures or ≥3 workflows are involved.
- **Correlation** (Run Detail) uses the same signature within ±2h of the run.
- **Agent health** = (failed + stuck) / finished runs, last 24h: Healthy <5%, Degraded 5–20%, Issues Detected >20%.
- **Stuck** = in progress for more than 3× the workflow's expected duration.
- **System status** = failures *at* that system: Down if ≥6 in 2h, Degraded if ≥2 in 6h.

## Prototype limitations / production notes

- The signed-in user (Kusha Jagarwal, IT Operations Admin) is hard-coded in `Layout.tsx`.
- Actions (retry, escalate, approve, bulk actions) are mocked: they show a confirmation, then a toast. In production they would be **role-gated (RBAC)** and audited.
- No auth, persistence or real integrations. Alert delivery (Slack/email/pager) is future work.
- Run IDs are stable across reloads; timestamps move with the current time.
