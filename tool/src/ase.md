
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
  List all configured values as flat dotted keys, rendered as a
  two-column table of `key` and `value`.

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

## FILES

- `.ase/config.yaml`:
  Per-project *ASE* configuration. Read upward from the current working
  directory. Recognized keys: `project.id` (non-empty string, uniqued
  project id), `project.name` (non-empty string, descriptive project
  name), `project.source.ambition` (`artist`|`craftsman`|`engineer`),
  `project.source.boxing` (`white`|`grey`|`black`), `project.source.size`
  (`small`|`medium`|`large`), `project.source.structure`
  (`bare`|`library`|`framework`), `project.process.actors`
  (`person`|`team`|`crew`), `project.process.control`
  (`human`|`hitl`|`agent`), `project.process.drive` (`spec`|`code`|`test`),
  and `project.result.target` (`prototype`|`mvp`|`product`).

- `.ase/service.yaml`:
  Per-project service state. Recognized key: `port` (integer in
  `1024`..`65535`).

- `.ase/service.log`:
  Stdout/stderr log of the detached background service.

## HISTORY

`ase` was started to be developed in October 2025.

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>

