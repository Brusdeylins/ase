# ase-config-get(1) -- Print a Configuration Value

## SYNOPSIS

`ase config`
\[`--scope` *scope*\]
`get`
\[`-h`|`--help`\]
*key*

## DESCRIPTION

**ase config get** prints the effective value of the configuration
*key*, followed by a newline, on standard output. The value is looked
up from the strongest scope of the scope chain down to the built-in
`default` scope, and the first defined value wins. In contrast to `ase
config list`, secret values are printed unmasked.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`--scope` *scope*\]:
  Select the scope chain whose values are cascaded. As an option of
  `ase config`, it has to be given *before* `get`. The *scope* value is
  a comma-separated list of the terms `user`, `project`, `task:`*id*,
  and `session:`*id* (with *id* matching `[A-Za-z0-9._-]+`), at most one
  per kind and in any order, canonicalized into the order `user` <
  `project` < `task` < `session`.

  `user` is always added implicitly, and `project` is added implicitly
  whenever a project context (a Git working tree or a `.ase` directory
  at or above the current directory) exists, but never above the
  strongest explicitly requested term. An explicit `project` without a
  project context is an error. Default: `project` inside a project
  context, else `user`. See `ase-config`(1) for details.

## ARGUMENTS

- *key*:
  The dotted configuration key, e.g., `agent.persona`, or any
  unambiguous trailing part of a known key, e.g., `persona`. See
  `ase-config`(1) for all keys.

## EXIT STATUS

`0` on success, `1` if *key* is not set on any scope, if *key* does not
address a leaf value (e.g., `project.task`), if *key* is ambiguous, or
on an invalid *scope*.

## EXAMPLES

```sh
# print the effective task lifecycle model
$ ase config get project.task.lifecycle
solo

# print the user-level persona via its abbreviated key
$ ase config --scope user get persona
engineer
```

## SEE ALSO

`ase`(1), `ase-config`(1), `ase-config-list`(1), `ase-config-set`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
