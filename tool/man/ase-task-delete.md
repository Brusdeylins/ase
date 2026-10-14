# ase-task-delete(1) -- Delete a Task Plan

## SYNOPSIS

`ase task delete`
\[`-h`|`--help`\]
*id*

## DESCRIPTION

**ase task delete** deletes the task plan with the given *id*,
including all its attachments, from the task store (see
`ase-task`(1)). For a `seq` task id scheme, the sequence number of the
deleted task is never reused by `ase-task-newid`(1), as it raises the
high-water mark of the sequence numbers of the project. References to
the deleted task in the `After` keys of other task plans are left
alone.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- *id*:
  The id of the task, matching `[A-Za-z0-9#][A-Za-z0-9#_-]*`.

## EXIT STATUS

`0` if the task existed and was deleted, `1` if no such task existed
(reported as `task: no task "`*id*`" to remove`) or on any error.

## EXAMPLES

```sh
$ ase task delete json-export
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-purge`(1), `ase-task-rename`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
