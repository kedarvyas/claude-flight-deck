// Surface module for the two readouts that move between events: the T+ clock
// and the blinking CONTEXT CRITICAL label. It runs on the surface's own frame
// clock, so the hooks module needs no timer of its own.
import type { ClientModule } from 'claude-code'

import { clock } from './readout'

export type TickerProps = {
  mode: 'elapsed' | 'blink'
  // Elapsed milliseconds when the hooks module last drew; the ticker counts on from there.
  elapsedMs: number
  text: string
  color: string
}

type TickerState = { base: number; ticks: number }

const Ticker: ClientModule<TickerProps, TickerState> = (p, surface) => {
  const { Text } = surface.elements
  const s = surface.state
  if (s === undefined) {
    surface.every(1000, () => {
      const cur = surface.state
      if (cur) surface.setState({ base: cur.base, ticks: cur.ticks + 1 })
    })
    surface.setState({ base: p.elapsedMs, ticks: 0 })
  } else if (s.base !== p.elapsedMs) {
    // A redraw brought a fresh reading: count on from it.
    surface.setState({ base: p.elapsedMs, ticks: 0 })
  }
  const ticks = s && s.base === p.elapsedMs ? s.ticks : 0
  if (p.mode === 'elapsed') {
    return Text({ children: clock(p.elapsedMs + ticks * 1000) })
  }
  return Text({ color: p.color, bold: true, inverse: ticks % 2 === 0, children: p.text })
}

export default Ticker
