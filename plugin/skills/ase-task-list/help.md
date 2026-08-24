
##  NAME

`ase-task-list` - List Task Plans

##  SYNOPSIS

`ase-task-list`
    [`--help`|`-h`]
    [`--verbose`|`-v`]
    [`--sort`|`-s` *key*]
    [`--include`|`-i`=*state*[`,`...]]
    [`--exclude`|`-e`=*state*[`,`...]]

##  DESCRIPTION

The `ase-task-list` skill lists all available *task ids* in the
current project by calling the `ase_task_list` MCP tool. In the
default mode, only the task ids are rendered as a single-column
Markdown table. In verbose mode, the lifecycle status and the
last-modified timestamp of each task plan are rendered as additional
columns.

The listing is restricted to an *effective state set*, derived from the
`Status:` frontmatter key of each task plan (which defaults to `DRAFTED`
for a plan carrying no such key): with `--include` only, exactly the
listed states are shown; with `--exclude` only, all states except the
listed ones; with both, the included ones minus the excluded ones. An
unknown state, or a combination which cancels out to an empty set,
aborts the skill with an error. By default,
`--exclude COMPLETED,CLOSED,CANCELLED` is in effect, so finished and
abandoned task plans stay out of the way. The nine states are:

```text
DRAFTED   APPROVED  STARTED  COMPLETED  CANCELLED
REJECTED  DEFERRED  BLOCKED  CLOSED
```

##  OPTIONS

-   `--verbose`|`-v`:
    Render an additional `Status` column with the lifecycle state and an
    additional `Last Modified` column with the `YYYY-MM-DD HH:MM`
    timestamp of each task plan.

-   `--include`|`-i`=*state*[`,`...]:
    Restrict the listed task plans to the given comma-separated list of
    lifecycle states (e.g. `STARTED,BLOCKED`). Without this option, all
    nine states are listed. The `none` sentinel selects no state at all.

-   `--exclude`|`-e`=*state*[`,`...]:
    Remove the given comma-separated list of lifecycle states from the
    listed task plans. Applied *after* `--include`, so
    `-i DRAFTED,STARTED -e STARTED` lists `DRAFTED` only. Defaults to
    `COMPLETED,CLOSED,CANCELLED`; pass `--exclude none` to suppress the
    default and list task plans in every state.

##  SCENARIOS

-   You want an overview of all task plans
-   You want task ids listed with status and timestamps
-   You want the unfinished or in-progress tasks found

##  EXAMPLES

List all unfinished task ids:

```text
❯ /ase-task-list
```

List all unfinished task ids, ordered by their lifecycle state:

```text
❯ /ase-task-list --sort status
```

List all task ids together with their status and last-modified timestamps:

```text
❯ /ase-task-list --verbose
```

List the task ids of every task plan, including the finished ones:

```text
❯ /ase-task-list --exclude none
```

List only the task ids of the task plans currently under work:

```text
❯ /ase-task-list --include STARTED,BLOCKED
```

##  SEE ALSO

[`ase-task-id`](../ase-task-id/help.md), [`ase-task-view`](../ase-task-view/help.md), [`ase-task-edit`](../ase-task-edit/help.md),
[`ase-task-rename`](../ase-task-rename/help.md), [`ase-task-delete`](../ase-task-delete/help.md).
