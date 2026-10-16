# ase-config-delete(1) -- Delete a Configuration Value

## SYNOPSIS

`ase config`
\[`--scope` *scope*\]
`delete`
\[`-h`|`--help`\]
*key*

## DESCRIPTION

**ase config delete** deletes the configuration *key* from the
configuration file of the target scope (the strongest scope of the
scope chain, by default `project` inside a project, else `user`) and
writes the file back. Weaker scopes are never modified, so a value of
the same key on a weaker scope (or the built-in default) becomes
effective again.

Deleting a key which is not set on the target scope is no error. As
for `ase config set`, a key which is not writable on the target scope
cannot be deleted there either, and a target file which carries invalid
content is not overwritten.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`--scope` *scope*\]:
  Select the scope chain, whose strongest scope is the target scope
  written by this command. As an option of `ase config`, it has to be
  given *before* `delete`. The *scope* value is a comma-separated list
  of the terms `user`, `project`, `task:`*id*, and `session:`*id* (with
  *id* matching `[A-Za-z0-9._-]+`), at most one per kind and in any
  order, canonicalized into the order `user` < `project` < `task` <
  `session`.

  `user` is always added implicitly, and `project` is added implicitly
  whenever a project context (a Git working tree or a `.ase` directory
  at or above the current directory) exists, but never above the
  strongest explicitly requested term. An explicit `project` without a
  project context is an error. Default: `project` inside a project
  context, else `user`. See `ase-config`(1) for details.

## ARGUMENTS

- *key*:
  The dotted configuration key, e.g., `agent.persona`, or any
  unambiguous trailing part of a known key, e.g., `persona`.

## EXIT STATUS

`0` on success, `1` on a *key* not writable on the target scope, an
ambiguous *key*, an invalid *scope*, or a target file carrying invalid
content.

## EXAMPLES

```sh
# fall back to the default persona again
$ ase config delete agent.persona

# remove the task store token of the user
$ ase config --scope user delete project.task.store.token
```

## SEE ALSO

`ase`(1), `ase-config`(1), `ase-config-set`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
