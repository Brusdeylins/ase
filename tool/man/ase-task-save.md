# ase-task-save(1) -- Save a Task Plan from Standard Input

## SYNOPSIS

`ase task save`
\[`-h`|`--help`\]
\[`-c`|`--create`\]
*id*

## DESCRIPTION

**ase task save** reads a task plan in the textual task format (see
`ase util meta format-task`) from standard input and saves it under
the given *id* in the task store (see `ase-task`(1)), creating or
overwriting the task.

The text is parsed into the frontmatter block, the plan body, and the
attachment blocks, where a plan in a legacy format is normalized into
the current frontmatter shape first. The `Id` frontmatter key is
always taken from the *id* argument, and a missing `Type` key is set
to `text/vnd.ase.task`. A text without a closed frontmatter block is
taken as the plan body.

Attachment data given as the elision marker `[elided: `*N*` lines]` is
restored from the stored plan. The usage attachment (`kind="usage"`)
can be changed by a booking only: an overwrite keeps the stored usage
attachment, while a create drops any given one.

The `Status` frontmatter key is checked against the task lifecycle
model of the project: a changed status which is not a state of the
model, or which is not reachable from the previously saved status (or,
for a new task, from the initial state of the model) via one or more
transitions of the model, lets the save fail. An *id* not conforming
to the task id scheme of the project is saved, but warned about.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-c`|`--create`\]:
  Create the task only: fail if a task with *id* already exists,
  instead of overwriting it (default: off). Intended for the first
  save of a task whose *id* was obtained via `ase-task-newid`(1), as
  only a `seq` id is reserved there, so a concurrently created task of
  the same id is never overwritten.

## ARGUMENTS

- *id*:
  The id of the task, matching `[A-Za-z0-9#][A-Za-z0-9#_-]*`.

## EXIT STATUS

`0` on success, `1` if the *id* is invalid, the plan is invalid (e.g.,
a multi-line frontmatter value, or a body which would be misread as
attachments), the `Status` is not a state of the model or not
reachable, or, with `--create`, the task already exists.

## EXAMPLES

```sh
# create a new task from a plan file
$ id=$(ase task newid "Export as JSON")
$ ase task save --create "$id" <plan.md

# round-trip a task plan through a filter
$ ase task load json-export | sed -e 's/^Kind:.*/Kind: CRAFTING/' | ase task save json-export
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-load`(1), `ase-task-edit`(1),
`ase-task-newid`(1), `ase-task-status`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
