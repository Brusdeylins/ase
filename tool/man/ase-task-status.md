# ase-task-status(1) -- Get or Set the Lifecycle Status of a Task

## SYNOPSIS

`ase task status`
\[`-h`|`--help`\]
\[*id*\[`:`\]\]
\[*status*\]

## DESCRIPTION

**ase task status** gets or sets the lifecycle status, i.e., the
`Status` frontmatter key, of the task plan with the given *id* in the
task store (see `ase-task`(1)).

Without *status*, the current status is printed to standard output,
where a plan without a `Status` key reads as the initial state of the
task lifecycle model of the project.

With *status*, the status is set and the change is logged as
`task: set status of "`*id*`" from "`*from*`" to "`*to*`"`. The
*status* is given case-insensitively and has to be a state of the task
lifecycle model of the project, which is reachable from the current
status via one or more transitions of the model (see
**TASK LIFECYCLE MODELS** in `ase-task`(1)); a current status foreign
to the model can be changed to any state, to allow its correction.

Only the frontmatter is changed: the `Modified` key is left alone, as
it tracks the changes of the plan body only.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- \[*id*\[`:`\]\]:
  The id of the task (default: `$ASE_TASK_ID`, else `default`). A
  trailing colon is stripped, which allows to mark a single argument
  explicitly as the *id*: if only a single argument is given, it is
  taken as *status* if it is a state of the task lifecycle model
  (case-insensitively) and has no trailing colon, else as *id*.

- \[*status*\]:
  The lifecycle status to set.

## ENVIRONMENT

- `ASE_TASK_ID`:
  The default task id (default: `default`).

## EXIT STATUS

`0` on success, `1` if no such task exists, the *status* is not a
state of the task lifecycle model, or it is not reachable from the
current status.

## EXAMPLES

```sh
# print the status of the task "json-export"
$ ase task status json-export:

# move the task "json-export" into "SHELVED"
$ ase task status json-export shelved

# close the task of $ASE_TASK_ID
$ ase task status CLOSED
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-lifecycle`(1), `ase-task-list`(1),
`ase-task-save`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
