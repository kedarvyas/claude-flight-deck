# flight-deck

A one-line, spaceship-style readout above the Claude Code prompt.

```
◉ NOMINAL  CTX ▰▱▱▱▱▱▱▱▱▱▱▱ 10% 19.2k/200k  I/O 19k↓ 1.1k↑  TOOLS 17  T+00:12:43  Σ 245k
```

| Readout | Meaning |
| --- | --- |
| `◉ STATUS` | `NOMINAL` < 50% context, `CAUTION` 50–80%, `ALERT` > 80%, `CONTEXT CRITICAL` (highlighted red) > 90% |
| `CTX` | Context used / window, as a segmented bar and percent |
| `I/O` | Last turn's input (incl. cache) ↓ and output ↑ tokens |
| `TOOLS` | Tool calls this session (subagents included) |
| `T+` | Session elapsed time, as of the latest update (each turn, tool call or context reading) |
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

Verify this yourself:

```
claude plugin validate plugins/flight-deck   # lists every $ call the module makes
sh scripts/test.sh                           # runs tests/ against the plugin
```

The full source is two short files in `plugins/flight-deck/hooks/`:
`register.tsx` (the hooks) and `readout.ts` (formatting). It runs no timers and loads no other files.

## Privacy

flight-deck collects nothing and sends nothing. It reads token counts and
timing that Claude Code already computes for the session, keeps them in the
session's own memory to draw the line, and drops them when the session ends.
It makes no network requests, writes no files and runs no programs.

## Support

Questions and bug reports: [open an issue](https://github.com/kedarvyas/claude-flight-deck/issues).

## License

MIT
