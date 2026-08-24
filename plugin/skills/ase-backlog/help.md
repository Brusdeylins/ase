
##  NAME

`ase-backlog` - Show the Task Board Overview

##  SYNOPSIS

`ase-backlog`
    [`--help`|`-h`]

##  DESCRIPTION

The `ase-backlog` skill shows a Kanban board overview of all persisted
task plans of the current project, grouped by their board lanes. The
lanes group the task plan lifecycle states (see the `Status` frontmatter
key), by default as `Crafting` (DRAFTED, REJECTED), `Ready` (APPROVED),
`Deferred` (DEFERRED), `Implementation` (STARTED, BLOCKED),
`Code-Review` (COMPLETED), and `Closed` (CLOSED, CANCELLED). The lane
set can be changed via the `project.backlog.lanes` configuration key.

Before the overview is rendered, the board mirror is synchronized via
`ase backlog sync`, so lane changes made on the board (web UI or TUI)
are written back into the task plans first. After the overview, the
running board servers of all projects are listed as a jump list.

##  OPTIONS

Only the standard `--help`|`-h` option exists.

##  EXAMPLES

Show the board overview:

```text
❯ /ase-backlog
```

##  SEE ALSO

[`ase-backlog-web`](../ase-backlog-web/help.md), [`ase-task-list`](../ase-task-list/help.md),
[`ase-task-view`](../ase-task-view/help.md).
