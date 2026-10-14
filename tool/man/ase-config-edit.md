# ase-config-edit(1) -- Edit the Configuration File with an Editor

## SYNOPSIS

`ase config`
\[`--scope` *scope*\]
`edit`
\[`-h`|`--help`\]

## DESCRIPTION

**ase config edit** opens the configuration file of the target scope
(the strongest scope of the scope chain, by default `project` inside a
project, else `user`) in a text editor. The file and its parent
directories are created if missing (a new `user` scope file with file
mode `0600`).

After the editor exits, the file is re-read and strictly validated
against the configuration schema. If it carries invalid YAML or
invalid entries, the error is reported and the question `re-edit? [Y/n]`
is asked on standard error: any answer other than `n` or `no` opens the
editor again, while `n` or `no` lets the command fail (leaving the
invalid file as is).

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`--scope` *scope*\]:
  Select the scope chain, whose strongest scope is the target scope
  whose file is edited. As an option of `ase config`, it has to be
  given *before* `edit`. The *scope* value is a comma-separated list of
  the terms `user`, `project`, `task:`*id*, and `session:`*id* (with
  *id* matching `[A-Za-z0-9._-]+`), at most one per kind and in any
  order, canonicalized into the order `user` < `project` < `task` <
  `session`. `user` is always added implicitly, and `project` is added
  implicitly whenever a project context (a Git working tree or a `.ase`
  directory at or above the current directory) exists, but never
  above the strongest explicitly requested term. An explicit `project`
  without a project context is an error. Default: `project` inside a
  project context, else `user`. See `ase-config`(1) for details.

## ENVIRONMENT

- `VISUAL`, `EDITOR`:
  The editor command, taken from the first non-empty one of `VISUAL`
  and `EDITOR`, falling back to `vi`. The value is split on whitespace
  into the command and its arguments (it is not run through a shell),
  and the file name is appended as the last argument.

## FILES

The configuration file of the target scope: *per-user configuration
directory*`/config.yaml` (`user`), `.ase/config.yaml` (`project`),
`.ase/task/`*id*`/config.yaml` (`task:`*id*), or *per-user state
directory*`/session/`*id*`/config.yaml` (`session:`*id*). See
`ase-config`(1).

## EXIT STATUS

`0` once the edited file is valid, `1` if the editor could not be run,
or if the file stayed invalid and re-editing was declined.

## EXAMPLES

```sh
# edit the project configuration with Vim
$ EDITOR=vim ase config edit

# edit the user configuration
$ ase config --scope user edit
```

## SEE ALSO

`ase`(1), `ase-config`(1), `ase-config-set`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
