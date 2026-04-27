
# ase(1) -- Agentic Software Engineering (ASE)

## SYNOPSIS

`ase`
\[`-h`|`--help`\]
\[`-V`|`--version`\]
\[`-l`|`--log-level` *level*\]
\[`-L`|`--log-file` *file*\]
\[*command*
\[*options* \[...\]\]
\[*args* \[...\]\]\]

## DESCRIPTION

`ase`, *Agentic Software Engineering (ASE)*,
is the command-line companion tool to the *ASE* Claude Code plugin.
It provides project-level configuration management and a small
per-project background HTTP service for dispatching commands.

## OPTIONS

The following top-level command-line options exist:

- \[`-h`|`--help`\]:
  Show program usage information only.

- \[`-V`|`--version`\]:
  Show program version information only.

- \[`-l`|`--log-level` *level*\]:
  Set the logging verbosity. Supported *level* values are
  `error`, `warning` (default), `info`, and `debug`.

- \[`-L`|`--log-file` *file*\]:
  Redirect log output to *file* (appended). Use `-` (default) to
  write log messages to standard output. If *file* is connected
  to a TTY, colors are used in the output.

## COMMANDS

The following top-level commands exist for configuration handling:

- `ase config`:
  Manage *ASE* configuration stored in `.ase/config.yaml`.
  Without a subcommand, prints usage information.
  The file is validated against a schema: on read, unknown or
  invalid entries are warned about and silently dropped from the
  in-memory view; on set/write, they cause a fatal error.
  Recognized keys are grouped under three top-level sections:
  `project.*` (project identity, classification, and artifact
  globs), `agent.*` (agent persona and process), and `task.*`
  (currently `task.id`, the active task identifier).
  All `ase config` subcommands accept a `--scope` *scope* option
  that selects the scope chain. The *scope* value is a
  comma-separated list of scope terms, in any order; each term
  is one of `user`, `project`, `task:`*id*, or `session:`*id*
  (where *id* matches `[A-Za-z0-9._-]+`). At most one term per
  kind is allowed. The chain is canonicalized into the fixed
  inheritance order `user` < `project` < `task` < `session`.
  `user` is always implicitly added at the bottom of the chain.
  `project` is implicitly added only when a *project context*
  exists -- i.e. when the current working directory is inside a
  Git repository, or a `.ase` directory is found at or above it.
  Specifying `project` explicitly without a project context is
  an error. Without an explicit `--scope`, the target defaults
  to `project` when a project context exists, otherwise to
  `user`.
  Reads cascade from the strongest (rightmost) scope down to the
  weakest and return the first value that is defined. Writes
  (`set`, `delete`, `edit`, `init`) are always confined to the
  strongest (target) scope's own file -- intermediate and weaker
  scopes are never modified. See *FILES* below for the resulting
  paths. Example: `--scope task:T1,session:S1` yields the chain
  `user` -> `project` -> `task:T1` -> `session:S1`, with
  `session:S1` as the write target.

- `ase config init` *type*:
  Initialize `.ase/config.yaml` with preset values for all recognized
  keys. The *type* argument selects the preset:
  `vibe` (solo rookie: small black-box prototype, bare code, fully
  agent-driven, spec-driven, engineer ambition),
  `pro` (solo expert: medium white-box product, framework-based,
  human-controlled, code-driven, artist ambition),
  or `industry` (team crew: large grey-box MVP, framework-based,
  human-in-the-loop, code-driven, craftsman ambition).

- `ase config edit`:
  Open `.ase/config.yaml` in the editor defined by the `$EDITOR`
  or `$VISUAL` environment variable (falling back to `vi`).
  The file and its parent directory are created if missing.
  After the editor exits, the file is re-read and schema warnings
  are reported.

- `ase config list`:
  List all effective configured values across the scope
  inheritance chain, rendered as a three-column table of `key`,
  `value`, and `origin`. The `origin` column identifies the
  scope (`user`, `project`, `task:`*id*, or `session:`*id*) that
  supplied each value. For overlapping keys only the value from
  the strongest scope is shown.

- `ase config get` *key*:
  Print the value at the given dotted *key*. Fails with an error
  if *key* does not resolve to a leaf value.

- `ase config set` *key* *value*:
  Set the value at the given dotted *key* (creating intermediate
  maps as needed) and persist the file.

The following top-level commands exist for service management:

- `ase service`:
  Manage the per-project background HTTP service. The service
  is bound to `127.0.0.1` on a port persisted in `.ase/service.yaml`
  and stops itself after 30 minutes of idle time. Without a
  subcommand, the help text is shown.

- `ase service start`:
  Start the background service (detached). Allocates a random
  port in the range `42000`..`44000` if none is persisted yet,
  writes it to `.ase/service.yaml`, and probes readiness. Exits
  silently with status 0 if the service is already running; prints
  `ase: service: started on port <port>` on a fresh start.

- `ase service status`:
  Report whether the background service is running. Probes the
  persisted port via HTTP `GET /ping` and verifies that the
  responding service belongs to the current project. Prints
  `ase: service: running on port <port>` and exits with status 0
  if a matching service is reachable; otherwise prints a
  diagnostic message (no port configured, port not responding,
  or port in use by a foreign service) and exits with status 1.

- `ase service send` *cmd*:
  Dispatch the *cmd* token as a passthrough command to the running
  service via HTTP `POST /command`; if the service is not running,
  it is auto-started first.

- `ase service stop`:
  Stop the background service via HTTP `GET /stop`. Exits silently
  with status 0 on successful stop. If no port is configured or
  the port is not responding, prints an informational message and
  exits with status 0.

## CONFIGURATION FILES

- **user**: *per-user configuration directory*`/config.yaml`:
  Per-user *ASE* configuration (scope `user`). The per-user
  configuration directory is `~/Library/Application Support/ase` on
  macOS, `%APPDATA%\ase` on Windows, and `$XDG_CONFIG_HOME/ase`
  (falling back to `~/.config/ase`) on Linux and other Unix systems.

- **project**: `.ase/config.yaml`:
  Per-project *ASE* configuration (scope `project`). Read upward from
  the current working directory.

- **task**: `.ase/task/`*id*`/config.yaml`:
  Per-task *ASE* configuration (scope `task:`*id*), located relative
  to the Git top-level directory. Outside a Git repository, the file
  is placed relative to the current working directory.

- **session**: `~/.ase/session/`*id*`/config.yaml`:
  Per-session *ASE* configuration (scope `session:`*id*), located
  under the user's home directory (independent of any project context).

## STATE FILES

- `.ase/service.yaml`:
  Per-project service state.

- `.ase/service.log`:
  Stdout/stderr log of the detached background service.

## HISTORY

`ase` was started to be developed in October 2025.

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>

