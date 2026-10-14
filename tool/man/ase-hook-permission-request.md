# ase-hook-permission-request(1) -- Handle the PermissionRequest Hook Event

## SYNOPSIS

`ase hook permission-request`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase hook permission-request** handles the `PermissionRequest` hook
event of *OpenAI Codex CLI*, which the agent tool fires only when a
tool invocation would otherwise require an interactive user approval.
It is intended to be invoked by the agent tool internally as a
configured hook handler only, and not directly by end users. It is
configured for `--tool codex` only, as *OpenAI Codex CLI* does not
honor an approval in its `PreToolUse` event.

The handler reads the event payload from standard input, a JSON object
with the tool name (field `tool_name`), the tool input (field
`tool_input`), and the session id (field `session_id`), and applies the
very same auto-approval rules as `ase hook pre-tool-use` (see
`ase-hook-pre-tool-use`(1)): *ASE* CLI invocations, *ASE* skills, *ASE*
MCP tools, tools of the pre-defined foreign MCP servers, reads of
plugin files, and edits during an active edit-capable skill.

On approval, the handler writes the decision
`{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}`
to standard output. Otherwise, it stays silent and hence defers to the
regular approval flow of the agent tool.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  The agent tool whose event payload is read: `claude`, `copilot`, or
  `codex` (as configured: `codex`). Default: `$ASE_TOOL`, else
  `claude`.

## ENVIRONMENT

- `PLUGIN_ROOT`, `CLAUDE_PLUGIN_ROOT`, `COPILOT_PLUGIN_ROOT`:
  The plugin root directory for the auto-approval of plugin file
  reads.

- `ASE_TOOL`:
  The default of `--tool`.

## EXIT STATUS

Exits with status `0`, unless `--tool` is invalid (status `1`).

## SEE ALSO

`ase`(1), `ase-hook`(1), `ase-hook-pre-tool-use`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
