
# ase(1) -- Agentic Software Engineering (ASE)

## SYNOPSIS

`ase`
\[`-h`|`--help`\]
\[`-V`|`--version`\]
\[`-d`|`--debug`\]
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

- \[`-d`|`--debug`\]:
  Enable debug output. The flag is inherited by all subcommands
  and can be inspected inside handlers via `cmd.optsWithGlobals()`.

## COMMANDS

The following top-level commands exist:

- `ase config` \[*key* \[*value*\]\]:
  Manage *ASE* configuration stored in `.ase/config.yaml`.
  Without arguments, list all configured values as flat dotted keys.
  With *key* only, print the value at that dotted key.
  With *key* and *value*, set the value at that dotted key
  (creating intermediate maps as needed) and persist the file.
  The file is validated against a schema: on read, unknown or
  invalid entries are warned about and silently dropped from the
  in-memory view; on set/write, they cause a fatal error.

- `ase config edit`:
  Open `.ase/config.yaml` in the editor defined by the `$EDITOR`
  or `$VISUAL` environment variable (falling back to `vi`).
  The file and its parent directory are created if missing.
  After the editor exits, the file is re-read and schema warnings
  are reported.

- `ase service` \[*cmd*\]:
  Manage the per-project background HTTP service. The service
  is bound to `127.0.0.1` on a port persisted in `.ase/service.yaml`
  and stops itself after 30 minutes of idle time. Without a
  subcommand, the help text is shown. With a *cmd* token other
  than `start`/`stop`, the token is dispatched as a passthrough
  command to the running service via HTTP `POST /command`; if the
  service is not running, it is auto-started first.

- `ase service start`:
  Start the background service (detached). Allocates a random
  port in the range `42000`..`44000` if none is persisted yet,
  writes it to `.ase/service.yaml`, and probes readiness. Exits
  silently with status 0 if the service is already running; prints
  `ase: service: started on port <port>` on a fresh start.

- `ase service stop`:
  Stop the background service via HTTP `GET /stop`. Exits silently
  with status 0 on successful stop. If no port is configured or
  the port is not responding, prints an informational message and
  exits with status 0.

## FILES

- `~/.ase.yaml`:
  User-level *ASE* configuration (managed via `ase config`).

- `.ase/config.yaml`:
  Per-project *ASE* configuration. Read upward from the current
  working directory. Recognized key: `project-id` (non-empty string).

- `.ase/service.yaml`:
  Per-project service state. Recognized key: `port` (integer in
  `1024`..`65535`).

- `.ase/service.log`:
  Stdout/stderr log of the detached background service.

## HISTORY

`ase` was started to be developed in October 2025.

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>

