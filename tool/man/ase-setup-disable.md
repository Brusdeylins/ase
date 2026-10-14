# ase-setup-disable(1) -- Disable the ASE Plugin in an Agent Tool

## SYNOPSIS

`ase setup disable`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]
\[`-s`|`--scope` *scope*\]

## DESCRIPTION

**ase setup disable** disables the installed *ASE* plugin in the agent
tool selected by `--tool` without uninstalling it, so it can be
enabled again via `ase setup enable`. It requires the CLI of the
agent tool to be found in `$PATH`.

For *Anthropic Claude Code CLI*, the plugin is disabled via `claude
plugin disable ase@ase` (with `--scope` *scope* for a non-`user`
scope), which keeps its registration under `enabledPlugins` (with the
value `false`). As *GitHub Copilot CLI* and *OpenAI Codex CLI* have no
plugin disable command, the plugin is uninstalled there instead
(`copilot plugin uninstall ase@ase`, resp. `codex plugin remove
ase@ase`, retried up to three times), while its plugin marketplace
stays registered.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-t`|`--tool` *tool*\]:
  Select the target agent tool: `claude`, `copilot`, or `codex`
  (default: `$ASE_TOOL`, else `claude`).

- \[`-s`|`--scope` *scope*\]:
  Select the plugin installation scope: `user`, `project`, or
  `local`. The default is auto-detected from the existing
  installation: the scopes `local`, `project`, and `user` are probed
  in this order, and the first one whose settings file registers the
  plugin `ase@ase` under `enabledPlugins` is taken, falling back to
  `user`. Only supported for `--tool claude`; a non-`user` scope for
  `copilot` or `codex` fails with an error.

## ENVIRONMENT

- `ASE_TOOL`:
  The default of `--tool`.

## EXIT STATUS

`0` on success, `1` on any error.

## EXAMPLES

```sh
# temporarily disable the ASE plugin in Anthropic Claude Code CLI
$ ase setup disable
```

## SEE ALSO

`ase`(1), `ase-setup`(1), `ase-setup-enable`(1),
`ase-setup-uninstall`(1), `ase-setup-status`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
