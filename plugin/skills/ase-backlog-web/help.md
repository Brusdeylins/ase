
##  NAME

`ase-backlog-web` - Open the Task Board Web UI

##  SYNOPSIS

`ase-backlog-web`
    [`--help`|`-h`]

##  DESCRIPTION

The `ase-backlog-web` skill starts the background board server of the
current project (if it is not running yet) and opens the Kanban board
web UI in the browser, by delegating to `ase backlog web`.

The board server runs one instance per project on its own local port
(bound to `127.0.0.1`), so multiple projects can show their boards
simultaneously. It keeps the board and the persisted task plans in sync:
dragging a task into another lane rewrites the `Status` frontmatter key
of the corresponding task plan, and task plan changes appear on the
board without a restart. The server keeps running in the background
until it is stopped via `ase backlog stop`.

##  OPTIONS

Only the standard `--help`|`-h` option exists.

##  EXAMPLES

Open the board web UI:

```text
❯ /ase-backlog-web
```

##  SEE ALSO

[`ase-backlog`](../ase-backlog/help.md), [`ase-task-list`](../ase-task-list/help.md),
[`ase-task-implement`](../ase-task-implement/help.md).
