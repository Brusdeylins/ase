# ase-task-purge(1) -- Remove Old Task Plans

## SYNOPSIS

`ase task purge`
\[`-h`|`--help`\]
\[*age*\]

## DESCRIPTION

**ase task purge** removes all persisted task plans of the current
project from the task store (see `ase-task`(1)) whose modification
time is older than *age*, regardless of their lifecycle status. Each
removed task is logged as `task: purged "`*id*`"`, or `task: no tasks
to purge` is logged if none was removed. For a `seq` task id scheme,
the sequence numbers of the purged tasks are never reused by
`ase-task-newid`(1).

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- \[*age*\]:
  The maximum age of the task plans to keep, as `<number><unit>`, where
  *unit* is one of `h` (hour), `d` (day, 24 hours), `m` (month, 30
  days), or `y` (year, 365 days) (default: `31d`).

## EXIT STATUS

`0` on success (also if no task was removed), `1` on a malformed *age*
or an unreachable task store.

## EXAMPLES

```sh
# remove all tasks not modified within the last half year
$ ase task purge 6m
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-delete`(1), `ase-task-list`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
