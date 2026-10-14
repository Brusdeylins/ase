# ase-hook-user-prompt-submit(1) -- Handle the UserPromptSubmit Hook Event

## SYNOPSIS

`ase hook user-prompt-submit`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase hook user-prompt-submit** handles the `UserPromptSubmit` hook
event of *Anthropic Claude Code CLI* and *OpenAI Codex CLI*, resp. the
`userPromptSubmitted` hook event of *GitHub Copilot CLI*, which the
agent tool fires when the user submits a prompt. It is intended to be
invoked by the agent tool internally as a configured hook handler only,
and not directly by end users.

The handler reads and discards the event payload on standard input
and, when running inside a *tmux* pane, sets the per-pane user option
`@ase_agent_status` to `▶` (busy), so a *tmux* status line can render
the live activity of the agent via `#{@ase_agent_status}`
(independent of the statusline of the agent tool, which is not
repainted during the agent processing). It writes nothing to standard
output.

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

`ase`(1), `ase-hook`(1), `ase-hook-stop`(1), `tmux`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
