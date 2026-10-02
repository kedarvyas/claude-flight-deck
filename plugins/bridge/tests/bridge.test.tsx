import type { On } from 'claude-code'
import { describe, expect, test } from 'claude-code/testing'

import { AMBER, GREEN, RED, bar, callout, clock, color, dur, level, tok } from '../hooks/readout'

const SURFACES = ['terminal', 'desktop'] as const

const band = (bodyColumns: number) => ({
  plugin: 'bridge',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns, scroll: { offset: 0, bodyRows: 10 } },
} as const)

describe('readout', () => {
  test('color thresholds', () => {
    expect(color(0)).toBe(GREEN)
    expect(color(49)).toBe(GREEN)
    expect(color(50)).toBe(AMBER)
    expect(color(80)).toBe(AMBER)
    expect(color(81)).toBe(RED)
    expect(callout(level(10))).toBe('NOMINAL')
    expect(callout(level(60))).toBe('CAUTION')
    expect(callout(level(90))).toBe('ALERT')
    expect(callout(level(91))).toBe('CONTEXT CRITICAL')
  })

  test('formatting', () => {
    expect(tok(950)).toBe('950')
    expect(tok(84_123)).toBe('84k')
    expect(tok(1_234)).toBe('1.2k')
    expect(tok(1_000_000)).toBe('1.00M')
    expect(clock(3_725_000)).toBe('01:02:05')
    expect(bar(50, 10)).toEqual({ filled: '▰▰▰▰▰', empty: '▱▱▱▱▱' })
    expect(dur(45_000)).toBe('45s')
    expect(dur(134_000)).toBe('2m14s')
    expect(dur(3_780_000)).toBe('1h03m')
  })
})

describe('band', () => {
  test('starts nominal, then reads a turn, a tool call and a critical window', async ($, on) => {
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    on('turn.complete', () => ({ text: '' }))
    on('tool.call', () => ({ result: 'ok' as never }))

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...band(140), surface } as never)
      expect((await ui.find({ key: 'status' }))?.text).toContain('NOMINAL')
      expect((await ui.find({ key: 'tools' }))?.text).toMatch(/TOOLS\s*0$/)
      await ui.unmount()
    }

    await $.tool.call({ tool: 'Bash', tool_use_id: 't1', input: { command: 'ls' } } as never)
    await $.turn.complete({
      reason: 'answer', answer: 'hi', durationMs: 10, isAborted: false, turnId: 'turn-1',
      usage: { model: 'm', input_tokens: 1000, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0, output_tokens: 500 },
    } as never)
    await $.session.measure({
      context: { tokens: 186_000, window: 200_000, percent: 93 }, rateLimits: [], changed: [],
    } as never)

    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ ...band(140), surface } as never)
      expect((await ui.find({ key: 'status' }))?.text).toContain('CONTEXT CRITICAL')
      expect((await ui.find({ type: 'Text', text: /CONTEXT CRITICAL/ }))?.props.color).toBe(RED)
      expect((await ui.find({ key: 'ctx' }))?.text).toContain('93%')
      expect((await ui.find({ key: 'io' }))?.text).toContain('10k↓ 500↑')
      expect((await ui.find({ key: 'tools' }))?.text).toMatch(/TOOLS\s*1$/)
      expect((await ui.find({ key: 'total' }))?.text).toMatch(/11k$/)
      await ui.unmount()
    }

    // Narrow: only status and CTX remain.
    const narrow = await $.ui.mount({ ...band(60), surface: 'terminal' } as never)
    expect(await narrow.find({ key: 'io' })).toBeUndefined()
    expect(await narrow.find({ key: 'ctx' })).toBeDefined()
    await narrow.unmount()
  })
})

describe('long-turn toast', () => {
  const usage = { model: 'm', input_tokens: 1000, cache_read_input_tokens: 18_000, cache_creation_input_tokens: 0, output_tokens: 1100 }
  const complete = (durationMs: number, extra = {}) =>
    ({ reason: 'answer', answer: 'ok', durationMs, isAborted: false, turnId: 'turn-1', usage, ...extra }) as never

  const setup = (on: On) => {
    const toasts: string[] = []
    on('ui.toast', (_$, e) => {
      toasts.push(e.text)
      return { value: undefined }
    })
    on('turn.start', (_$, e) => ({ turnId: e.turnId }))
    on('turn.complete', () => ({ text: '' }))
    on('tool.call', () => ({ result: 'ok' as never }))
    return toasts
  }

  test('a long turn toasts with its length, tools and I/O', async ($, on) => {
    const toasts = setup(on)
    await $.tool.call({ tool: 'Read', tool_use_id: 'before', input: {} } as never)
    await $.turn.start({ text: 'go', turnId: 'turn-1' } as never)
    await $.tool.call({ tool: 'Bash', tool_use_id: 'a', input: {} } as never)
    await $.tool.call({ tool: 'Edit', tool_use_id: 'b', input: {} } as never)
    await $.turn.complete(complete(134_000))
    expect(toasts).toEqual(['◉ TURN COMPLETE · 2m14s · 2 TOOLS · 19k↓ 1.1k↑'])
  })

  test('short, interrupted and subagent turns stay quiet', async ($, on) => {
    const toasts = setup(on)
    await $.turn.complete(complete(5_000))
    await $.turn.complete(complete(300_000, { isAborted: true, reason: 'aborted' }))
    await $.turn.complete(complete(300_000, { agentId: 'sub-1' }))
    expect(toasts).toEqual([])
  })

  test('the threshold is an option, and 0 turns it off', { options: { toastAfterSeconds: 0 } }, async ($, on) => {
    const toasts = setup(on)
    await $.turn.complete(complete(400_000))
    expect(toasts).toEqual([])
  })
})
