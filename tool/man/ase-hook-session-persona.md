# ase-hook-session-persona(1) -- Handle the SessionStart Hook Event for the Persona

## SYNOPSIS

`ase hook session-persona`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase hook session-persona** handles the `SessionStart` hook event of
*Anthropic Claude Code CLI* and *OpenAI Codex CLI*, resp. the
`sessionStart` hook event of *GitHub Copilot CLI*, in addition to
`ase hook session-start`.
It is intended to be invoked by the agent tool internally as a
configured hook handler only, and not directly by end users.

The handler determines the plugin root directory (see
`ase-hook-session-start`(1)), reads the persona rules
`meta/ase-persona.md` from it, and writes them as the hook output
payload to standard output, as `hookSpecificOutput.additionalContext`
(`claude` and `codex`), resp. as the top-level field
`additionalContext` (`copilot`).

The persona rules are injected by this separate handler, as agent tools
like *Anthropic Claude Code CLI* show only a preview of a hook output
beyond 10,000 characters, which otherwise would cut off the persona
rules from the output of `ase hook session-start`. The rules refer to
the persona style `<ase-persona-style>` injected by `ase hook
session-start`, but only by name, so both handlers are independent of
each other and their execution order does not matter.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  The agent tool whose hook output format is written: `claude`
  (*Anthropic Claude Code CLI*), `copilot` (*GitHub Copilot CLI*), or
  `codex` (*OpenAI Codex CLI*). Default: `$ASE_TOOL`, else `claude`.

## ENVIRONMENT

- `CLAUDE_PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT`, `PLUGIN_ROOT`:
  The plugin root directory, provided by the agent tool. The handler
  fails if the variable of the selected tool is unset or empty.

- `ASE_TOOL`:
  The default of `--tool`.

## EXIT STATUS

Exits with status `0` on success, and with status `1` if the plugin
root directory cannot be determined, the persona file cannot be read,
or `--tool` is invalid.

## SEE ALSO

`ase`(1), `ase-hook`(1), `ase-hook-session-start`(1), `ase-config`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>

