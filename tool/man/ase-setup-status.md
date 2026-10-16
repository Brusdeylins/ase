# ase-setup-status(1) -- Report the ASE Registrations of an Agent Tool

## SYNOPSIS

`ase setup status`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]

## DESCRIPTION

**ase setup status** reports where *ASE* is currently registered with
the agent tool selected by `--tool`, rendered as a table with the
columns `KIND`, `ID`, `SCOPE`, and `STATUS`. It requires the CLI of
the agent tool to be found in `$PATH`. The rows are:

- `PLUGIN`:
  One row per registration of the plugin `ase@ase` (as scraped from
  the output of `<cli> plugin list`), with its registration scope and
  its state (e.g., `enabled` or `disabled` for *Anthropic Claude Code
  CLI*, `installed` for *GitHub Copilot CLI*, and the installation
  status of *OpenAI Codex CLI*), or a single row with the status `not
  installed`.

- `MCP`:
  One row per *currently registered* server of the pre-defined MCP
  servers (see `ase-setup-mcp`(1)), with its MCP server name and its
  registration scope (as reported by `<cli> mcp get`), and the status
  `registered`. Unregistered servers are omitted entirely.

- `OUTPUTSTYLE` (`--tool claude` only):
  One row per settings file (of the scopes `user`, `project`, and
  `local`) carrying an `outputStyle` entry, with the status `selected`
  (the *ASE* output style `ase:ase-terse`) or `foreign`
  (hand-selected).

- `STATUSLINE` (`--tool claude` and `--tool copilot` only):
  One row per settings file carrying a `statusLine` entry, with the
  status `activated` (its command starts with `ase statusline`, i.e.,
  it is owned by *ASE*) or `foreign` (hand-crafted).

- `TELEMETRY`:
  One row per configuration file carrying a telemetry export, with the
  status `activated` (towards the *ASE* OTLP ingress) or `foreign`:
  for `claude`, the `env` of `~/.claude/settings.json`; for `codex`,
  `$CODEX_HOME/config.toml`; for `copilot`, the shell profiles
  `~/.zshrc` and `~/.bashrc` (plus the profile of the login shell), and
  an `$OTEL_EXPORTER_OTLP_ENDPOINT` of the environment not pointing to
  the *ASE* ingress.

Files below the home directory are shown abbreviated with `~`, and an
unparsable settings file is silently skipped. The command is purely
read-only and always exits with status `0`, so a missing registration
is reported rather than signalled through the exit code.

It takes no `--scope`, since it deliberately reports *all* scopes at
once -- that is exactly what makes an unintentionally leaked
registration visible. Scope information is only available for
`--tool claude` (and, for MCP servers, `--tool copilot`); everywhere
else the scope is reported as `(n/a)`.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  Select the target agent tool: `claude`, `copilot`, or `codex`
  (default: `$ASE_TOOL`, else `claude`).

## ENVIRONMENT

- `ASE_TOOL`:
  The default of `--tool`.

- `COPILOT_HOME`, `CODEX_HOME`:
  The configuration directories of *GitHub Copilot CLI* (default:
  `~/.copilot`) and *OpenAI Codex CLI* (default: `~/.codex`).

## EXIT STATUS

`0` in all regular cases, `1` only on an error like an invalid option
value or a missing agent tool CLI.

## EXAMPLES

```sh
# report the ASE registrations for Anthropic Claude Code CLI
$ ase setup status

# report the ASE registrations for OpenAI Codex CLI
$ ase setup status --tool codex
```

## SEE ALSO

`ase`(1), `ase-setup`(1), `ase-setup-install`(1), `ase-setup-mcp`(1),
`ase-setup-statusline`(1), `ase-setup-telemetry`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
