# ase-config-set(1) -- Set a Configuration Value

## SYNOPSIS

`ase config`
\[`--scope` *scope*\]
`set`
\[`-h`|`--help`\]
*key*
*value*

## DESCRIPTION

**ase config set** sets the configuration *key* to *value* in the
configuration file of the target scope (the strongest scope of the
scope chain, by default `project` inside a project, else `user`),
creating the file, its parent directories, and the intermediate maps
of the dotted key as needed. Weaker and intermediate scopes are never
modified.

The *value* is validated against the configuration schema before the
file is written, and an invalid value is an error. Some keys are
writable on particular scopes only (e.g., `project.task.*` on `user`
and `project`, the token keys on `user`): setting such a key on any
other scope is an error naming the permitted scopes. See
`ase-config`(1) for all keys, their values, and their scopes. A target
file which already carries invalid content is not overwritten, as this
content would be lost.

The file is written under an advisory file lock and atomically, with
file mode `0600` for the `user` scope and for any file carrying a
secret key.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`--scope` *scope*\]:
  Select the scope chain, whose strongest scope is the target scope
  written by this command. As an option of `ase config`, it has to be
  given *before* `set`. The *scope* value is a comma-separated list of
  the terms `user`, `project`, `task:`*id*, and `session:`*id* (with
  *id* matching `[A-Za-z0-9._-]+`), at most one per kind and in any
  order, canonicalized into the order `user` < `project` < `task` <
  `session`. `user` is always added implicitly, and `project` is added
  implicitly whenever a project context (a Git working tree or a `.ase`
  directory at or above the current directory) exists, but never
  above the strongest explicitly requested term, so an explicit
  `--scope user` is never silently retargeted to `project`. An explicit
  `project` without a project context is an error. Default: `project`
  inside a project context, else `user`. See `ase-config`(1) for
  details.

## ARGUMENTS

- *key*:
  The dotted configuration key, e.g., `agent.persona`, or any
  unambiguous trailing part of a known key, e.g., `persona`.

- *value*:
  The value to set, stored as a string (e.g., `true` for
  `telemetry.enabled` or `44318` for `telemetry.service.port`).

## EXIT STATUS

`0` on success, `1` on an invalid *value*, a *key* not writable on the
target scope, an ambiguous *key*, an intermediate path of *key* which is
not a map, an invalid *scope*, or a target file carrying invalid
content.

## EXAMPLES

```sh
# switch the project to the enterprise task lifecycle model
$ ase config set project.task.lifecycle enterprise

# enable the AI usage accounting for the current user
$ ase config --scope user set telemetry.enabled true

# set the persona for a single session only
$ ase config --scope session:4711 set agent.persona caveman
```

## SEE ALSO

`ase`(1), `ase-config`(1), `ase-config-get`(1), `ase-config-delete`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
