export type Ctx = { tokens?: number; window: number; percent?: number }
export type TurnIO = { input: number; output: number }

declare module 'claude-code' {
  interface PluginState {
    bridge: {
      ctx: Ctx | null
      last: TurnIO | null
      tools: number
      total: number
      startedAt: number
      now: number
      isHidden: boolean
    }
  }
}
