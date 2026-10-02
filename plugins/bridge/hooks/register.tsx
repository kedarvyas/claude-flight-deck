import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ctx, TurnIO } from '../types'
import { bar, callout, clock, color, level, percentOf, tok, turnToast } from './readout'

const ctx = atom({ plugin: 'bridge', key: 'ctx' } as const, null as Ctx | null)
const last = atom({ plugin: 'bridge', key: 'last' } as const, null as TurnIO | null)
const tools = atom({ plugin: 'bridge', key: 'tools' } as const, 0)
const total = atom({ plugin: 'bridge', key: 'total' } as const, 0)
const startedAt = atom({ plugin: 'bridge', key: 'startedAt' } as const, 0)
const now = atom({ plugin: 'bridge', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'bridge', key: 'isHidden' } as const, false)
const turnTools0 = atom({ plugin: 'bridge', key: 'turnTools0' } as const, 0)

async function tick($: EngineInterface) {
  const t = await $.clock.now()
  await update($, now, () => t)
}

export const register: Register = (on, options) => {
  const toastAfterMs = Number(options.toastAfterSeconds ?? 60) * 1000

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'bridge', description: 'Show or hide the bridge readout above the prompt' })
    const usage = await $.session.usage()
    const t = await $.clock.now()
    await update($, startedAt, () => usage.startedAt)
    await update($, ctx, () => usage.context)
    await update($, now, () => t)
    // One tick a second drives T+ and the critical blink.
    $.clock.every(1000, () => tick($))
    return next(e)
  })

  on('command.run', { command: 'bridge' }, async ($, e) => {
    const hidden = await update($, isHidden, h => !h)
    return { text: hidden ? 'Bridge readout dark.' : 'Bridge readout online.' }
  })

  // Pushed after every main-thread turn: the live window's fill.
  on('session.measure', async ($, e, next) => {
    await update($, ctx, () => ({ tokens: e.context.tokens, window: e.context.window, percent: e.context.percent }))
    return next(e)
  })

  // Main thread only: a subagent's run raises no turn.start.
  on('turn.start', async ($, e, next) => {
    const n = await read($, tools)
    await update($, turnTools0, () => n)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    const u = e.usage
    const io = u ? { input: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens, output: u.output_tokens } : null
    if (io) {
      await update($, last, () => io)
      await update($, total, n => n + io.input + io.output)
    }
    // Long-turn toast: you looked away, the bridge calls you back. Not for an interrupt you caused.
    if (toastAfterMs > 0 && !e.isAborted && e.durationMs >= toastAfterMs) {
      const calls = (await read($, tools)) - (await read($, turnTools0))
      $.ui.toast(turnToast(e.reason, e.durationMs, calls, io), { timeoutMs: 8000 })
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    await update($, tools, n => n + 1)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const c = await read($, ctx)
    const io = await read($, last)
    const calls = await read($, tools)
    const sum = await read($, total)
    const t0 = await read($, startedAt)
    const t = await read($, now)

    const hasFill = c !== null && (c.tokens !== undefined || c.percent !== undefined)
    const pct = c ? percentOf(c.tokens, c.window, c.percent) : 0
    const hue = color(pct)
    const lvl = level(pct)
    const isCritical = lvl === 'critical'
    const blinkOn = isCritical && Math.floor(t / 1000) % 2 === 0
    // Shed readouts right to left as the band narrows.
    const w = e.props.bodyColumns
    const b = bar(pct, w >= 100 ? 12 : 8)

    return (
      <Box key="bridge" flexDirection="row" gap={2}>
        <Box key="status" flexDirection="row" gap={1}>
          <Text color={hue} bold={isCritical} inverse={blinkOn}>◉ {callout(lvl)}</Text>
        </Box>
        <Box key="ctx" flexDirection="row" gap={1}>
          <Text dimColor>CTX</Text>
          <Text color={hue}>{b.filled}</Text>
          <Text dimColor>{b.empty}</Text>
          <Text color={hue} bold>{hasFill ? `${pct}%` : '--%'}</Text>
          {w >= 70 && <Text dimColor>{c?.tokens === undefined ? '--' : tok(c.tokens)}/{c ? tok(c.window) : '--'}</Text>}
        </Box>
        {w >= 85 && (
          <Box key="io" flexDirection="row" gap={1}>
            <Text dimColor>I/O</Text>
            <Text>{io ? `${tok(io.input)}↓ ${tok(io.output)}↑` : '--'}</Text>
          </Box>
        )}
        {w >= 100 && (
          <Box key="tools" flexDirection="row" gap={1}>
            <Text dimColor>TOOLS</Text>
            <Text>{String(calls)}</Text>
          </Box>
        )}
        {w >= 115 && (
          <Box key="elapsed" flexDirection="row" gap={1}>
            <Text dimColor>T+</Text>
            <Text>{t0 ? clock(t - t0) : '--:--:--'}</Text>
          </Box>
        )}
        {w >= 128 && (
          <Box key="total" flexDirection="row" gap={1}>
            <Text dimColor>Σ</Text>
            <Text>{tok(sum)}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
