# ase-task-list(1) -- List Persisted Task Ids

## SYNOPSIS

`ase task list`
\[`-h`|`--help`\]
\[`-v`|`--verbose`\]
\[`-i`|`--include` *states*\]
\[`-e`|`--exclude` *states*\]

## DESCRIPTION

**ase task list** lists the ids of the persisted task plans of the
current project in the task store (see `ase-task`(1)), one per line,
in natural order (numbers ordered by their value, e.g., `FOO-2` before
`FOO-10`).

The listed tasks are restricted to those whose lifecycle status
(the `Status` frontmatter key, or the initial state of the task
lifecycle model if absent) is in the effective state set of the
`--include` and `--exclude` options. By default, all tasks except the
ones in a *finished* state of the task lifecycle model are listed. A
task whose status is unknown to the task lifecycle model is always
listed, but warned about.

## OPTIONS

- \[`-h`|`--help`\]:
  Show usage information and exit.

- \[`-v`|`--verbose`\]:
  Annotate each task id with the lifecycle status of its plan, the
  modification time of its plan as `(YYYY-MM-DD HH:MM)`, its effort
  size (the T-shirt size `XS`, `S`, `M`, `L`, or `XL` of the valid
  `Effort` frontmatter key of the plan, else `-`), and its title (the
  text after `TASK:` of the first `#   TASK:` heading of the plan body,
  else empty), all separated by a single tab character.

- \[`-i`|`--include` *states*\]:
  Restrict the listing to the tasks in one of the *states*, a
  comma-separated list of lifecycle states of the task lifecycle model
  of the project (given case-insensitively), where the term `finished`
  expands to the finished states of the model and the term `none` (as
  well as an empty term) is ignored. An empty list (default: `none`)
  means all states.

  The states of the models are `OPEN`, `SHELVED`, `CLOSED`, and
  `CANCELLED` (`solo`), `PLANNING`, `SHELVED`, `IMPLEMENTING`,
  `STALLED`, `IMPLEMENTED`, and `CANCELLED` (`team`), and `DRAFTED`,
  `SHELVED`, `PLANNING`, `PLANNED`, `STALLED`, `IMPLEMENTING`,
  `IMPLEMENTED`, `DECLINED`, `APPROVING`, `APPROVED`, `DEFERRED`,
  `INTEGRATING`, `INTEGRATED`, and `CANCELLED` (`enterprise`). A state
  which is not one of the model is an error.

- \[`-e`|`--exclude` *states*\]:
  Exclude the tasks in one of the *states* from the listing, a
  comma-separated list of the same form as for `--include`, applied
  after `--include` (default: `finished`, i.e., the finished states of
  the model). Use `none` to exclude nothing. If `--include` and
  `--exclude` cancel out to an empty state set, this is an error.

## EXIT STATUS

`0` on success, `1` on an error, like an invalid state, an empty
effective state set, or an unreachable task store.

## EXAMPLES

```sh
# list all unfinished tasks
$ ase task list

# list all tasks, including the finished ones, with details
$ ase task list -v -e none

# list the tasks waiting for their approval
$ ase task list -i IMPLEMENTED,DECLINED
```

## SEE ALSO

`ase`(1), `ase-task`(1), `ase-task-status`(1), `ase-task-board`(1).

## AUTHOR

Dr. Ralf S. Engelschall <rse@engelschall.com>
