import { NOW } from '../data/seed'

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

export function fmtRelative(ts: number): string {
  const d = NOW - ts
  if (d < 60_000) return 'just now'
  const m = Math.round(d / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
}

export function fmtPct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`
}
