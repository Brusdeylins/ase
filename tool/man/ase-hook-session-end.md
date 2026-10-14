# ase-hook-session-end(1) -- Handle the SessionEnd Hook Event

## SYNOPSIS

`ase hook session-end`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase hook session-end** handles the `SessionEnd` hook event of
*Anthropic Claude Code CLI* and *OpenAI Codex CLI*, resp. the
`sessionEnd` hook event of *GitHub Copilot CLI*. It is intended to be
invoked by the agent tool internally as a configured hook handler only,
and not directly by end users.

The handler reads the event payload from standard input, a JSON object
with the session id (field `session_id`, resp. `sessionId`). For a
valid session id (matching `[A-Za-z0-9._-]+`), it:

1. removes the session directory *per-user state
   directory*`/session/`*id* with the session-scoped configuration
   (scope `session:`*id*) and the internal session state, and

2. detaches the session from its AI usage window (if any, see
   `ase-task-assign`(1)) through the `ase service` of the owning project,
   which closes and books the window once no other session remains
   attached to it. If the owning project service is not reachable in
   time, the session end is noted in the session registry
   (*per-user state directory*`/telemetry.json`) instead, and the
   service is started in the background, which then detaches the
   session as of its noted end. A failure is only warned about.

An empty, malformed, or invalid payload is silently ignored. The
handler writes nothing to standard output.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  The agent tool whose event payload is read: `claude`, `copilot`, or
  `codex`. Default: `$ASE_TOOL`, else `claude`.

## ENVIRONMENT

- `ASE_TOOL`:
  The default of `--tool`.

## FILES

- *per-user state directory*`/session/`*id*`/`:
  The per-session directory, removed by this handler.

- *per-user state directory*`/telemetry.json`:
  The telemetry state, whose session registry routes the session to
  the service of its project.

## EXIT STATUS

Exits with status `0`, unless `--tool` is invalid (status `1`).

## SEE ALSO

`ase`(1), `ase-hook`(1), `ase-hook-session-start`(1),
`ase-task-assign`(1), `ase-service`(1), `ase-setup-telemetry`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
