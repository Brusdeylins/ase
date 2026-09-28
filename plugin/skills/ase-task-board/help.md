
##  NAME

`ase-task-board` - Show the Task Board

##  SYNOPSIS

`ase-task-board`
    [`--help`|`-h`]
    [`--web`|`-w`]

##  DESCRIPTION

The `ase-task-board` skill shows all task plans of the current
project in the *lanes* of the configured task lifecycle model, by calling
`ase task board --text`. The lanes are grouped by the phases of the model
and the finished states form a final group `Done`: the `solo` model
shows *Work in Progress* and *Done*, the `team` model *Planning*,
*Implementation*, and *Done*, and the `enterprise` model *Planning*,
*Implementation*, *Approval*, *Integration*, and *Done*. Within a group,
the entry state comes first, the active state second, and the parking
state last. The lane layout follows the effective task lifecycle model
(switched via `ase task lifecycle`) and cannot be configured otherwise.

Every card shows its *task id* and, behind a `▶`, its *title*, so a
task seen on the board can be opened by its id via `ase-task-view`.

The text overview is *read-only*: it never changes a task. The
interactive terminal board is available via `ase task board` in a
terminal, and the live web board via `--web`, both following every
change of the task plans, including edits in an external editor. Both
move a task onto another lane, changing its status (terminal: `SPACE`
to pick up and drop, web: drag & drop or `SPACE`), and the terminal board edits
a task plan with `$EDITOR` (`e`).

##  OPTIONS

-   `--web`|`-w`:
    Start the ASE service of the project if necessary, serve the web
    board through it, and open it in the browser. Its minimized lanes
    and collapsed groups are stored once per project, not per browser:
    all open web boards share them and pick up a change immediately.

##  SCENARIOS

-   You want an overview of all tasks in their lifecycle lanes
-   You want the live web board in the browser

##  EXAMPLES

Show the lane overview of all task plans:

```text
❯ /ase-task-board
```

Open the web board in the browser:

```text
❯ /ase-task-board --web
```

##  SEE ALSO

[`ase-task-list`](../ase-task-list/help.md), [`ase-task-view`](../ase-task-view/help.md),
[`ase-task-status`](../ase-task-status/help.md).
