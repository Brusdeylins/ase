# ase-setup-enable(1) -- Enable the ASE Plugin in an Agent Tool

## SYNOPSIS

`ase setup enable`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]
\[`-s`|`--scope` *scope*\]

## DESCRIPTION

**ase setup enable** enables the already installed *ASE* plugin in the
agent tool selected by `--tool`, e.g., after it was disabled via `ase
setup disable`. It requires the CLI of the agent tool to be found in
`$PATH`.

For *Anthropic Claude Code CLI*, the plugin is enabled via `claude
plugin enable ase@ase` (with `--scope` *scope* for a non-`user`
scope). As *GitHub Copilot CLI* and *OpenAI Codex CLI* have no plugin
enable command, the plugin is (re-)installed there instead (`copilot
plugin install ase@ase`, resp. `codex plugin add ase@ase`, retried up
to three times), which requires the *ASE* plugin marketplace to be
still registered (see `ase-setup-install`(1)).

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
  plugin `ase@ase` under `enabledPlugins` (enabled or disabled) is
  taken, falling back to `user`. Only supported for `--tool claude`;
  a non-`user` scope for `copilot` or `codex` fails with an error.

## ENVIRONMENT

- `ASE_TOOL`:
  The default of `--tool`.

## EXIT STATUS

`0` on success, `1` on any error.

## EXAMPLES

```sh
# re-enable the ASE plugin in Anthropic Claude Code CLI
$ ase setup enable
```

## SEE ALSO

`ase`(1), `ase-setup`(1), `ase-setup-disable`(1),
`ase-setup-status`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
