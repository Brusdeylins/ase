# ase-setup-uninstall(1) -- Uninstall the ASE Plugin and Tool

## SYNOPSIS

`ase setup uninstall`
\[`-h`|`--help`\]
\[`-t`|`--tool` *tool*\]
\[`-s`|`--scope` *scope*\]
\[`-d`|`--dev`\]

## DESCRIPTION

**ase setup uninstall** uninstalls the *ASE* plugin from the agent
tool selected by `--tool` and the *ASE* tool itself. It requires
`npm`(1) and the CLI of the agent tool to be found in `$PATH`. The
steps are:

1. A potentially running `ase service` of the current project is
   stopped (on a best-effort basis).
2. For `--tool claude`, the selection of the output style
   `ase:ase-terse` is removed from the `settings.json` of the
   installation scope, while a foreign `outputStyle` is preserved with
   a warning. Likewise, the variable `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`
   (value `1`) is removed from its `env` (together with an `env` which
   became empty), while a foreign value is preserved with a warning.
3. The plugin `ase@ase` is uninstalled (`<cli> plugin uninstall
   ase@ase`, resp. `codex plugin remove ase@ase`) and the plugin
   marketplace `ase` is removed (`<cli> plugin marketplace remove
   ase`), where an already absent plugin or marketplace is skipped.
4. Unless in development mode (`--dev`), the tool is uninstalled via
   `npm uninstall -g @rse/ase` (prefixed with `sudo`(8) if the global
   `npm` installation root is not writable by the current user and
   `sudo` is available).

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

- \[`-d`|`--dev`\]:
  Development mode: uninstall the plugin only, but keep the *ASE*
  tool, as it is the local working copy (default: `$ASE_SETUP_DEV`).

## ENVIRONMENT

- `ASE_TOOL`:
  The default of `--tool`.

- `ASE_SETUP_DEV`:
  The default of `--dev`: any non-empty value other than `0` and
  `false` (case-insensitive) enables it.

## EXIT STATUS

`0` on success, `1` on any error.

## EXAMPLES

```sh
# uninstall ASE from Anthropic Claude Code CLI
$ ase setup uninstall

# uninstall the plugin from GitHub Copilot CLI
$ ase setup uninstall --tool copilot
```

## SEE ALSO

`ase`(1), `ase-setup`(1), `ase-setup-install`(1),
`ase-setup-disable`(1), `npm`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
