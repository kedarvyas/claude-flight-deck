// Pure formatting for the flight deck readout: no `$`, so tests can call it directly.

export const GREEN = '#3fb950'
export const AMBER = '#d29922'
export const RED = '#f85149'

export type Level = 'nominal' | 'caution' | 'alert' | 'critical'

export const level = (pct: number): Level =>
  pct > 90 ? 'critical' : pct > 80 ? 'alert' : pct >= 50 ? 'caution' : 'nominal'

export const color = (pct: number): string =>
  pct > 80 ? RED : pct >= 50 ? AMBER : GREEN

export const percentOf = (tokens: number | undefined, window: number, percent?: number): number =>
  percent ?? (tokens !== undefined && window > 0 ? Math.round((tokens / window) * 100) : 0)

// 12.3k, 1.2M: three significant-ish glyphs, readout style.
export const tok = (n: number): string => {
  if (n < 1000) return String(Math.round(n))
  if (n < 1e6) return `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0)}k`
  return `${(n / 1e6).toFixed(n < 1e7 ? 2 : 1)}M`
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export const clock = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`
}

// Thin segmented bar: `filled` and `empty` strings, so each half can take its own color.
export const bar = (pct: number, segments: number): { filled: string; empty: string } => {
  const n = Math.max(0, Math.min(segments, Math.round((pct / 100) * segments)))
  return { filled: '▰'.repeat(n), empty: '▱'.repeat(segments - n) }
}

// The band's status word, ship-readout style.
export const callout = (lvl: Level): string =>
  ({ nominal: 'NOMINAL', caution: 'CAUTION', alert: 'ALERT', critical: 'CONTEXT CRITICAL' })[lvl]

// 45s, 2m14s, 1h03m: turn length for the toast.
export const dur = (ms: number): string => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m${pad2(s % 60)}s`
  return `${Math.floor(s / 3600)}h${pad2(Math.floor(s / 60) % 60)}m`
}

export const turnToast = (reason: string, ms: number, calls: number, io: { input: number; output: number } | null): string =>
  [
    reason === 'error' ? '◉ TURN ENDED: ERROR' : '◉ TURN COMPLETE',
    dur(ms),
    `${calls} TOOLS`,
    ...(io ? [`${tok(io.input)}↓ ${tok(io.output)}↑`] : []),
  ].join(' · ')
