import type { EngineInterface, Register } from 'claude-code'

import { bar, callout, clock, color, level, percentOf, tok, turnToast } from './readout'

// Every value lives in $.state, so it survives a hot reload of this file.
const CTX = { plugin: 'flight-deck', key: 'ctx' } as const
const LAST = { plugin: 'flight-deck', key: 'last' } as const
const TOOLS = { plugin: 'flight-deck', key: 'tools' } as const
const TOTAL = { plugin: 'flight-deck', key: 'total' } as const
const STARTED_AT = { plugin: 'flight-deck', key: 'startedAt' } as const
const NOW = { plugin: 'flight-deck', key: 'now' } as const
const IS_HIDDEN = { plugin: 'flight-deck', key: 'isHidden' } as const
const TURN_TOOLS0 = { plugin: 'flight-deck', key: 'turnTools0' } as const

async function tick($: EngineInterface) {
  await $.state.set(NOW, await $.clock.now())
}

export const register: Register = (on, options) => {
  const toastAfterMs = Number(options.toastAfterSeconds ?? 60) * 1000

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'flight-deck', description: 'Show or hide the flight deck readout above the prompt' })
    const usage = await $.session.usage()
    await $.state.set(STARTED_AT, usage.startedAt)
    await $.state.set(CTX, { tokens: usage.context.tokens, window: usage.context.window, percent: usage.context.percent })
    await $.state.set(NOW, await $.clock.now())
    // One tick a second drives T+ and the critical blink.
    $.clock.every(1000, () => tick($))
    return next(e)
  })

  on('command.run', { command: 'flight-deck' }, async ($, e, next) => {
    // Read, flip, write only if nothing wrote in between; retry on a miss.
    let hidden = false
    for (;;) {
      const { value = false, version } = await $.state.get(IS_HIDDEN)
      hidden = !value
      if ((await $.state.set(IS_HIDDEN, hidden, { ifVersion: version })).isSet) break
    }
    return { text: hidden ? 'Flight deck dark.' : 'Flight deck online.' }
  })

  // Pushed after every main-thread turn: the live window's fill.
  on('session.measure', async ($, e, next) => {
    await $.state.set(CTX, { tokens: e.context.tokens, window: e.context.window, percent: e.context.percent })
    return next(e)
  })

  // Main thread only: a subagent's run raises no turn.start.
  on('turn.start', async ($, e, next) => {
    const { value: n = 0 } = await $.state.get(TOOLS)
    await $.state.set(TURN_TOOLS0, n)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e)
    const u = e.usage
    const io = u ? { input: u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens, output: u.output_tokens } : null
    if (io) {
      await $.state.set(LAST, io)
      for (;;) {
        const { value = 0, version } = await $.state.get(TOTAL)
        if ((await $.state.set(TOTAL, value + io.input + io.output, { ifVersion: version })).isSet) break
      }
    }
    // Long-turn toast: you looked away, the flight deck calls you back. Not for an interrupt you caused.
    if (toastAfterMs > 0 && !e.isAborted && e.durationMs >= toastAfterMs) {
      const { value: n = 0 } = await $.state.get(TOOLS)
      const { value: n0 = 0 } = await $.state.get(TURN_TOOLS0)
      const calls = n - n0
      $.ui.toast(turnToast(e.reason, e.durationMs, calls, io), { timeoutMs: 8000 })
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    for (;;) {
      const { value = 0, version } = await $.state.get(TOOLS)
      if ((await $.state.set(TOOLS, value + 1, { ifVersion: version })).isSet) break
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const { value: isHidden = false } = await $.state.get(IS_HIDDEN)
    if (e.props.hasSurvey || isHidden) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const { value: c = null } = await $.state.get(CTX)
    const { value: io = null } = await $.state.get(LAST)
    const { value: calls = 0 } = await $.state.get(TOOLS)
    const { value: sum = 0 } = await $.state.get(TOTAL)
    const { value: t0 = 0 } = await $.state.get(STARTED_AT)
    const { value: t = 0 } = await $.state.get(NOW)

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
      <Box key="flight-deck" flexDirection="row" gap={2}>
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
