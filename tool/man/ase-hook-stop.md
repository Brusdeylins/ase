# ase-hook-stop(1) -- Handle the Stop Hook Event

## SYNOPSIS

`ase hook stop`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase hook stop** handles the `Stop` hook event of *Anthropic Claude
Code CLI* and *OpenAI Codex CLI*, resp. the `agentStop` hook event of
*GitHub Copilot CLI*, which the agent tool fires when the agent
finished responding. It is intended to be invoked by the agent tool
internally as a configured hook handler only, and not directly by end
users.

The handler reads and discards the event payload on standard input
and, when running inside a *tmux* pane, sets the per-pane user option
`@ase_agent_status` to `⏸` (ready), so a *tmux* status line can render
the live activity of the agent via `#{@ase_agent_status}`. It writes
nothing to standard output.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  The agent tool which fires the event: `claude`, `copilot`, or
  `codex`. Default: `$ASE_TOOL`, else `claude`.

## ENVIRONMENT

- `TMUX`, `TMUX_PANE`:
  The *tmux* pane whose user option `@ase_agent_status` is set (only if
  both are set and non-empty).

- `ASE_TOOL`:
  The default of `--tool`.

## EXIT STATUS

Exits with status `0`, unless `--tool` is invalid (status `1`).

## SEE ALSO

`ase`(1), `ase-hook`(1), `ase-hook-user-prompt-submit`(1), `tmux`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
