# ase-task-view(1) -- Show a Task Plan in the Pager

## SYNOPSIS

`ase task view`
\[`-h`|`--help`\]
*id*

## DESCRIPTION

**ase task view** loads the task plan with the given *id* from the task
store (see `ase-task`(1)) and shows it in the pager defined by `$PAGER`
(falling back to `more`), run through the shell (so a value with
arguments is supported) and fed with the plan via its standard input.
If standard output is not a terminal, the pager is bypassed and the
plan is written plainly to standard output.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

## ARGUMENTS

- *id*:
  The id of the task, matching `[A-Za-z0-9#][A-Za-z0-9#_-]*`.

## ENVIRONMENT

- `PAGER`:
  The pager command (default: `more`).

## EXIT STATUS

`0` on success, `1` if no such task exists.

## EXAMPLES

```sh
$ PAGER="less -R" ase task view json-export
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-load`(1), `ase-task-edit`(1),
`more`(1), `less`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
