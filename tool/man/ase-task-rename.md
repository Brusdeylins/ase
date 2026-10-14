# ase-task-rename(1) -- Rename a Task Plan

## SYNOPSIS

`ase task rename`
\[`-h`|`--help`\]
*old-id*
*new-id*

## DESCRIPTION

**ase task rename** renames the task plan with the given *old-id* to
*new-id* in the task store (see `ase-task`(1)), rewriting the `Id`
frontmatter key inside the plan.

All references to *old-id* in the `After` frontmatter keys of all
other task plans of the project are rewritten to *new-id* (in the
frontmatter only, so their `Modified` key stays untouched), and the
number of updated plans is reported. For an *explicit epic*, i.e., a
task whose `Group` key equals its old (or already its new) id, its
own `Group` key and those of all its member task plans are rewritten,
too, while otherwise the group names are left untouched, as they form
a namespace of their own. The task itself is renamed first, so an
interruption never leaves both ids behind; a failure to update the
references afterwards is reported together with the plans left
behind.

For a `seq` task id scheme, the sequence number of *old-id* is never
reused by `ase-task-newid`(1). A *new-id* not conforming to the task
id scheme of the project is warned about. Finally, the rename is
reported to the `ase service` of the project (if it ever ran, i.e.,
`.ase/service.yaml` exists), so its AI usage windows follow the task;
a failure of this report is only warned about.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- *old-id*:
  The current id of the task, matching `[A-Za-z0-9#][A-Za-z0-9#_-]*`.

- *new-id*:
  The new id of the task, matching `[A-Za-z0-9#][A-Za-z0-9#_-]*`,
  which must not be in use already.

## EXIT STATUS

`0` on success, `1` if no such task existed (reported as `task: no
task "`*old-id*`" to rename`), the *new-id* is already in use, or on
any other error.

## EXAMPLES

```sh
$ ase task rename json-export export-json
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-edit`(1), `ase-task-newid`(1),
`ase-task-delete`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
