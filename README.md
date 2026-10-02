# flight-deck

A one-line, spaceship-style readout above the Claude Code prompt.

```
◉ NOMINAL  CTX ▰▱▱▱▱▱▱▱▱▱▱▱ 10% 19.2k/200k  I/O 19k↓ 1.1k↑  TOOLS 17  T+00:12:43  Σ 245k
```

| Readout | Meaning |
| --- | --- |
| `◉ STATUS` | `NOMINAL` < 50% context, `CAUTION` 50–80%, `ALERT` > 80%, `CONTEXT CRITICAL` (blinking) > 90% |
| `CTX` | Context used / window, as a segmented bar and percent |
| `I/O` | Last turn's input (incl. cache) ↓ and output ↑ tokens |
| `TOOLS` | Tool calls this session (subagents included) |
| `T+` | Session elapsed time |
| `Σ` | Total tokens this session |

Readouts drop right-to-left as the window narrows. `/flight-deck` toggles it.

### Long-turn toast

When a turn runs 60 seconds or longer, a toast calls you back:

```
◉ TURN COMPLETE · 2m14s · 12 TOOLS · 19k↓ 1.1k↑
```

Interrupted turns and subagent turns stay quiet. Change the threshold with the
`toastAfterSeconds` option in `/plugin` (0 turns it off).

## Install

```
/plugin marketplace add kedarvyas/claude-flight-deck
/plugin install flight-deck@claude-flight-deck
/reload-plugins
```

If it doesn't appear after the reload, restart Claude Code.

## What it can touch

A mod runs inside Claude Code on your machine with the same access Claude Code has,
so read the source before installing any mod, this one included.


Nothing outside the session. It reads token figures the engine already computes
(`$.session.usage`, `session.measure`, `turn.complete`, `tool.call`) and draws one
line. It makes **no network, file system or process calls**, and never blocks or
rewrites a tool call or prompt — every hook passes through with `next(e)`.

What each hook does:

| Hook | What it does |
| --- | --- |
| `session.start` | Registers `/flight-deck` and takes a first usage reading |
| `session.measure` | Records the context window's fill after each turn |
| `turn.start` / `turn.complete` | Records the last turn's tokens; shows the long-turn toast |
| `tool.call` | Adds one to the tool counter, then passes the call on unchanged. It never sees, blocks or rewrites a call's input or result beyond counting it |
| `command.run` (`/flight-deck`) | Shows or hides the line |
| `ui.render` (`AbovePrompt`) | Draws the line; gives the band back when a survey needs it |

`T+` and the blinking `CONTEXT CRITICAL` label tick on the surface's own frame
clock through a tiny display module (`hooks/ticker.ts`, a `Client` element), so the
hooks module runs no timer. VS Code and mobile have no `Client`: there `T+` shows
the time as of the last update and the critical label is a steady highlight.

Verify this yourself:

```
claude plugin validate plugins/flight-deck   # lists every $ call the module makes
claude plugin test plugins/flight-deck
```

The full source is three short files in `plugins/flight-deck/hooks/`:
`register.tsx` (the hooks), `readout.ts` (formatting) and `ticker.ts` (the clock display).

## License

MIT
