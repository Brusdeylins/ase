# ase-task-load(1) -- Write a Task Plan to Standard Output

## SYNOPSIS

`ase task load`
\[`-h`|`--help`\]
*id*

## DESCRIPTION

**ase task load** loads the task plan with the given *id* from the task
store (see `ase-task`(1)) and writes it to standard output, in the
textual task format: the frontmatter block (with its keys in canonical
order and their values column-aligned), the plan body, and the
attachment blocks (with their `Data` as literal block scalars). A plan
in a legacy format is normalized into the current frontmatter shape on
the fly. If no such task exists, nothing is written.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- *id*:
  The id of the task, matching `[A-Za-z0-9#][A-Za-z0-9#_-]*`.

## EXIT STATUS

`0` on success, also if no such task exists, `1` on an invalid *id*
or an unreachable task store.

## EXAMPLES

```sh
# copy a task plan into a file
$ ase task load json-export >json-export.md
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-save`(1), `ase-task-view`(1),
`ase-task-edit`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
