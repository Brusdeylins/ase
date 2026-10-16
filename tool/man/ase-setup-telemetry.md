# ase-setup-telemetry(1) -- Activate or Deactivate the ASE Telemetry Export

## SYNOPSIS

`ase setup telemetry`
\[`-h`|`--help`\]

`ase setup telemetry activate`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

`ase setup telemetry deactivate`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase setup telemetry** activates or deactivates the *OpenTelemetry*
(OTLP/HTTP) export of the agent tool towards the per-user *ASE* OTLP
ingress `http://127.0.0.1:`*port* (with *port* from the configuration
`telemetry.service.port`, default `44318`), which feeds the AI usage
accounting of the task assignments (see `ase-task-assign`(1)).
Without a sub-command, the usage information is shown and the command
exits with status `1`.

The export is always user-level, as the agent tools ignore these
settings on repository level, so a single ingress serves the sessions
of all projects: every running `ase service` tries to hold its port,
and the holder routes the records by their session to the service of
the owning project. Hence, there is no `--scope` option.

Telemetry configured by the user for other receivers is never touched:
it is preserved with a warning (and the command still exits with
status `0`), and reported as `foreign` by `ase setup status`.

## COMMANDS

- `ase setup telemetry activate` \[`-t`|`--tool` *tool*\]:
  Configure the telemetry export of the agent tool. As the AI usage
  accounting is opt-in, this requires the configuration
  `telemetry.enabled` to be `true` (e.g., via `ase config set
  telemetry.enabled true` on scope `user` or `project`), else the
  command fails with an error. A missing bearer token
  `telemetry.service.token` is generated (48 hexadecimal digits) and
  persisted on scope `user`. Per agent tool:

    - `claude`:
      The variables `CLAUDE_CODE_ENABLE_TELEMETRY=1`,
      `OTEL_LOGS_EXPORTER=otlp`,
      `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`,
      `OTEL_EXPORTER_OTLP_ENDPOINT=`*url*,
      `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer `*token*, and
      `OTEL_LOGS_EXPORT_INTERVAL=5000` are added to (resp. updated in)
      the `env` object of `~/.claude/settings.json`.

      If any of these variables is already set there, but points
      neither to the URL nor carries the token of the *ASE* ingress, the
      configuration is foreign and preserved; a non-object `env` is
      preserved, too.
    - `codex`:
      A marked block (between the lines `# BEGIN ASE telemetry
      (generated)` and `# END ASE telemetry (generated)`) with an
      `[otel]` table, exporting via `otlp-http` with protocol `json` to
      *url*`/v1/logs` with the `authorization` header `Bearer`
      *token*, is added to (resp. replaced in)
      `$CODEX_HOME/config.toml` (default: `~/.codex/config.toml`). An
      `[otel]` table outside of the block is foreign and preserved.
    - `copilot`:
      As *GitHub Copilot CLI* is configurable via environment
      variables only, a marked block with a shell function `copilot`
      is added to (resp. replaced in) the shell profile of the login
      shell of `$SHELL` (`$ZDOTDIR/.zshrc`, default `~/.zshrc`, for
      `zsh`, and `~/.bashrc` for `bash`), which passes the variables
      `COPILOT_OTEL_ENABLED=true`,
      `COPILOT_OTEL_EXPORTER_TYPE=otlp-http`,
      `OTEL_EXPORTER_OTLP_ENDPOINT=`*url*,
      `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`, and
      `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer `*token* to the
      `copilot` command only, instead of exporting them to every other
      program. A new shell session is required for it to take effect.

      For any other shell, the command fails with an error showing the
      shell function to define manually. An `$OTEL_EXPORTER_OTLP_ENDPOINT`
      of the environment other than the *ASE* ingress URL, and an
      assignment of `COPILOT_OTEL_ENABLED` or `OTEL_EXPORTER_OTLP_ENDPOINT`
      in the profile outside of the block, are foreign and preserved.

- `ase setup telemetry deactivate` \[`-t`|`--tool` *tool*\]:
  Remove the telemetry export configured by `ase setup telemetry
  activate` again, preserving any foreign telemetry configuration. It
  does not require `telemetry.enabled`.

  Per agent tool: for `claude`, the above variables are removed from the
  `env` of `~/.claude/settings.json` (and the `env` itself, if it became
  empty); for `codex`, the marked block is removed from
  `$CODEX_HOME/config.toml`; and for `copilot`, the marked block is
  removed from all candidate shell profiles (`~/.zshrc`, `~/.bashrc`,
  and the profile of the login shell). A missing file or configuration
  is skipped with an informational message.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  Select the target agent tool: `claude`, `copilot`, or `codex`
  (default: `$ASE_TOOL`, else `claude`).

## ENVIRONMENT

- `ASE_TOOL`:
  The default of `--tool`.

- `CODEX_HOME`:
  The configuration directory of *OpenAI Codex CLI* (default:
  `~/.codex`).

- `SHELL`, `ZDOTDIR`:
  The login shell, determining the shell profile for `--tool copilot`,
  and the configuration directory of `zsh`.

- `OTEL_EXPORTER_OTLP_ENDPOINT`:
  An existing OTLP endpoint for `--tool copilot`, which, if not the
  *ASE* ingress, is considered a foreign telemetry configuration.

## FILES

- `~/.claude/settings.json`:
  The user-level settings file of *Anthropic Claude Code CLI*.

- `$CODEX_HOME/config.toml` (default: `~/.codex/config.toml`):
  The configuration file of *OpenAI Codex CLI*.

- `~/.zshrc`, `~/.bashrc`:
  The shell profiles receiving the `copilot` shell function.

## EXIT STATUS

`0` on success (including a preserved foreign configuration), `1` on
any error (e.g., a disabled AI usage accounting on `activate`, an
unsupported shell for `--tool copilot`, an unterminated marked block,
and when invoked without a sub-command).

## EXAMPLES

```sh
# enable the AI usage accounting and activate the export of Claude Code
$ ase config --scope user set telemetry.enabled true
$ ase setup telemetry activate

# activate the export of OpenAI Codex CLI
$ ase setup telemetry activate --tool codex

# deactivate the export of GitHub Copilot CLI
$ ase setup telemetry deactivate --tool copilot
```

## SEE ALSO

`ase`(1), `ase-setup`(1), `ase-setup-status`(1), `ase-config`(1),
`ase-service`(1), `ase-task-assign`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
